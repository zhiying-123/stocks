import "dotenv/config";

type AutoTradeAction = "BUY" | "SELL";
type TriggerType = "PRICE_TARGET" | "MOVING_AVERAGE";
type TriggerDirection = "ABOVE" | "BELOW";
type BacktestMode = "once" | "repeat";

type BacktestArgs = {
  symbol: string;
  action: AutoTradeAction;
  triggerType: TriggerType;
  direction: TriggerDirection;
  targetPrice: number | null;
  movingAverageDays: number | null;
  quantity: number;
  start: string;
  end: string;
  initialCash: number;
  initialShares: number;
  mode: BacktestMode;
};

type PricePoint = {
  timestamp: number;
  close: number;
};

type TradeLog = {
  date: string;
  action: AutoTradeAction;
  price: number;
  quantity: number;
  cashAfter: number;
  sharesAfter: number;
  triggerValue: number;
};

type SkipLog = {
  date: string;
  reason: string;
  price: number;
  triggerValue: number;
};

function printHelp() {
  console.log(`
Backtest stock auto buy/sell strategy using historical daily closes.

Usage:
  npm run backtest:auto-buy-sell -- --symbol AAPL --action BUY --triggerType PRICE_TARGET --direction BELOW --targetPrice 170 --quantity 5 --start 2025-01-01 --end 2025-12-31

Required:
  --symbol <string>                  Stock symbol, e.g. AAPL
  --action <BUY|SELL>                Trade action when rule is matched
  --triggerType <PRICE_TARGET|MOVING_AVERAGE>
  --direction <ABOVE|BELOW>
  --quantity <number>                Shares per execution
  --start <YYYY-MM-DD>
  --end <YYYY-MM-DD>

Conditional required:
  --targetPrice <number>             Required when --triggerType PRICE_TARGET
  --movingAverageDays <int>          Required when --triggerType MOVING_AVERAGE

Optional:
  --initialCash <number>             Default: 10000
  --initialShares <number>           Default: 0
  --mode <once|repeat>               Default: repeat

Examples:
  # Auto-BUY when price <= 170
  npm run backtest:auto-buy-sell -- --symbol AAPL --action BUY --triggerType PRICE_TARGET --direction BELOW --targetPrice 170 --quantity 5 --start 2025-01-01 --end 2025-12-31

  # Auto-SELL when price >= 220
  npm run backtest:auto-buy-sell -- --symbol AAPL --action SELL --triggerType PRICE_TARGET --direction ABOVE --targetPrice 220 --quantity 5 --start 2025-01-01 --end 2025-12-31 --initialShares 20

  # Auto-BUY when price crosses below 20-day moving average
  npm run backtest:auto-buy-sell -- --symbol AAPL --action BUY --triggerType MOVING_AVERAGE --direction BELOW --movingAverageDays 20 --quantity 2 --start 2025-01-01 --end 2025-12-31
`);
}

function parseRawArgs(argv: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;

    const withoutPrefix = token.slice(2);
    const eqIndex = withoutPrefix.indexOf("=");

    if (eqIndex >= 0) {
      const key = withoutPrefix.slice(0, eqIndex).trim();
      const value = withoutPrefix.slice(eqIndex + 1).trim();
      if (key) parsed[key] = value;
      continue;
    }

    const key = withoutPrefix.trim();
    const nextToken = argv[index + 1];
    if (!nextToken || nextToken.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }

    parsed[key] = nextToken;
    index += 1;
  }

  return parsed;
}

function parsePositiveNumber(value: string | undefined, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive number`);
  }
  return parsed;
}

function parseNonNegativeNumber(value: string | undefined, defaultValue: number, fieldName: string): number {
  if (value === undefined) return defaultValue;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative number`);
  }
  return parsed;
}

function parseDateToUnix(value: string, fieldName: string, endOfDay: boolean): number {
  const suffix = endOfDay ? "T23:59:59Z" : "T00:00:00Z";
  const timestamp = Date.parse(`${value}${suffix}`);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`${fieldName} must be in YYYY-MM-DD format`);
  }
  return Math.floor(timestamp / 1000);
}

function buildArgs(argv: string[]): BacktestArgs {
  const raw = parseRawArgs(argv);

  if (raw.help === "true" || raw.h === "true") {
    printHelp();
    process.exit(0);
  }

  const symbol = String(raw.symbol || "").trim().toUpperCase();
  if (!symbol) {
    throw new Error("--symbol is required");
  }

  const actionRaw = String(raw.action || "").trim().toUpperCase();
  if (actionRaw !== "BUY" && actionRaw !== "SELL") {
    throw new Error("--action must be BUY or SELL");
  }

  const triggerTypeRaw = String(raw.triggerType || "").trim().toUpperCase();
  if (triggerTypeRaw !== "PRICE_TARGET" && triggerTypeRaw !== "MOVING_AVERAGE") {
    throw new Error("--triggerType must be PRICE_TARGET or MOVING_AVERAGE");
  }

  const directionRaw = String(raw.direction || "").trim().toUpperCase();
  if (directionRaw !== "ABOVE" && directionRaw !== "BELOW") {
    throw new Error("--direction must be ABOVE or BELOW");
  }

  const start = String(raw.start || "").trim();
  const end = String(raw.end || "").trim();
  if (!start || !end) {
    throw new Error("--start and --end are required (YYYY-MM-DD)");
  }

  const quantity = parsePositiveNumber(raw.quantity, "--quantity");
  const initialCash = parseNonNegativeNumber(raw.initialCash, 10000, "--initialCash");
  const initialShares = parseNonNegativeNumber(raw.initialShares, 0, "--initialShares");

  const modeRaw = String(raw.mode || "repeat").trim().toLowerCase();
  if (modeRaw !== "once" && modeRaw !== "repeat") {
    throw new Error("--mode must be once or repeat");
  }

  let targetPrice: number | null = null;
  let movingAverageDays: number | null = null;

  if (triggerTypeRaw === "PRICE_TARGET") {
    targetPrice = parsePositiveNumber(raw.targetPrice, "--targetPrice");
  }

  if (triggerTypeRaw === "MOVING_AVERAGE") {
    movingAverageDays = Math.floor(parsePositiveNumber(raw.movingAverageDays, "--movingAverageDays"));
    if (movingAverageDays < 2) {
      throw new Error("--movingAverageDays must be >= 2");
    }
  }

  const startUnix = parseDateToUnix(start, "--start", false);
  const endUnix = parseDateToUnix(end, "--end", true);
  if (startUnix >= endUnix) {
    throw new Error("--start must be before --end");
  }

  return {
    symbol,
    action: actionRaw,
    triggerType: triggerTypeRaw,
    direction: directionRaw,
    targetPrice,
    movingAverageDays,
    quantity,
    start,
    end,
    initialCash,
    initialShares,
    mode: modeRaw,
  };
}

function isTriggered(direction: TriggerDirection, currentPrice: number, triggerValue: number): boolean {
  if (direction === "ABOVE") return currentPrice >= triggerValue;
  return currentPrice <= triggerValue;
}

function toISODate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

async function fetchDailyPrices(symbol: string, start: string, end: string): Promise<PricePoint[]> {
  const from = parseDateToUnix(start, "--start", false);
  const to = parseDateToUnix(end, "--end", true);

  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (finnhubKey) {
    const finnhubUrl = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&token=${finnhubKey}`;
    const finnhubResponse = await fetch(finnhubUrl, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (finnhubResponse.ok) {
      const finnhubData = (await finnhubResponse.json()) as { s?: string; c?: unknown[]; t?: unknown[] };
      if (finnhubData.s === "ok" && Array.isArray(finnhubData.c) && Array.isArray(finnhubData.t)) {
        const finnhubPoints: PricePoint[] = [];
        for (let index = 0; index < finnhubData.c.length; index += 1) {
          const close = Number(finnhubData.c[index]);
          const timestamp = Number(finnhubData.t[index]);
          if (!Number.isFinite(close) || close <= 0) continue;
          if (!Number.isFinite(timestamp) || timestamp <= 0) continue;
          finnhubPoints.push({ timestamp, close });
        }

        if (finnhubPoints.length > 0) {
          finnhubPoints.sort((left, right) => left.timestamp - right.timestamp);
          return finnhubPoints;
        }
      }
    }

    console.warn("[backtest] Finnhub unavailable, falling back to Yahoo Finance");
  }

  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${from}&period2=${to}&interval=1d`;
  const yahooResponse = await fetch(yahooUrl, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!yahooResponse.ok) {
    throw new Error(`Yahoo Finance chart API failed: ${yahooResponse.status}`);
  }

  type YahooChartPayload = {
    chart?: {
      result?: Array<{
        timestamp?: unknown[];
        indicators?: {
          quote?: Array<{
            close?: unknown[];
          }>;
        };
      }>;
      error?: unknown;
    };
  };

  const yahooData = (await yahooResponse.json()) as YahooChartPayload;
  const result = yahooData.chart?.result?.[0];
  const timestamps = result?.timestamp;
  const closes = result?.indicators?.quote?.[0]?.close;

  if (!Array.isArray(timestamps) || !Array.isArray(closes)) {
    throw new Error("Yahoo Finance returned no valid candle data for this range");
  }

  const yahooPoints: PricePoint[] = [];
  const length = Math.min(timestamps.length, closes.length);
  for (let index = 0; index < length; index += 1) {
    const timestamp = Number(timestamps[index]);
    const close = Number(closes[index]);
    if (!Number.isFinite(close) || close <= 0) continue;
    if (!Number.isFinite(timestamp) || timestamp <= 0) continue;
    yahooPoints.push({ timestamp, close });
  }

  yahooPoints.sort((left, right) => left.timestamp - right.timestamp);
  return yahooPoints;
}

function calcMaxDrawdown(equityCurve: number[]): number {
  if (equityCurve.length === 0) return 0;

  let peak = equityCurve[0];
  let maxDrawdown = 0;

  for (const equity of equityCurve) {
    if (equity > peak) peak = equity;
    const drawdown = peak > 0 ? (peak - equity) / peak : 0;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  return maxDrawdown;
}

async function runBacktest(args: BacktestArgs) {
  const prices = await fetchDailyPrices(args.symbol, args.start, args.end);
  if (prices.length === 0) {
    throw new Error("No price points found in the selected range");
  }

  let cash = args.initialCash;
  let shares = args.initialShares;
  const trades: TradeLog[] = [];
  const skippedMatches: SkipLog[] = [];
  const equityCurve: number[] = [];

  for (let index = 0; index < prices.length; index += 1) {
    const point = prices[index];
    const triggerValue = args.triggerType === "PRICE_TARGET"
      ? args.targetPrice
      : index + 1 >= (args.movingAverageDays || 0)
        ? prices
            .slice(index + 1 - (args.movingAverageDays || 0), index + 1)
            .reduce((sum, item) => sum + item.close, 0) / (args.movingAverageDays || 1)
        : null;

    const matched = triggerValue !== null && isTriggered(args.direction, point.close, triggerValue);

    if (matched) {
      if (args.action === "BUY") {
        const requiredCash = point.close * args.quantity;
        if (cash >= requiredCash) {
          cash -= requiredCash;
          shares += args.quantity;
          trades.push({
            date: toISODate(point.timestamp),
            action: "BUY",
            price: point.close,
            quantity: args.quantity,
            cashAfter: cash,
            sharesAfter: shares,
            triggerValue,
          });
        } else {
          skippedMatches.push({
            date: toISODate(point.timestamp),
            reason: `Insufficient cash (need ${requiredCash.toFixed(2)}, have ${cash.toFixed(2)})`,
            price: point.close,
            triggerValue,
          });
        }
      } else {
        if (shares >= args.quantity) {
          const proceeds = point.close * args.quantity;
          cash += proceeds;
          shares -= args.quantity;
          trades.push({
            date: toISODate(point.timestamp),
            action: "SELL",
            price: point.close,
            quantity: args.quantity,
            cashAfter: cash,
            sharesAfter: shares,
            triggerValue,
          });
        } else {
          skippedMatches.push({
            date: toISODate(point.timestamp),
            reason: `Insufficient shares (need ${args.quantity}, have ${shares})`,
            price: point.close,
            triggerValue,
          });
        }
      }

      if (args.mode === "once") {
        equityCurve.push(cash + shares * point.close);
        break;
      }
    }

    equityCurve.push(cash + shares * point.close);
  }

  const firstPrice = prices[0].close;
  const lastPrice = prices[prices.length - 1].close;
  const initialEquity = args.initialCash + args.initialShares * firstPrice;
  const finalEquity = cash + shares * lastPrice;
  const netPnL = finalEquity - initialEquity;
  const returnPct = initialEquity > 0 ? (netPnL / initialEquity) * 100 : 0;
  const maxDrawdownPct = calcMaxDrawdown(equityCurve) * 100;

  console.log(
    JSON.stringify(
      {
        config: args,
        market: {
          points: prices.length,
          startDate: toISODate(prices[0].timestamp),
          endDate: toISODate(prices[prices.length - 1].timestamp),
          firstClose: Number(firstPrice.toFixed(4)),
          lastClose: Number(lastPrice.toFixed(4)),
        },
        result: {
          tradesExecuted: trades.length,
          matchedButSkipped: skippedMatches.length,
          endingCash: Number(cash.toFixed(4)),
          endingShares: Number(shares.toFixed(4)),
          initialEquity: Number(initialEquity.toFixed(4)),
          finalEquity: Number(finalEquity.toFixed(4)),
          netPnL: Number(netPnL.toFixed(4)),
          returnPct: Number(returnPct.toFixed(4)),
          maxDrawdownPct: Number(maxDrawdownPct.toFixed(4)),
        },
        trades,
        skippedMatches,
      },
      null,
      2,
    ),
  );
}

async function main() {
  const args = buildArgs(process.argv.slice(2));
  await runBacktest(args);
}

main().catch((error) => {
  console.error("BACKTEST_AUTO_BUY_SELL_FAILED", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});