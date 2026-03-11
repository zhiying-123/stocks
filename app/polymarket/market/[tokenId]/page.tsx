// Polymarket Market Detail Page - Server Component
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import MarketDetailUI from "./MarketDetailUI";

const POLYMARKET_API = "https://gamma-api.polymarket.com";

async function getAuthState() {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get("auth")?.value === "true";
    const userCookie = cookieStore.get("user")?.value;
    const user = userCookie ? JSON.parse(userCookie) : null;
    return { isLoggedIn, user };
}

async function fetchMarketInfo(tokenId: string) {
    try {
        const response = await fetch(`${POLYMARKET_API}/events?limit=200&offset=0&closed=false`, {
            cache: "no-store",
            headers: {
                'Accept': 'application/json',
            }
        });

        if (!response.ok) {
            console.error("Failed to fetch markets:", response.status);
            return null;
        }

        const data = await response.json();

        for (const event of data) {
            if (!event.markets || !Array.isArray(event.markets)) continue;

            for (const market of event.markets) {
                let clobIds = market.clobTokenIds;
                if (typeof clobIds === 'string') {
                    try { clobIds = JSON.parse(clobIds); } catch { clobIds = []; }
                }
                const token = clobIds?.[0]?.trim() || market.conditionId || '';
                if (!token || token !== tokenId) continue;

                let prices = market.outcomePrices;
                if (typeof prices === 'string') {
                    try {
                        prices = JSON.parse(prices);
                    } catch {
                        continue;
                    }
                }

                if (!Array.isArray(prices) || prices.length < 2) continue;

                const yesPrice = parseFloat(prices[0]);
                const noPrice = parseFloat(prices[1]);

                if (isNaN(yesPrice) || isNaN(noPrice)) continue;

                const tags = event.tags || [];
                const category = tags.length > 0 && tags[0].label ? tags[0].label : "Other";

                return {
                    id: market.id || market.conditionId || tokenId,
                    question: market.question || event.title || "Untitled Market",
                    description: market.description || event.description || "",
                    image: event.image || event.icon || "",
                    category: category,
                    yesPrice: yesPrice,
                    noPrice: noPrice,
                    volume: event.volume ? parseFloat(event.volume) / event.markets.length : 0,
                    liquidity: market.liquidity ? parseFloat(market.liquidity) : 0,
                    conditionId: tokenId,
                };
            }
        }

        return null;
    } catch (error) {
        console.error("Error fetching market info:", error);
        return null;
    }
}

async function getUserWallet(userId: number) {
    try {
        const wallet = await prisma.userWallet.findUnique({
            where: { u_id: userId },
        });
        return wallet;
    } catch (error) {
        console.error("Error fetching wallet:", error);
        return null;
    }
}

export default async function MarketDetailPage({ params }: { params: Promise<{ tokenId: string }> }) {
    const { isLoggedIn, user } = await getAuthState();

    if (!isLoggedIn) {
        redirect("/login");
    }

    const resolvedParams = await params;
    const tokenId = decodeURIComponent(resolvedParams.tokenId);
    const marketInfo = await fetchMarketInfo(tokenId);

    if (!marketInfo) {
        redirect("/polymarket");
    }

    const wallet = user?.id ? await getUserWallet(user.id) : null;
    const currency = wallet?.currency || "MYR";

    // Check if market is in user's watchlist
    let isInWatchlist = false;
    if (user?.id) {
        const watchlistItem = await prisma.polymarketWatchlist.findUnique({
            where: {
                u_id_market_id: {
                    u_id: user.id,
                    market_id: tokenId,
                },
            },
        });
        isInWatchlist = !!watchlistItem;
    }

    return <MarketDetailUI marketInfo={marketInfo} tokenId={tokenId} currency={currency} isInWatchlist={isInWatchlist} />;
}
