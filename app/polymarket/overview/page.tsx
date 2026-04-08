// Polymarket Overview Page - Server Component
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import PolymarketOverviewUI from "./polymarketOverviewUI";

export const dynamic = 'force-dynamic';

const POLYMARKET_API = "https://gamma-api.polymarket.com";

function parseTokenIdArray(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
        return value
            .map((item) => String(item).trim())
            .filter(Boolean);
    }
    if (typeof value === "string") {
        const raw = value.trim();
        if (!raw) return [];

        const quotedTokens = Array.from(raw.matchAll(/"([^\"]+)"/g)).map((m) => m[1].trim()).filter(Boolean);
        if (quotedTokens.length > 0) return quotedTokens;

        const numericTokens = Array.from(raw.matchAll(/\d+/g)).map((m) => m[0].trim()).filter(Boolean);
        if (numericTokens.length > 0) return numericTokens;

        if (raw.includes(",")) {
            return raw
                .split(",")
                .map((part) => part.trim())
                .filter(Boolean);
        }

        return [raw];
    }
    return [];
}

function isTransientDbError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error || "");
    const normalized = message.toLowerCase();
    return (
        normalized.includes("connection terminated unexpectedly") ||
        normalized.includes("econnreset") ||
        normalized.includes("could not connect") ||
        normalized.includes("p1001")
    );
}

async function withDbRetry<T>(label: string, operation: () => Promise<T>, retries = 2): Promise<T> {
    let attempt = 0;
    while (true) {
        try {
            return await operation();
        } catch (error) {
            if (attempt >= retries || !isTransientDbError(error)) {
                throw error;
            }

            const waitMs = 250 * (attempt + 1);
            console.warn(`[OVERVIEW] Retrying DB operation (${label}) after transient error:`, error);
            await new Promise((resolve) => setTimeout(resolve, waitMs));
            attempt += 1;
        }
    }
}

type OverviewWatchlistMarket = {
    id: string;
    question: string;
    description: string;
    image: string;
    category: string;
    end_date_iso: string;
    outcomes: Array<{ name: "YES" | "NO"; price: number }>;
    volume: number;
    liquidity: number;
};

function parsePrices(value: unknown): [number, number] | null {
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

function buildOverviewWatchlistMarket(event: any, market: any, matchedId: string): OverviewWatchlistMarket | null {
    const pair = parsePrices(market?.outcomePrices);
    if (!pair) return null;

    const tags = event?.tags || [];
    const category = tags.length > 0 && tags[0].label ? tags[0].label : "Other";

    return {
        id: matchedId,
        question: String(market?.question || event?.title || "Untitled Market"),
        description: String(market?.description || event?.description || ""),
        image: String(event?.image || event?.icon || ""),
        category,
        end_date_iso: String(market?.endDate || event?.end_date_iso || ""),
        outcomes: [
            { name: "YES", price: pair[0] },
            { name: "NO", price: pair[1] },
        ],
        volume: Number(event?.volume ? parseFloat(event.volume) / Math.max(1, (event?.markets?.length || 1)) : 0),
        liquidity: Number(market?.liquidity ? parseFloat(market.liquidity) : 0),
    };
}

async function resolveWatchlistMarketsByIds(watchlistIdsInput: string[]) {
    const watchlistIds = new Set(watchlistIdsInput.map((id) => id.trim()).filter(Boolean));
    const resolved = new Map<string, OverviewWatchlistMarket>();

    if (watchlistIds.size === 0) {
        return [] as OverviewWatchlistMarket[];
    }

    try {
        for (const closed of ["false", "true"]) {
            for (let offset = 0; offset <= 2000; offset += 500) {
                const response = await fetch(`${POLYMARKET_API}/events?limit=500&offset=${offset}&closed=${closed}`, {
                    cache: "no-store",
                    headers: { Accept: "application/json" },
                });

                if (!response.ok) break;

                const events = await response.json();
                if (!Array.isArray(events) || events.length === 0) break;

                for (const event of events) {
                    const markets = Array.isArray(event?.markets) ? event.markets : [];
                    for (const market of markets) {
                        const conditionId = String(market?.conditionId || "").trim();
                        const marketId = String(market?.id || "").trim();
                        const clobIds = parseTokenIdArray(market?.clobTokenIds).map((id) => id.trim()).filter(Boolean);
                        const candidateIds = Array.from(new Set([conditionId, marketId, ...clobIds].filter(Boolean)));
                        const matchedId = candidateIds.find((id) => watchlistIds.has(id));
                        if (!matchedId || resolved.has(matchedId)) continue;

                        const normalized = buildOverviewWatchlistMarket(event, market, matchedId);
                        if (!normalized) continue;
                        resolved.set(matchedId, normalized);
                    }
                }

                if (resolved.size >= watchlistIds.size) {
                    return watchlistIdsInput
                        .map((id) => resolved.get(id))
                        .filter((item): item is OverviewWatchlistMarket => Boolean(item));
                }

                if (events.length < 500) break;
            }
        }
    } catch (error) {
        console.error("[OVERVIEW] Failed scanning events for watchlist:", error);
    }

    for (const watchlistId of watchlistIdsInput) {
        const id = watchlistId.trim();
        if (!id || resolved.has(id)) continue;

        try {
            const response = await fetch(`${POLYMARKET_API}/markets/${encodeURIComponent(id)}`, {
                cache: "no-store",
                headers: { Accept: "application/json" },
            });
            if (!response.ok) continue;

            const market = await response.json();
            const conditionId = String(market?.conditionId || "").trim();
            const marketId = String(market?.id || "").trim();
            const clobIds = parseTokenIdArray(market?.clobTokenIds).map((tokenId) => tokenId.trim()).filter(Boolean);
            const candidateIds = Array.from(new Set([id, conditionId, marketId, ...clobIds].filter(Boolean)));
            const matchedId = candidateIds.find((candidateId) => watchlistIds.has(candidateId));
            if (!matchedId) continue;

            const normalized = buildOverviewWatchlistMarket({ title: market?.question, description: market?.description, tags: market?.tags || [] }, market, matchedId);
            if (!normalized) continue;
            resolved.set(matchedId, normalized);
        } catch {
            continue;
        }
    }

    return watchlistIdsInput
        .map((id) => resolved.get(id))
        .filter((item): item is OverviewWatchlistMarket => Boolean(item));
}

async function getOverviewData() {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get("user")?.value;
    const user = userCookie ? JSON.parse(userCookie) : null;

    if (!user?.id) {
        redirect('/login');
    }

    // Fetch core portfolio data with retry to survive transient DB disconnects.
    let wallet: Awaited<ReturnType<typeof prisma.userWallet.findUnique>> = null;
    let holdings: Awaited<ReturnType<typeof prisma.polymarketHolding.findMany>> = [];
    let watchlist: Awaited<ReturnType<typeof prisma.polymarketWatchlist.findMany>> = [];

    try {
        wallet = await withDbRetry("userWallet.findUnique", () =>
            prisma.userWallet.findUnique({ where: { u_id: user.id } })
        );
        holdings = await withDbRetry("polymarketHolding.findMany", () =>
            prisma.polymarketHolding.findMany({ where: { u_id: user.id } })
        );
        watchlist = await withDbRetry("polymarketWatchlist.findMany", () =>
            prisma.polymarketWatchlist.findMany({
                where: { u_id: user.id },
                orderBy: { added_at: 'desc' },
            })
        );
    } catch (error) {
        console.error("[OVERVIEW] Failed to load DB data:", error);
    }

    // Calculate portfolio summary
    let totalInvested = 0;
    let totalGainLoss = 0;
    let holdingsCount = holdings.length;

    // Calculate invested amount
    for (const holding of holdings) {
        totalInvested += holding.quantity * holding.avg_price;
    }

    // Fetch current market prices for holdings to calculate gain/loss
    if (holdings.length > 0) {
        try {
            const response = await fetch(`${POLYMARKET_API}/events?limit=100&offset=0`, {
                cache: "no-store",
                headers: { 'Accept': 'application/json' },
            });

            if (response.ok) {
                const data = await response.json();
                const marketPrices = new Map<string, { yes: number; no: number }>();

                // Build a map of market prices
                for (const event of data) {
                    if (!event.markets || !Array.isArray(event.markets)) continue;

                    for (const market of event.markets) {
                        if (market.conditionId && market.outcomePrices) {
                            let prices = market.outcomePrices;
                            if (typeof prices === 'string') {
                                try {
                                    prices = JSON.parse(prices);
                                } catch (e) {
                                    continue;
                                }
                            }

                            if (Array.isArray(prices) && prices.length >= 2) {
                                marketPrices.set(market.conditionId, {
                                    yes: parseFloat(prices[0]),
                                    no: parseFloat(prices[1])
                                });
                            }
                        }
                    }
                }

                // Calculate gain/loss for each holding
                for (const holding of holdings) {
                    const currentPrices = marketPrices.get(holding.market_id);
                    if (currentPrices) {
                        const currentPrice = holding.outcome === 'YES' ? currentPrices.yes : currentPrices.no;
                        const currentValue = holding.quantity * currentPrice;
                        const cost = holding.quantity * holding.avg_price;
                        totalGainLoss += (currentValue - cost);
                    }
                }
            }
        } catch (error) {
            console.error("[OVERVIEW] Failed to fetch market prices for gain/loss:", error);
        }
    }

    const cashBalance = wallet ? Number(wallet.balance) : 0;
    const currency = wallet?.currency || 'MYR';
    const totalValue = totalInvested + cashBalance;

    const watchlistIds = watchlist.map((w: any) => String(w.market_id || "")).filter(Boolean);
    const watchlistMarkets = await resolveWatchlistMarketsByIds(watchlistIds);

    console.log('[OVERVIEW] Final watchlistMarkets count:', watchlistMarkets.length);

    return {
        portfolio: {
            totalValue,
            totalInvested,
            totalGainLoss,
            cashBalance,
            holdingsCount,
        },
        currency,
        watchlistMarkets,
    };
}

export default async function PolymarketOverviewPage() {
    const data = await getOverviewData();
    return <PolymarketOverviewUI {...data} />;
}
