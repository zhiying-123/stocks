import { NextRequest, NextResponse } from "next/server";

type AutoTradeAction = "BUY" | "SELL";
type TriggerType = "PRICE_TARGET" | "MOVING_AVERAGE";
type TriggerDirection = "ABOVE" | "BELOW";
type BacktestMode = "once" | "repeat";

type BacktestRequest = {
  marketId: string;
  action: AutoTradeAction;
  triggerType: TriggerType;
  direction: TriggerDirection;
  targetPrice?: number | null;
  movingAverageDays?: number | null;
  quantity: number;
  start: string;
  end: string;
  initialCash?: number;
  initialPosition?: number;
  mode?: BacktestMode;
};

type PricePoint = {
  timestamp: number;
  price: number;
};

const CLOB_API = "https://clob.polymarket.com";
const GAMMA_API = "https://gamma-api.polymarket.com";

function parseStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseDateToUnix(value: string, fieldName: string, endOfDay: boolean): number {
  const suffix = endOfDay ? "T23:59:59Z" : "T00:00:00Z";
  const timestamp = Date.parse(`${value}${suffix}`);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`${fieldName} must be in YYYY-MM-DD format`);
  }
  return Math.floor(timestamp / 1000);
}

function getTodayDateStringUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function isTriggered(direction: TriggerDirection, currentPrice: number, triggerValue: number): boolean {
  if (direction === "ABOVE") return currentPrice >= triggerValue;
  return currentPrice <= triggerValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getRecordField(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in record) return record[key];
  }
  return undefined;
}

function normalizePriceHistory(raw: unknown): PricePoint[] {
  let rows: unknown[] = [];

  if (Array.isArray(raw)) {
    rows = raw;
  } else if (isRecord(raw)) {
    const history = raw.history;
    if (Array.isArray(history)) {
      rows = history;
    } else {
      for (const value of Object.values(raw)) {
        if (Array.isArray(value) && value.length > 0) {
          rows = value;
          break;
        }
      }
    }
  }

  const points: PricePoint[] = [];

  for (const row of rows) {
    let tRaw: unknown;
    let pRaw: unknown;

    if (Array.isArray(row)) {
      tRaw = row[0];
      pRaw = row[1];
    } else if (isRecord(row)) {
      tRaw = getRecordField(row, ["t", "timestamp", "time"]);
      pRaw = getRecordField(row, ["p", "price"]);
    } else {
      continue;
    }

    const tNum = Number(tRaw);
    const pNum = Number(pRaw);
    if (!Number.isFinite(tNum) || !Number.isFinite(pNum)) continue;
    if (pNum <= 0) continue;

    const timestamp = tNum < 1e12 ? Math.floor(tNum) : Math.floor(tNum / 1000);
    points.push({ timestamp, price: pNum });
  }

  points.sort((a, b) => a.timestamp - b.timestamp);
  return points;
}

async function fetchHistoryForMarketId(marketId: string): Promise<PricePoint[]> {
  const response = await fetch(`${CLOB_API}/prices-history?market=${encodeURIComponent(marketId)}&interval=all`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return [];
  }

  const raw = (await response.json()) as unknown;
  return normalizePriceHistory(raw);
}

async function resolveClobTokenId(inputId: string): Promise<string | null> {
  const target = inputId.trim();
  if (!target) return null;

  for (const closed of ["false", "true"]) {
    for (let offset = 0; offset <= 1000; offset += 500) {
      try {
        const response = await fetch(`${GAMMA_API}/events?limit=500&offset=${offset}&closed=${closed}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          break;
        }

        const data = (await response.json()) as unknown;
        if (!Array.isArray(data) || data.length === 0) {
          break;
        }

        for (const event of data) {
          if (!isRecord(event)) continue;
          const markets = event.markets;
          if (!Array.isArray(markets)) continue;

          for (const market of markets) {
            if (!isRecord(market)) continue;
            const marketId = String(market.id || "").trim();
            const conditionId = String(market.conditionId || "").trim();
            const clobIds = parseStringArray(market.clobTokenIds).map((id) => id.trim()).filter(Boolean);

            if (clobIds.includes(target)) {
              return target;
            }

            if (target === marketId || target === conditionId) {
              return clobIds[0] || null;
            }
          }
        }
      } catch {
        break;
      }
    }
  }

  return null;
}

async function fetchPolymarketHistory(marketId: string): Promise<PricePoint[]> {
  const candidateIds = new Set<string>([marketId.trim()]);
  const resolvedTokenId = await resolveClobTokenId(marketId);
  if (resolvedTokenId) {
    candidateIds.add(resolvedTokenId);
  }

  for (const candidate of candidateIds) {
    if (!candidate) continue;
    const points = await fetchHistoryForMarketId(candidate);
    if (points.length > 0) {
      return points;
    }
  }

  throw new Error("Polymarket history returned no usable price points for this market identifier");
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

function toISODateTime(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
}

function validateRequest(body: BacktestRequest) {
  const marketId = String(body.marketId || "").trim();
  if (!marketId) throw new Error("marketId is required");

  const action = String(body.action || "").toUpperCase();
  if (action !== "BUY" && action !== "SELL") {
    throw new Error("action must be BUY or SELL");
  }

  const triggerType = String(body.triggerType || "").toUpperCase();
  if (triggerType !== "PRICE_TARGET" && triggerType !== "MOVING_AVERAGE") {
    throw new Error("triggerType must be PRICE_TARGET or MOVING_AVERAGE");
  }

  const direction = String(body.direction || "").toUpperCase();
  if (direction !== "ABOVE" && direction !== "BELOW") {
    throw new Error("direction must be ABOVE or BELOW");
  }

  const quantity = Number(body.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("quantity must be a positive number");
  }

  const start = String(body.start || "").trim();
  const end = String(body.end || "").trim();
  if (!start || !end) {
    throw new Error("start and end are required");
  }

  const startUnix = parseDateToUnix(start, "start", false);
  const endUnix = parseDateToUnix(end, "end", true);
  if (startUnix >= endUnix) {
    throw new Error("start must be before end");
  }

  const today = getTodayDateStringUTC();
  if (start > today || end > today) {
    throw new Error("start and end cannot be in the future");
  }

  const initialCash = Number(body.initialCash ?? 1000);
  const initialPosition = Number(body.initialPosition ?? 0);
  if (!Number.isFinite(initialCash) || initialCash < 0) {
    throw new Error("initialCash must be non-negative");
  }
  if (!Number.isFinite(initialPosition) || initialPosition < 0) {
    throw new Error("initialPosition must be non-negative");
  }

  const mode = String(body.mode || "repeat").toLowerCase();
  if (mode !== "once" && mode !== "repeat") {
    throw new Error("mode must be once or repeat");
  }

  const targetPrice = body.targetPrice == null ? null : Number(body.targetPrice);
  const movingAverageDays = body.movingAverageDays == null ? null : Math.floor(Number(body.movingAverageDays));

  if (triggerType === "PRICE_TARGET") {
    if (!Number.isFinite(targetPrice) || (targetPrice || 0) <= 0 || (targetPrice || 0) >= 1) {
      throw new Error("targetPrice must be between 0 and 1 for PRICE_TARGET");
    }
  }

  if (triggerType === "MOVING_AVERAGE") {
    if (!Number.isFinite(movingAverageDays) || (movingAverageDays || 0) < 2) {
      throw new Error("movingAverageDays must be >= 2 for MOVING_AVERAGE");
    }
  }

  return {
    marketId,
    action: action as AutoTradeAction,
    triggerType: triggerType as TriggerType,
    direction: direction as TriggerDirection,
    quantity,
    start,
    end,
    targetPrice,
    movingAverageDays,
    initialCash,
    initialPosition,
    mode: mode as BacktestMode,
    startUnix,
    endUnix,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BacktestRequest;
    const config = validateRequest(body);

    const fullHistory = await fetchPolymarketHistory(config.marketId);
    const prices = fullHistory.filter((point) => point.timestamp >= config.startUnix && point.timestamp <= config.endUnix);

    if (prices.length === 0) {
      return NextResponse.json({ error: "No Polymarket history points found in selected date range" }, { status: 400 });
    }

    let cash = config.initialCash;
    let position = config.initialPosition;
    const trades: Array<{
      date: string;
      action: AutoTradeAction;
      price: number;
      quantity: number;
      cashAfter: number;
      positionAfter: number;
      triggerValue: number;
    }> = [];
    const skippedMatches: Array<{
      date: string;
      reason: string;
      price: number;
      triggerValue: number;
    }> = [];
    const equityCurve: number[] = [];

    for (let index = 0; index < prices.length; index += 1) {
      const point = prices[index];
      const triggerValue = config.triggerType === "PRICE_TARGET"
        ? config.targetPrice
        : index + 1 >= (config.movingAverageDays || 0)
          ? prices
            .slice(index + 1 - (config.movingAverageDays || 0), index + 1)
            .reduce((sum, item) => sum + item.price, 0) / (config.movingAverageDays || 1)
          : null;

      const matched = triggerValue !== null && isTriggered(config.direction, point.price, triggerValue);

      if (matched) {
        if (config.action === "BUY") {
          const requiredCash = point.price * config.quantity;
          if (cash >= requiredCash) {
            cash -= requiredCash;
            position += config.quantity;
            trades.push({
              date: toISODateTime(point.timestamp),
              action: "BUY",
              price: point.price,
              quantity: config.quantity,
              cashAfter: cash,
              positionAfter: position,
              triggerValue,
            });
          } else {
            skippedMatches.push({
              date: toISODateTime(point.timestamp),
              reason: `Insufficient cash (need ${requiredCash.toFixed(4)}, have ${cash.toFixed(4)})`,
              price: point.price,
              triggerValue,
            });
          }
        } else {
          if (position >= config.quantity) {
            const proceeds = point.price * config.quantity;
            cash += proceeds;
            position -= config.quantity;
            trades.push({
              date: toISODateTime(point.timestamp),
              action: "SELL",
              price: point.price,
              quantity: config.quantity,
              cashAfter: cash,
              positionAfter: position,
              triggerValue,
            });
          } else {
            skippedMatches.push({
              date: toISODateTime(point.timestamp),
              reason: `Insufficient position (need ${config.quantity}, have ${position})`,
              price: point.price,
              triggerValue,
            });
          }
        }

        if (config.mode === "once") {
          equityCurve.push(cash + position * point.price);
          break;
        }
      }

      equityCurve.push(cash + position * point.price);
    }

    const firstPrice = prices[0].price;
    const lastPrice = prices[prices.length - 1].price;
    const initialEquity = config.initialCash + config.initialPosition * firstPrice;
    const finalEquity = cash + position * lastPrice;
    const netPnL = finalEquity - initialEquity;
    const returnPct = initialEquity > 0 ? (netPnL / initialEquity) * 100 : 0;
    const maxDrawdownPct = calcMaxDrawdown(equityCurve) * 100;

    return NextResponse.json({
      config: {
        marketId: config.marketId,
        action: config.action,
        triggerType: config.triggerType,
        direction: config.direction,
        targetPrice: config.targetPrice,
        movingAverageDays: config.movingAverageDays,
        quantity: config.quantity,
        start: config.start,
        end: config.end,
        initialCash: config.initialCash,
        initialPosition: config.initialPosition,
        mode: config.mode,
      },
      market: {
        points: prices.length,
        startDate: toISODateTime(prices[0].timestamp),
        endDate: toISODateTime(prices[prices.length - 1].timestamp),
        firstPrice: Number(firstPrice.toFixed(6)),
        lastPrice: Number(lastPrice.toFixed(6)),
      },
      result: {
        tradesExecuted: trades.length,
        matchedButSkipped: skippedMatches.length,
        endingCash: Number(cash.toFixed(6)),
        endingPosition: Number(position.toFixed(6)),
        initialEquity: Number(initialEquity.toFixed(6)),
        finalEquity: Number(finalEquity.toFixed(6)),
        netPnL: Number(netPnL.toFixed(6)),
        returnPct: Number(returnPct.toFixed(4)),
        maxDrawdownPct: Number(maxDrawdownPct.toFixed(4)),
      },
      trades,
      skippedMatches,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run backtest";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
