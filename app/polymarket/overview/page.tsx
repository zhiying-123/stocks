// Polymarket Overview Page - Server Component
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import PolymarketOverviewUI from "./polymarketOverviewUI";

export const dynamic = 'force-dynamic';

const POLYMARKET_API = "https://gamma-api.polymarket.com";

async function getOverviewData() {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get("user")?.value;
    const user = userCookie ? JSON.parse(userCookie) : null;

    if (!user?.id) {
        redirect('/login');
    }

    // Fetch user's wallet, holdings, and watchlist
    const [wallet, holdings, watchlist] = await Promise.all([
        prisma.userWallet.findUnique({ where: { u_id: user.id } }),
        prisma.polymarketHolding.findMany({ where: { u_id: user.id } }),
        prisma.polymarketWatchlist.findMany({
            where: { u_id: user.id },
            orderBy: { added_at: 'desc' },
        }),
    ]);

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

    // Fetch watchlist markets data - use the same approach as main polymarket page
    const watchlistMarkets: any[] = [];
    console.log('[OVERVIEW] Watchlist count:', watchlist.length);
    console.log('[OVERVIEW] Watchlist IDs:', watchlist.map((w: any) => w.market_id));

    if (watchlist.length > 0) {
        try {
            // Fetch events just like the main polymarket page does
            const response = await fetch(`${POLYMARKET_API}/events?limit=200&offset=0&closed=false`, {
                cache: "no-store",
                headers: { 'Accept': 'application/json' },
            });

            if (response.ok) {
                const data = await response.json();
                const watchlistIds = new Set(watchlist.map((w: any) => w.market_id));
                console.log('[OVERVIEW] Fetched events count:', data.length);

                // Search through all events/markets like the main page does
                for (const event of data) {
                    if (!event.markets || !Array.isArray(event.markets)) continue;

                    for (const market of event.markets) {
                        let prices = market.outcomePrices;
                        if (!prices) continue;

                        // Parse JSON string if needed
                        if (typeof prices === 'string') {
                            try {
                                prices = JSON.parse(prices);
                            } catch (e) {
                                continue;
                            }
                        }

                        if (!Array.isArray(prices) || prices.length < 2) continue;

                        const yesPrice = parseFloat(prices[0]);
                        const noPrice = parseFloat(prices[1]);

                        if (isNaN(yesPrice) || isNaN(noPrice)) continue;

                        // Parse clobTokenIds (may be JSON string) - same as main page
                        let clobIds = market.clobTokenIds;
                        if (typeof clobIds === 'string') {
                            try { clobIds = JSON.parse(clobIds); } catch { clobIds = []; }
                        }

                        // The conditionId used in watchlist could be clobIds[0] OR market.conditionId
                        const marketConditionId = clobIds?.[0]?.trim() || market.conditionId || "";

                        // Check if this market is in the watchlist
                        if (watchlistIds.has(marketConditionId)) {
                            console.log('[OVERVIEW] Found watchlist market:', marketConditionId, market.question);

                            // Extract category/tags just like main page
                            const tags = event.tags || [];
                            const category = tags.length > 0 && tags[0].label ? tags[0].label : "Other";

                            watchlistMarkets.push({
                                id: marketConditionId,
                                question: market.question || event.title || "Untitled Market",
                                description: market.description || event.description || "",
                                image: event.image || event.icon || "",  // Use event.image like main page
                                category: category,
                                end_date_iso: market.endDate || event.end_date_iso || "",
                                outcomes: [
                                    { name: 'YES', price: yesPrice },
                                    { name: 'NO', price: noPrice }
                                ],
                                volume: event.volume ? parseFloat(event.volume) / event.markets.length : 0,
                                liquidity: market.liquidity ? parseFloat(market.liquidity) : 0,
                            });

                            // Remove from set to avoid duplicates
                            watchlistIds.delete(marketConditionId);
                        }
                    }
                }

                console.log(`[OVERVIEW] Found ${watchlistMarkets.length}/${watchlist.length} watchlist markets from events`);
            }
        } catch (error) {
            console.error("[OVERVIEW] Failed to fetch watchlist markets:", error);
        }
    }

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
