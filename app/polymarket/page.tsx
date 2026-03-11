// Polymarket Main Page
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import PolymarketUI from "./polymarketUI";

const POLYMARKET_API = "https://gamma-api.polymarket.com";

async function getAuthState() {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get("auth")?.value === "true";
    const userCookie = cookieStore.get("user")?.value;
    const user = userCookie ? JSON.parse(userCookie) : null;
    return { isLoggedIn, user };
}

async function fetchMarkets() {
    try {
        const response = await fetch(`${POLYMARKET_API}/events?limit=100&offset=0&closed=false`, {
            cache: "no-store",
            headers: {
                'Accept': 'application/json',
            }
        });

        if (!response.ok) {
            console.error("Failed to fetch markets:", response.status);
            return [];
        }

        const data = await response.json();

        // Flatten all markets from all events and find ones with active prices
        const allMarkets: any[] = [];

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

                // Skip extreme prices (already resolved markets)
                if (isNaN(yesPrice) || isNaN(noPrice)) continue;
                if (yesPrice <= 0.02 || yesPrice >= 0.98) continue;

                // Extract category/tags
                const tags = event.tags || [];
                const category = tags.length > 0 && tags[0].label ? tags[0].label : "Other";
                const tagLabels = tags.map((tag: any) => tag.label || tag).filter(Boolean);

                // Parse clobTokenIds (may be JSON string)
                let clobIds = market.clobTokenIds;
                if (typeof clobIds === 'string') {
                    try { clobIds = JSON.parse(clobIds); } catch { clobIds = []; }
                }

                allMarkets.push({
                    id: market.id || market.conditionId || `market-${Math.random()}`,
                    question: market.question || event.title || "Untitled Market",
                    description: market.description || event.description || "",
                    end_date_iso: market.endDate || event.end_date_iso || "",
                    image: event.image || event.icon || "",
                    outcomes: [
                        { name: "YES", price: yesPrice },
                        { name: "NO", price: noPrice },
                    ],
                    volume: event.volume ? parseFloat(event.volume) / event.markets.length : 0,
                    liquidity: market.liquidity ? parseFloat(market.liquidity) : 0,
                    category: category,
                    tags: tagLabels,
                    conditionId: clobIds?.[0]?.trim() || market.conditionId || "",
                });
            }
        }

        // Sort by volume and return
        allMarkets.sort((a, b) => (b.volume || 0) - (a.volume || 0));

        console.log(`✅ Found ${allMarkets.length} active markets from Polymarket`);
        return allMarkets;
    } catch (error) {
        console.error("Error fetching markets:", error);
        return [];
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

export default async function PolymarketPage() {
    const { isLoggedIn, user } = await getAuthState();

    if (!isLoggedIn) {
        redirect("/login");
    }

    const markets = await fetchMarkets();
    const wallet = user?.id ? await getUserWallet(user.id) : null;
    const currency = wallet?.currency || "MYR";

    // Fetch user's watchlist
    let watchlist: string[] = [];
    if (user?.id) {
        const userWatchlist = await prisma.polymarketWatchlist.findMany({
            where: { u_id: user.id }
        });
        watchlist = userWatchlist.map((w: any) => w.market_id);
    }

    return <PolymarketUI markets={markets} currency={currency} watchlist={watchlist} />;
}
