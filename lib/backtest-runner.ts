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
    minPriceChangePercent?: number; // 最小价格变动百分比 (0-100)，如果价格变动小于这个百分比就不交易
    cooldownHours?: number; // 冷却时间（小时），交易后必须等待这么久才能再交易
};

type PricePoint = { timestamp: number; price: number };

const CLOB_API = "https://clob.polymarket.com";
const GAMMA_API = "https://gamma-api.polymarket.com";

// LRU cache for price history to avoid redundant API calls
// Stores up to 100 markets' price histories in memory
interface CacheEntry {
    points: PricePoint[];
    resolvedMarketId: string;
    timestamp: number;
}

const PRICE_HISTORY_CACHE = new Map<string, CacheEntry>();
const CACHE_MAX_SIZE = 100;
const CACHE_TTL_MINUTES = 60; // Refresh cache every 60 minutes

function getCachedPriceHistory(marketId: string): CacheEntry | null {
    const entry = PRICE_HISTORY_CACHE.get(marketId);
    if (!entry) return null;

    const ageMinutes = (Date.now() - entry.timestamp) / (1000 * 60);
    if (ageMinutes > CACHE_TTL_MINUTES) {
        PRICE_HISTORY_CACHE.delete(marketId);
        return null;
    }
    return entry;
}

function setCachedPriceHistory(marketId: string, data: CacheEntry) {
    // Simple LRU: if cache is full, remove oldest entry
    if (PRICE_HISTORY_CACHE.size >= CACHE_MAX_SIZE) {
        const firstKey = PRICE_HISTORY_CACHE.keys().next().value;
        if (firstKey) PRICE_HISTORY_CACHE.delete(firstKey);
    }
    PRICE_HISTORY_CACHE.set(marketId, data);
}

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
    // Check cache first
    const cached = getCachedPriceHistory(marketId);
    if (cached) {
        return cached.points;
    }

    const response = await fetch(`${CLOB_API}/prices-history?market=${encodeURIComponent(marketId)}&interval=all`, {
        headers: { Accept: "application/json" },
    });

    if (!response.ok) {
        return [];
    }

    const raw = (await response.json()) as unknown;
    const points = normalizePriceHistory(raw);

    // Cache the result
    if (points.length > 0) {
        setCachedPriceHistory(marketId, {
            points,
            resolvedMarketId: marketId,
            timestamp: Date.now(),
        });
    }

    return points;
}

async function resolveFromDirectMarketLookup(inputId: string): Promise<string[]> {
    const target = inputId.trim();
    if (!target) return [];

    try {
        const response = await fetch(`${GAMMA_API}/markets/${encodeURIComponent(target)}`, {
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

    // Quick heuristic: if it looks like a CLOB token ID (32+ hex chars or UUID-like format),
    // skip expensive API search and return it directly.
    // This optimization helps when the caller already has a valid token ID.
    if (
        target.match(/^[a-fA-F0-9]{32,}$/) ||  // Hex string 32+ chars
        target.match(/^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-/) // UUID format
    ) {
        return [target];
    }

    const directResolved = await resolveFromDirectMarketLookup(target);
    if (directResolved.length > 0) return directResolved;

    for (const closed of ["false", "true"]) {
        for (let offset = 0; offset <= 5000; offset += 500) {
            try {
                const response = await fetch(`${GAMMA_API}/events?limit=500&offset=${offset}&closed=${closed}`, {
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
    // Check cache first with the input marketId (fast path for already-resolved token IDs)
    const cached = getCachedPriceHistory(marketId);
    if (cached) {
        return cached;
    }

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
        if (points.length > 0) {
            const result = { points, resolvedMarketId: candidate };
            // Cache the result
            setCachedPriceHistory(marketId, {
                ...result,
                timestamp: Date.now(),
            });
            return result;
        }
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
    let hasSold = false;

    // Control parameters for trade frequency
    const minPriceChangePercent = config.minPriceChangePercent ?? 0; // 默认0 = 所有价格变化都触发
    const cooldownHours = config.cooldownHours ?? 0; // 默认0 = 无冷却时间
    const COOLDOWN_MS = cooldownHours * 60 * 60 * 1000;
    
    // Track last trade timing and price
    let lastBuyTimestamp = -Infinity;
    let lastBuyPrice = 0;
    let lastSellTimestamp = -Infinity;
    let lastSellPrice = 0;

    // Market-condition based model: Buy/Sell based on price targets or moving averages
    const startTimestamp = prices.length > 0 ? prices[0].timestamp : 0;
    
    // Calculate moving average if needed
    let movingAverages: number[] = [];
    if (config.triggerType === "MOVING_AVERAGE" && config.movingAverageDays) {
        const windowSize = Math.max(1, config.movingAverageDays);
        movingAverages = new Array(prices.length);
        for (let i = 0; i < prices.length; i++) {
            const start = Math.max(0, i - windowSize + 1);
            let sum = 0;
            for (let j = start; j <= i; j++) {
                sum += prices[j].price;
            }
            movingAverages[i] = sum / (i - start + 1);
        }
    }

    // Track position state for each trade
    const positionHistory: Array<{ index: number; price: number; action: "BUY" | "SELL" }> = [];

    for (let index = 0; index < prices.length; index += 1) {
        const point = prices[index];

        let buyMatched = false;
        let sellMatched = false;

        // Determine triggers based on trigger type
        if (config.triggerType === "PRICE_TARGET") {
            // For BUY or BOTH: check if price reaches buyTargetPrice
            if ((config.action === "BUY" || config.action === "BOTH") && config.buyTargetPrice != null) {
                if (config.direction === "ABOVE" && point.price >= config.buyTargetPrice) {
                    buyMatched = true;
                } else if (config.direction === "BELOW" && point.price <= config.buyTargetPrice) {
                    buyMatched = true;
                }
            }
            // For SELL or BOTH: check if price reaches sellTargetPrice
            if ((config.action === "SELL" || config.action === "BOTH") && config.sellTargetPrice != null) {
                if (config.direction === "ABOVE" && point.price >= config.sellTargetPrice) {
                    sellMatched = true;
                } else if (config.direction === "BELOW" && point.price <= config.sellTargetPrice) {
                    sellMatched = true;
                }
            }
        } else if (config.triggerType === "MOVING_AVERAGE" && movingAverages.length > 0) {
            const ma = movingAverages[index];
            // For BUY: price crosses above MA
            if ((config.action === "BUY" || config.action === "BOTH") && config.direction === "ABOVE") {
                if (index > 0 && prices[index - 1].price <= movingAverages[index - 1] && point.price > ma) {
                    buyMatched = true;
                }
            }
            // For BUY: price crosses below MA
            if ((config.action === "BUY" || config.action === "BOTH") && config.direction === "BELOW") {
                if (index > 0 && prices[index - 1].price >= movingAverages[index - 1] && point.price < ma) {
                    buyMatched = true;
                }
            }
            // For SELL: price crosses above MA
            if ((config.action === "SELL" || config.action === "BOTH") && config.direction === "ABOVE") {
                if (index > 0 && prices[index - 1].price <= movingAverages[index - 1] && point.price > ma) {
                    sellMatched = true;
                }
            }
            // For SELL: price crosses below MA
            if ((config.action === "SELL" || config.action === "BOTH") && config.direction === "BELOW") {
                if (index > 0 && prices[index - 1].price >= movingAverages[index - 1] && point.price < ma) {
                    sellMatched = true;
                }
            }
        }

        // Apply cooldown and minimum price change filters
        if (buyMatched) {
            const timeSinceLastBuy = (point.timestamp * 1000 - lastBuyTimestamp) / 1000; // convert to seconds
            const cooldownSeconds = COOLDOWN_MS / 1000;
            if (timeSinceLastBuy < cooldownSeconds) {
                buyMatched = false; // Still in cooldown period
            } else if (minPriceChangePercent > 0 && lastBuyPrice > 0) {
                const priceChange = Math.abs(point.price - lastBuyPrice) / lastBuyPrice * 100;
                if (priceChange < minPriceChangePercent) {
                    buyMatched = false; // Price change too small
                }
            }
        }

        if (sellMatched) {
            const timeSinceLastSell = (point.timestamp * 1000 - lastSellTimestamp) / 1000; // convert to seconds
            const cooldownSeconds = COOLDOWN_MS / 1000;
            if (timeSinceLastSell < cooldownSeconds) {
                sellMatched = false; // Still in cooldown period
            } else if (minPriceChangePercent > 0 && lastSellPrice > 0) {
                const priceChange = Math.abs(point.price - lastSellPrice) / lastSellPrice * 100;
                if (priceChange < minPriceChangePercent) {
                    sellMatched = false; // Price change too small
                }
            }
        }

        if (buyMatched || sellMatched) {
            if (config.action === "BUY" && buyMatched) {
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
                    hasSold = false;
                    lastBuyTimestamp = point.timestamp * 1000; // Update last buy time
                    lastBuyPrice = point.price; // Update last buy price
                    trades.push({ date: toISODateTime(point.timestamp), action: "BUY", price: point.price, quantity: config.quantity });
                    positionHistory.push({ index, price: point.price, action: "BUY" });
                } else {
                    skippedMatches.push({ date: toISODateTime(point.timestamp), reason: 'Insufficient cash', price: point.price });
                }
            } else if (config.action === "SELL" && sellMatched) {
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
                    hasSold = true;
                    lastSellTimestamp = point.timestamp * 1000; // Update last sell time
                    lastSellPrice = point.price; // Update last sell price
                    trades.push({ date: toISODateTime(point.timestamp), action: "SELL", price: point.price, quantity: config.quantity });
                    positionHistory.push({ index, price: point.price, action: "SELL" });
                } else {
                    skippedMatches.push({ date: toISODateTime(point.timestamp), reason: 'Insufficient position', price: point.price });
                }
            } else if (config.action === "BOTH") {
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
                        hasSold = false;
                        lastBuyTimestamp = point.timestamp * 1000; // Update last buy time
                        lastBuyPrice = point.price; // Update last buy price
                        trades.push({ date: toISODateTime(point.timestamp), action: "BUY", price: point.price, quantity: config.quantity });
                        positionHistory.push({ index, price: point.price, action: "BUY" });
                    } else {
                        skippedMatches.push({ date: toISODateTime(point.timestamp), reason: 'Insufficient cash', price: point.price });
                    }
                }
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
                        hasSold = true;
                        lastSellTimestamp = point.timestamp * 1000; // Update last sell time
                        lastSellPrice = point.price; // Update last sell price
                        trades.push({ date: toISODateTime(point.timestamp), action: "SELL", price: point.price, quantity: config.quantity });
                        positionHistory.push({ index, price: point.price, action: "SELL" });
                    } else {
                        skippedMatches.push({ date: toISODateTime(point.timestamp), reason: 'Insufficient position', price: point.price });
                    }
                }
            }

            if (config.mode === "once") { equityCurve.push(cash + position * point.price); break; }
        }

        equityCurve.push(cash + position * point.price);
    }

    // If we still hold a position at the end, force-close it at the final price (liquidation)
    const finalPoint = prices[prices.length - 1];
    if (position > 0) {
        const proceeds = finalPoint.price * position;
        cash += proceeds;
        const tradePnL = (finalPoint.price - positionAvgCost) * position;
        realizedPnL += tradePnL;
        totalSoldProceeds += proceeds;
        totalSoldQty += position;
        sellTrades += 1;
        hasSold = true;
        trades.push({ date: toISODateTime(finalPoint.timestamp), action: "SELL", price: finalPoint.price, quantity: position });
        position = 0;
        positionAvgCost = 0;
    }

    const lastPrice = finalPoint.price;
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
