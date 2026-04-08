// API Route: Get Market Details with Real Chart Data
import { NextRequest, NextResponse } from "next/server";

const CLOB_API = "https://clob.polymarket.com";
const DATA_API = "https://data-api.polymarket.com";
const GAMMA_API = "https://gamma-api.polymarket.com";

function parseTokenIdArray(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof value === "string") {
        const raw = value.trim();
        if (!raw) return [];

        const quoted = Array.from(raw.matchAll(/"([^\"]+)"/g)).map((m) => m[1].trim()).filter(Boolean);
        if (quoted.length > 0) return quoted;

        const numeric = Array.from(raw.matchAll(/\d+/g)).map((m) => m[0].trim()).filter(Boolean);
        if (numeric.length > 0) return numeric;

        if (raw.includes(",")) {
            return raw.split(",").map((part) => part.trim()).filter(Boolean);
        }

        return [raw];
    }
    return [];
}

function parsePair(value: unknown): [number, number] | null {
    let prices = value;
    if (typeof prices === "string") {
        try {
            prices = JSON.parse(prices);
        } catch {
            return null;
        }
    }

    if (!Array.isArray(prices) || prices.length < 2) return null;
    const yes = Number(prices[0]);
    const no = Number(prices[1]);
    if (!Number.isFinite(yes) || !Number.isFinite(no)) return null;
    return [yes, no];
}

function marketCandidateIds(market: any): Set<string> {
    const conditionId = String(market?.conditionId || "").trim();
    const marketId = String(market?.id || "").trim();
    const clobIds = parseTokenIdArray(market?.clobTokenIds);
    return new Set([conditionId, marketId, ...clobIds].filter(Boolean));
}

function buildMarketInfo(targetId: string, market: any, fallbackCategory = "Other") {
    const pair = parsePair(market?.outcomePrices);
    const name = String(
        market?.events?.[0]?.title
        || market?.event?.title
        || market?.groupItemTitle
        || market?.question
        || market?.title
        || targetId
    ).trim();

    return {
        id: String(market?.id || targetId),
        tokenId: targetId,
        question: String(market?.question || market?.title || name || targetId),
        name,
        category: String((Array.isArray(market?.tags) && market.tags[0]?.label) || fallbackCategory || "Other"),
        endDate: String(market?.endDate || market?.end_date_iso || ""),
        yesPrice: pair ? pair[0] : null,
        noPrice: pair ? pair[1] : null,
        volume: Number(market?.volume ? parseFloat(market.volume) : 0),
        liquidity: Number(market?.liquidity ? parseFloat(market.liquidity) : 0),
    };
}

async function resolveMarketInfo(tokenId: string) {
    const id = tokenId.trim();
    if (!id) return null;

    try {
        const direct = await fetch(`${GAMMA_API}/markets/${encodeURIComponent(id)}`, {
            cache: "no-store",
            headers: { Accept: "application/json" },
        });
        if (direct.ok) {
            const market = await direct.json();
            if (marketCandidateIds(market).has(id)) {
                return buildMarketInfo(id, market);
            }
        }
    } catch {
        // Continue fallback lookup.
    }

    const queryLookups = ["id", "ids", "clob_token_ids", "condition_ids"] as const;
    for (const key of queryLookups) {
        try {
            const response = await fetch(`${GAMMA_API}/markets?${key}=${encodeURIComponent(id)}`, {
                cache: "no-store",
                headers: { Accept: "application/json" },
            });
            if (!response.ok) continue;

            const markets = await response.json();
            if (!Array.isArray(markets) || markets.length === 0) continue;

            const exact = markets.find((market) => marketCandidateIds(market).has(id));
            if (exact) {
                return buildMarketInfo(id, exact);
            }
        } catch {
            // Continue next lookup.
        }
    }

    return null;
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const tokenId = searchParams.get("tokenId");

        if (!tokenId) {
            return NextResponse.json({ error: "Token ID required" }, { status: 400 });
        }

        // Fetch real price history from CLOB API using token ID
        const priceHistoryResponse = await fetch(
            `${CLOB_API}/prices-history?market=${tokenId}&interval=all`,
            {
                headers: { "Content-Type": "application/json" },
                cache: "no-store",
            }
        ).catch(() => null);

        let priceHistory: any[] = [];
        if (priceHistoryResponse?.ok) {
            const rawData = await priceHistoryResponse.json();
            console.log("[MARKET DETAILS] Raw CLOB response type:", typeof rawData, "keys:", rawData ? Object.keys(rawData) : 'null');
            // Handle {history: [...]} or direct array
            if (Array.isArray(rawData)) {
                priceHistory = rawData;
            } else if (rawData?.history && Array.isArray(rawData.history)) {
                priceHistory = rawData.history;
            } else if (rawData && typeof rawData === 'object') {
                // Try to find any array in the response
                for (const key of Object.keys(rawData)) {
                    if (Array.isArray(rawData[key]) && rawData[key].length > 0) {
                        priceHistory = rawData[key];
                        console.log(`[MARKET DETAILS] Found array in key: ${key}, length: ${priceHistory.length}`);
                        break;
                    }
                }
            }
            console.log("[MARKET DETAILS] priceHistory length:", priceHistory.length);
            if (priceHistory[0]) console.log("[MARKET DETAILS] first item:", JSON.stringify(priceHistory[0]));
        } else {
            console.log("[MARKET DETAILS] CLOB response not ok:", priceHistoryResponse?.status);
        }

        // Fetch price from Data API as backup
        const dataApiResponse = await fetch(
            `${DATA_API}/prices?market=${tokenId}`,
            {
                headers: { "Content-Type": "application/json" },
                cache: "no-store",
            }
        ).catch(() => null);

        const dataApiPrices = dataApiResponse?.ok ? await dataApiResponse.json() : null;

        const marketInfo = await resolveMarketInfo(tokenId);

        return NextResponse.json({
            success: true,
            priceHistory,
            dataApiPrices,
            marketInfo,
        });

    } catch (error) {
        console.error("[MARKET DETAILS ERROR]", error);
        return NextResponse.json(
            { error: "Failed to fetch market details" },
            { status: 500 }
        );
    }
}
