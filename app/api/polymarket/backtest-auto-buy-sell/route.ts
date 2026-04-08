import { NextRequest, NextResponse } from "next/server";

type AutoTradeAction = "BUY" | "SELL" | "BOTH";
type TriggerType = "PRICE_TARGET" | "MOVING_AVERAGE";
type TriggerDirection = "ABOVE" | "BELOW";
type BacktestMode = "once" | "repeat";

type BacktestRequest = {
  marketId: string;
  action: AutoTradeAction;
  triggerType: TriggerType;
  direction: TriggerDirection;
  targetPrice?: number | null;
  buyTargetPrice?: number | null;
  sellTargetPrice?: number | null;
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

async function resolveFromDirectMarketLookup(inputId: string): Promise<string | null> {
  const target = inputId.trim();
  if (!target) return null;

  try {
    const response = await fetch(`${GAMMA_API}/markets/${encodeURIComponent(target)}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return null;
    }

    const market = (await response.json()) as unknown;
    if (!isRecord(market)) return null;

    const clobIds = parseStringArray(market.clobTokenIds).map((id) => id.trim()).filter(Boolean);
    if (clobIds.includes(target)) return target;
    if (clobIds.length > 0) return clobIds[0];

    const conditionId = String(market.conditionId || "").trim();
    if (conditionId === target) return target;
  } catch {
    // Fall through to event-scan resolver.
  }

  return null;
}

async function resolveClobTokenId(inputId: string): Promise<string | null> {
  const target = inputId.trim();
  if (!target) return null;

  const directResolved = await resolveFromDirectMarketLookup(target);
  if (directResolved) {
    return directResolved;
  }

  for (const closed of ["false", "true"]) {
    for (let offset = 0; offset <= 5000; offset += 500) {
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

async function fetchPolymarketHistory(marketId: string): Promise<{ points: PricePoint[]; resolvedMarketId: string }> {
  const candidateIds: string[] = [];
  const normalizedInput = marketId.trim();
  if (normalizedInput) {
    candidateIds.push(normalizedInput);
  }

  const resolvedTokenId = await resolveClobTokenId(marketId);
  if (resolvedTokenId) {
    candidateIds.unshift(resolvedTokenId);
  }

  for (const candidate of Array.from(new Set(candidateIds))) {
    if (!candidate) continue;
    const points = await fetchHistoryForMarketId(candidate);
    if (points.length > 0) {
      return { points, resolvedMarketId: candidate };
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
  if (action !== "BUY" && action !== "SELL" && action !== "BOTH") {
    throw new Error("action must be BUY, SELL, or BOTH");
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
  const buyTargetPrice = body.buyTargetPrice == null ? null : Number(body.buyTargetPrice);
  const sellTargetPrice = body.sellTargetPrice == null ? null : Number(body.sellTargetPrice);
  const movingAverageDays = body.movingAverageDays == null ? null : Math.floor(Number(body.movingAverageDays));

  if (triggerType === "PRICE_TARGET") {
    if (action === "BOTH") {
      if (!Number.isFinite(buyTargetPrice) || (buyTargetPrice || 0) <= 0 || (buyTargetPrice || 0) >= 1) {
        throw new Error("buyTargetPrice must be between 0 and 1 for BOTH + PRICE_TARGET");
      }
      if (!Number.isFinite(sellTargetPrice) || (sellTargetPrice || 0) <= 0 || (sellTargetPrice || 0) >= 1) {
        throw new Error("sellTargetPrice must be between 0 and 1 for BOTH + PRICE_TARGET");
      }
      if ((buyTargetPrice || 0) >= (sellTargetPrice || 0)) {
        throw new Error("buyTargetPrice must be lower than sellTargetPrice");
      }
    } else if (!Number.isFinite(targetPrice) || (targetPrice || 0) <= 0 || (targetPrice || 0) >= 1) {
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
    buyTargetPrice,
    sellTargetPrice,
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

    const resolvedHistory = await fetchPolymarketHistory(config.marketId);
    const prices = resolvedHistory.points.filter((point) => point.timestamp >= config.startUnix && point.timestamp <= config.endUnix);

    if (prices.length === 0) {
      return NextResponse.json({ error: "No Polymarket history points found in selected date range" }, { status: 400 });
    }

    const firstPrice = prices[0].price;

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
    let matchedSignals = 0;
    let totalBoughtCost = 0;
    let totalBoughtQty = 0;
    let totalSoldProceeds = 0;
    let totalSoldQty = 0;
    let buyTrades = 0;
    let sellTrades = 0;
    let realizedPnL = 0;
    let positionAvgCost = config.initialPosition > 0 ? firstPrice : 0;

    for (let index = 0; index < prices.length; index += 1) {
      const point = prices[index];
      const triggerValue = config.triggerType === "PRICE_TARGET"
        ? config.targetPrice
        : index + 1 >= (config.movingAverageDays || 0)
          ? prices
            .slice(index + 1 - (config.movingAverageDays || 0), index + 1)
            .reduce((sum, item) => sum + item.price, 0) / (config.movingAverageDays || 1)
          : null;

      let buyMatched = false;
      let sellMatched = false;
      let buyTriggerForLog: number | null = triggerValue;
      let sellTriggerForLog: number | null = triggerValue;

      if (config.action === "BOTH" && config.triggerType === "PRICE_TARGET") {
        buyTriggerForLog = config.buyTargetPrice;
        sellTriggerForLog = config.sellTargetPrice;
        buyMatched = buyTriggerForLog !== null && point.price <= buyTriggerForLog;
        sellMatched = sellTriggerForLog !== null && point.price >= sellTriggerForLog;
      } else {
        const oppositeDirection: TriggerDirection = config.direction === "ABOVE" ? "BELOW" : "ABOVE";
        const primaryMatched = triggerValue !== null && isTriggered(config.direction, point.price, triggerValue);
        const oppositeMatched = triggerValue !== null && isTriggered(oppositeDirection, point.price, triggerValue);

        if (config.action === "BUY") {
          buyMatched = primaryMatched;
        } else if (config.action === "SELL") {
          sellMatched = primaryMatched;
        } else {
          buyMatched = primaryMatched;
          sellMatched = oppositeMatched;
        }
      }

      if (buyMatched || sellMatched) {
        if (config.action === "BUY") {
          if (buyMatched) {
            matchedSignals += 1;
            const requiredCash = point.price * config.quantity;
            if (cash >= requiredCash) {
              const prevPosition = position;
              const prevCostBasis = positionAvgCost;
              cash -= requiredCash;
              position += config.quantity;
              positionAvgCost = position > 0
                ? ((prevPosition * prevCostBasis) + requiredCash) / position
                : 0;
              totalBoughtCost += requiredCash;
              totalBoughtQty += config.quantity;
              buyTrades += 1;
              trades.push({
                date: toISODateTime(point.timestamp),
                action: "BUY",
                price: point.price,
                quantity: config.quantity,
                cashAfter: cash,
                positionAfter: position,
                triggerValue: buyTriggerForLog as number,
              });
            } else {
              skippedMatches.push({
                date: toISODateTime(point.timestamp),
                reason: `Insufficient cash (need ${requiredCash.toFixed(4)}, have ${cash.toFixed(4)})`,
                price: point.price,
                triggerValue: buyTriggerForLog as number,
              });
            }
          }
        } else if (config.action === "SELL") {
          if (sellMatched) {
            matchedSignals += 1;
            if (position >= config.quantity) {
              const proceeds = point.price * config.quantity;
              cash += proceeds;
              position -= config.quantity;
              realizedPnL += (point.price - positionAvgCost) * config.quantity;
              if (position <= 0) {
                position = 0;
                positionAvgCost = 0;
              }
              totalSoldProceeds += proceeds;
              totalSoldQty += config.quantity;
              sellTrades += 1;
              trades.push({
                date: toISODateTime(point.timestamp),
                action: "SELL",
                price: point.price,
                quantity: config.quantity,
                cashAfter: cash,
                positionAfter: position,
                triggerValue: sellTriggerForLog as number,
              });
            } else {
              skippedMatches.push({
                date: toISODateTime(point.timestamp),
                reason: `Insufficient position (need ${config.quantity}, have ${position})`,
                price: point.price,
                triggerValue: sellTriggerForLog as number,
              });
            }
          }
        } else {
          const shouldSell = sellMatched && position >= config.quantity;
          const shouldBuy = buyMatched && cash >= point.price * config.quantity;

          matchedSignals += (sellMatched ? 1 : 0) + (buyMatched ? 1 : 0);

          if (shouldSell) {
            const proceeds = point.price * config.quantity;
            cash += proceeds;
            position -= config.quantity;
            realizedPnL += (point.price - positionAvgCost) * config.quantity;
            if (position <= 0) {
              position = 0;
              positionAvgCost = 0;
            }
            totalSoldProceeds += proceeds;
            totalSoldQty += config.quantity;
            sellTrades += 1;
            trades.push({
              date: toISODateTime(point.timestamp),
              action: "SELL",
              price: point.price,
              quantity: config.quantity,
              cashAfter: cash,
              positionAfter: position,
              triggerValue: sellTriggerForLog as number,
            });
          } else if (shouldBuy) {
            const requiredCash = point.price * config.quantity;
            const prevPosition = position;
            const prevCostBasis = positionAvgCost;
            cash -= requiredCash;
            position += config.quantity;
            positionAvgCost = position > 0
              ? ((prevPosition * prevCostBasis) + requiredCash) / position
              : 0;
            totalBoughtCost += requiredCash;
            totalBoughtQty += config.quantity;
            buyTrades += 1;
            trades.push({
              date: toISODateTime(point.timestamp),
              action: "BUY",
              price: point.price,
              quantity: config.quantity,
              cashAfter: cash,
              positionAfter: position,
              triggerValue: buyTriggerForLog as number,
            });
          } else if (sellMatched && position < config.quantity) {
            skippedMatches.push({
              date: toISODateTime(point.timestamp),
              reason: `Insufficient position for BOTH sell leg (need ${config.quantity}, have ${position})`,
              price: point.price,
              triggerValue: sellTriggerForLog as number,
            });
          } else if (buyMatched && cash < point.price * config.quantity) {
            skippedMatches.push({
              date: toISODateTime(point.timestamp),
              reason: `Insufficient cash for BOTH buy leg (need ${(point.price * config.quantity).toFixed(4)}, have ${cash.toFixed(4)})`,
              price: point.price,
              triggerValue: buyTriggerForLog as number,
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

    const lastPrice = prices[prices.length - 1].price;
    const lowPrice = prices.reduce((min, point) => Math.min(min, point.price), prices[0].price);
    const highPrice = prices.reduce((max, point) => Math.max(max, point.price), prices[0].price);
    const initialEquity = config.initialCash + config.initialPosition * firstPrice;
    const finalEquity = cash + position * lastPrice;
    const netPnL = finalEquity - initialEquity;
    const returnPct = initialEquity > 0 ? (netPnL / initialEquity) * 100 : 0;
    const maxDrawdownPct = calcMaxDrawdown(equityCurve) * 100;
    const endingPositionValue = position * lastPrice;
    const openingPositionValue = config.initialPosition * firstPrice;
    const tradingCashDelta = cash - config.initialCash;
    const positionMarkToMarketDelta = endingPositionValue - openingPositionValue;
    const buyAndHoldFinalEquity = firstPrice > 0 ? (initialEquity / firstPrice) * lastPrice : initialEquity;
    const buyAndHoldNetPnL = buyAndHoldFinalEquity - initialEquity;
    const buyAndHoldReturnPct = initialEquity > 0 ? (buyAndHoldNetPnL / initialEquity) * 100 : 0;
    const vsBuyAndHoldPct = returnPct - buyAndHoldReturnPct;
    const utilizationPct = config.initialCash > 0 ? Math.min(100, (totalBoughtCost / config.initialCash) * 100) : 0;
    const unrealizedPnL = position > 0 ? (lastPrice - positionAvgCost) * position : 0;

    const topSkipReasons = Array.from(
      skippedMatches.reduce((bucket, item) => {
        const normalized = item.reason.split("(")[0]?.trim() || item.reason;
        bucket.set(normalized, (bucket.get(normalized) || 0) + 1);
        return bucket;
      }, new Map<string, number>())
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([reason, count]) => ({ reason, count }));

    const insights: string[] = [];
    if (netPnL > 0) {
      insights.push(`Strategy ended profitable (+${returnPct.toFixed(2)}%), final equity ${finalEquity.toFixed(2)}.`);
    } else if (netPnL < 0) {
      insights.push(`Strategy ended at a loss (${returnPct.toFixed(2)}%), final equity ${finalEquity.toFixed(2)}.`);
    } else {
      insights.push("Strategy ended roughly flat.");
    }

    insights.push(`Signals matched ${matchedSignals} times; executed ${trades.length} trades and skipped ${skippedMatches.length}.`);

    if (topSkipReasons.length > 0) {
      insights.push(`Main skipped reason: ${topSkipReasons[0].reason} (${topSkipReasons[0].count} times).`);
    }

    insights.push(`Executed ${buyTrades} buy trades and ${sellTrades} sell trades.`);
    insights.push(`Realized PnL ${realizedPnL >= 0 ? "+" : ""}${realizedPnL.toFixed(2)}, unrealized PnL ${unrealizedPnL >= 0 ? "+" : ""}${unrealizedPnL.toFixed(2)}.`);

    if (config.action === "BOTH") {
      if (config.triggerType === "PRICE_TARGET") {
        insights.push(`BOTH mode uses dual lines: BUY at <= ${Number(config.buyTargetPrice || 0).toFixed(4)}, SELL at >= ${Number(config.sellTargetPrice || 0).toFixed(4)}.`);
      } else {
        insights.push(`BOTH mode uses selected direction for BUY entries and opposite direction for SELL exits.`);
      }
    }

    if (Math.abs(vsBuyAndHoldPct) >= 0.01) {
      insights.push(
        vsBuyAndHoldPct >= 0
          ? `Outperformed buy-and-hold by ${vsBuyAndHoldPct.toFixed(2)} percentage points.`
          : `Underperformed buy-and-hold by ${Math.abs(vsBuyAndHoldPct).toFixed(2)} percentage points.`
      );
    }

    insights.push(`Capital usage: spent ${totalBoughtCost.toFixed(2)} from initial cash ${config.initialCash.toFixed(2)} (${utilizationPct.toFixed(1)}% utilized).`);

    return NextResponse.json({
      config: {
        marketId: config.marketId,
        action: config.action,
        triggerType: config.triggerType,
        direction: config.direction,
        targetPrice: config.targetPrice,
        buyTargetPrice: config.buyTargetPrice,
        sellTargetPrice: config.sellTargetPrice,
        movingAverageDays: config.movingAverageDays,
        quantity: config.quantity,
        start: config.start,
        end: config.end,
        initialCash: config.initialCash,
        initialPosition: config.initialPosition,
        mode: config.mode,
      },
      market: {
        resolvedMarketId: resolvedHistory.resolvedMarketId,
        points: prices.length,
        startDate: toISODateTime(prices[0].timestamp),
        endDate: toISODateTime(prices[prices.length - 1].timestamp),
        firstPrice: Number(firstPrice.toFixed(6)),
        lastPrice: Number(lastPrice.toFixed(6)),
        lowPrice: Number(lowPrice.toFixed(6)),
        highPrice: Number(highPrice.toFixed(6)),
      },
      result: {
        matchedSignals,
        tradesExecuted: trades.length,
        matchedButSkipped: skippedMatches.length,
        buyTrades,
        sellTrades,
        totalBoughtCost: Number(totalBoughtCost.toFixed(6)),
        totalBoughtQty: Number(totalBoughtQty.toFixed(6)),
        totalSoldProceeds: Number(totalSoldProceeds.toFixed(6)),
        totalSoldQty: Number(totalSoldQty.toFixed(6)),
        endingCash: Number(cash.toFixed(6)),
        endingPosition: Number(position.toFixed(6)),
        endingPositionValue: Number(endingPositionValue.toFixed(6)),
        realizedPnL: Number(realizedPnL.toFixed(6)),
        unrealizedPnL: Number(unrealizedPnL.toFixed(6)),
        tradingCashDelta: Number(tradingCashDelta.toFixed(6)),
        positionMarkToMarketDelta: Number(positionMarkToMarketDelta.toFixed(6)),
        initialEquity: Number(initialEquity.toFixed(6)),
        finalEquity: Number(finalEquity.toFixed(6)),
        netPnL: Number(netPnL.toFixed(6)),
        returnPct: Number(returnPct.toFixed(4)),
        buyAndHoldFinalEquity: Number(buyAndHoldFinalEquity.toFixed(6)),
        buyAndHoldNetPnL: Number(buyAndHoldNetPnL.toFixed(6)),
        buyAndHoldReturnPct: Number(buyAndHoldReturnPct.toFixed(4)),
        vsBuyAndHoldPct: Number(vsBuyAndHoldPct.toFixed(4)),
        maxDrawdownPct: Number(maxDrawdownPct.toFixed(4)),
      },
      skipReasonSummary: topSkipReasons,
      insights,
      trades,
      skippedMatches,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run backtest";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
