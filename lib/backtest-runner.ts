import { NextResponse } from "next/server";

type AutoTradeAction = "BUY" | "SELL" | "BOTH";
type TriggerType = "PRICE_TARGET" | "MOVING_AVERAGE";
type TriggerDirection = "ABOVE" | "BELOW";
type BacktestMode = "once" | "repeat";

export type BacktestRequest = {
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

type PricePoint = { timestamp: number; price: number };

const CLOB_API = "https://clob.polymarket.com";
const GAMMA_API = "https://gamma-api.polymarket.com";

function parseStringArray(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((item) => String(item));
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return [];

        try {
            const parsed = JSON.parse(trimmed) as unknown;
            return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
        } catch {
            if (trimmed.includes(",")) {
                return trimmed
                    .split(",")
                    .map((item) => item.replaceAll(/^[\s"']+|[\s"']+$/g, "").trim())
                    .filter(Boolean);
            }
            return [trimmed.replaceAll(/^[\s"']+|[\s"']+$/g, "").trim()].filter(Boolean);
        }
    }
    return [];
}

function normalizeIdentifier(value: string): string {
    return value.replaceAll(/^[\s"']+|[\s"']+$/g, "").trim();
}

function parseDateToUnix(value: string, fieldName: string, endOfDay: boolean): number {
    const suffix = endOfDay ? "T23:59:59Z" : "T00:00:00Z";
    const timestamp = Date.parse(`${value}${suffix}`);
    if (!Number.isFinite(timestamp)) {
        throw new Error(`${fieldName} must be in YYYY-MM-DD format`);
    }
    return Math.floor(timestamp / 1000);
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

async function resolveFromDirectMarketLookup(inputId: string): Promise<string[]> {
    const target = inputId.trim();
    if (!target) return [];

    try {
        const response = await fetch(`${GAMMA_API}/markets/${encodeURIComponent(target)}`, {
            cache: "no-store",
            headers: { Accept: "application/json" },
        });
        if (!response.ok) return [];
        const market = await response.json();
        if (!isRecord(market)) return [];
        const clobIds = parseStringArray(market.clobTokenIds).map((id) => id.trim()).filter(Boolean);
        if (clobIds.includes(target)) {
            return [target, ...clobIds.filter((id) => id !== target)];
        }
        if (clobIds.length > 0) return clobIds;
        const conditionId = String(market.conditionId || "").trim();
        if (conditionId === target) return clobIds;
    } catch {
        // ignore
    }
    return [];
}

async function resolveClobTokenIds(inputId: string): Promise<string[]> {
    const target = normalizeIdentifier(inputId);
    if (!target) return [];

    const directResolved = await resolveFromDirectMarketLookup(target);
    if (directResolved.length > 0) return directResolved;

    for (const closed of ["false", "true"]) {
        for (let offset = 0; offset <= 5000; offset += 500) {
            try {
                const response = await fetch(`${GAMMA_API}/events?limit=500&offset=${offset}&closed=${closed}`, {
                    cache: "no-store",
                    headers: { Accept: "application/json" },
                });
                if (!response.ok) break;
                const data = (await response.json()) as unknown;
                if (!Array.isArray(data) || data.length === 0) break;
                for (const event of data) {
                    if (!isRecord(event)) continue;
                    const markets = event.markets;
                    if (!Array.isArray(markets)) continue;
                    for (const market of markets) {
                        if (!isRecord(market)) continue;
                        const marketId = String(market.id || "").trim();
                        const conditionId = String(market.conditionId || "").trim();
                        const clobIds = parseStringArray(market.clobTokenIds).map((id) => id.trim()).filter(Boolean);
                        if (clobIds.includes(target)) return [target, ...clobIds.filter((id) => id !== target)];
                        if (target === marketId || target === conditionId) return clobIds;
                    }
                }
            } catch {
                break;
            }
        }
    }

    return [];
}

async function fetchPolymarketHistory(marketId: string): Promise<{ points: PricePoint[]; resolvedMarketId: string }> {
    const candidateIds = new Set<string>();
    const rawCandidates = (() => {
        const normalized = normalizeIdentifier(marketId);
        if (!normalized) return [] as string[];
        const candidates = new Set<string>([normalized]);
        for (const parsed of parseStringArray(normalized)) {
            const item = normalizeIdentifier(parsed);
            if (item) candidates.add(item);
        }
        return Array.from(candidates);
    })();

    for (const rawCandidate of rawCandidates) {
        candidateIds.add(rawCandidate);
        const resolvedTokenIds = await resolveClobTokenIds(rawCandidate);
        for (const resolvedTokenId of resolvedTokenIds) candidateIds.add(normalizeIdentifier(resolvedTokenId));
    }

    for (const candidate of candidateIds) {
        if (!candidate) continue;
        const points = await fetchHistoryForMarketId(candidate);
        if (points.length > 0) return { points, resolvedMarketId: candidate };
    }

    const tried = Array.from(candidateIds).slice(0, 8).join(", ");
    throw new Error(tried ? `No historical price data (tried: ${tried})` : "No historical price data available");
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

export async function runBacktest(body: BacktestRequest) {
    const config = body;
    const startUnix = parseDateToUnix(config.start, "start", false);
    const endUnix = parseDateToUnix(config.end, "end", true);

    const resolvedHistory = await fetchPolymarketHistory(config.marketId);
    const prices = resolvedHistory.points.filter((point) => point.timestamp >= startUnix && point.timestamp <= endUnix);

    if (prices.length === 0) {
        return { ok: false, error: "No Polymarket history points found in selected date range" };
    }

    const firstPrice = prices[0].price;

    let cash = config.initialCash ?? 1000;
    let position = config.initialPosition ?? 0;
    const trades: Array<any> = [];
    const skippedMatches: Array<any> = [];
    const equityCurve: number[] = [];
    let matchedSignals = 0;
    let totalBoughtCost = 0;
    let totalBoughtQty = 0;
    let totalSoldProceeds = 0;
    let totalSoldQty = 0;
    let buyTrades = 0;
    let sellTrades = 0;
    let realizedPnL = 0;
    let positionAvgCost = config.initialPosition && config.initialPosition > 0 ? firstPrice : 0;

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
        let buyTriggerForLog: number | null = triggerValue as any;
        let sellTriggerForLog: number | null = triggerValue as any;

        if (config.action === "BOTH" && config.triggerType === "PRICE_TARGET") {
            buyTriggerForLog = config.buyTargetPrice as number;
            sellTriggerForLog = config.sellTargetPrice as number;
            buyMatched = buyTriggerForLog !== null && point.price <= buyTriggerForLog;
            sellMatched = sellTriggerForLog !== null && point.price >= sellTriggerForLog;
        } else {
            const oppositeDirection: TriggerDirection = config.direction === "ABOVE" ? "BELOW" : "ABOVE";
            const primaryMatched = triggerValue != null && (config.direction === "ABOVE" ? point.price >= triggerValue : point.price <= triggerValue);
            const oppositeMatched = triggerValue != null && (oppositeDirection === "ABOVE" ? point.price >= triggerValue : point.price <= triggerValue);
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
                        positionAvgCost = position > 0 ? ((prevPosition * prevCostBasis) + requiredCash) / position : 0;
                        totalBoughtCost += requiredCash;
                        totalBoughtQty += config.quantity;
                        buyTrades += 1;
                        trades.push({ date: toISODateTime(point.timestamp), action: "BUY", price: point.price, quantity: config.quantity });
                    } else {
                        skippedMatches.push({ date: toISODateTime(point.timestamp), reason: 'Insufficient cash', price: point.price });
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
                        if (position <= 0) { position = 0; positionAvgCost = 0; }
                        totalSoldProceeds += proceeds;
                        totalSoldQty += config.quantity;
                        sellTrades += 1;
                        trades.push({ date: toISODateTime(point.timestamp), action: "SELL", price: point.price, quantity: config.quantity });
                    } else {
                        skippedMatches.push({ date: toISODateTime(point.timestamp), reason: 'Insufficient position', price: point.price });
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
                    if (position <= 0) { position = 0; positionAvgCost = 0; }
                    totalSoldProceeds += proceeds;
                    totalSoldQty += config.quantity;
                    sellTrades += 1;
                    trades.push({ date: toISODateTime(point.timestamp), action: "SELL", price: point.price, quantity: config.quantity });
                } else if (shouldBuy) {
                    const requiredCash = point.price * config.quantity;
                    const prevPosition = position;
                    const prevCostBasis = positionAvgCost;
                    cash -= requiredCash;
                    position += config.quantity;
                    positionAvgCost = position > 0 ? ((prevPosition * prevCostBasis) + requiredCash) / position : 0;
                    totalBoughtCost += requiredCash;
                    totalBoughtQty += config.quantity;
                    buyTrades += 1;
                    trades.push({ date: toISODateTime(point.timestamp), action: "BUY", price: point.price, quantity: config.quantity });
                }
            }

            if (config.mode === "once") { equityCurve.push(cash + position * point.price); break; }
        }

        equityCurve.push(cash + position * point.price);
    }

    const lastPrice = prices[prices.length - 1].price;
    const initialEquity = (config.initialCash ?? 1000) + ((config.initialPosition ?? 0) * firstPrice);
    const finalEquity = cash + position * lastPrice;
    const netPnL = finalEquity - initialEquity;
    const returnPct = initialEquity > 0 ? (netPnL / initialEquity) * 100 : 0;
    const maxDrawdownPct = calcMaxDrawdown(equityCurve) * 100;

    return {
        ok: true,
        result: {
            matchedSignals,
            tradesExecuted: trades.length,
            buyTrades,
            sellTrades,
            totalBoughtCost,
            totalBoughtQty,
            totalSoldProceeds,
            totalSoldQty,
            endingCash: cash,
            endingPosition: position,
            finalEquity,
            netPnL,
            returnPct,
            maxDrawdownPct,
        },
    };
}

export default runBacktest;
