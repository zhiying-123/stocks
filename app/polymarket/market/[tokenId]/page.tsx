// Polymarket Market Detail Page - Server Component
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import MarketDetailUI from "./MarketDetailUI";

const POLYMARKET_API = "https://gamma-api.polymarket.com";

function parseTokenIdArray(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
        const raw = value.trim();
        if (!raw) return [];

        const quoted = Array.from(raw.matchAll(/"([^\"]+)"/g)).map((m) => m[1].trim()).filter(Boolean);
        if (quoted.length > 0) return quoted;

        const numeric = Array.from(raw.matchAll(/\d+/g)).map((m) => m[0].trim()).filter(Boolean);
        if (numeric.length > 0) return numeric;

        if (raw.includes(',')) {
            return raw.split(',').map((part) => part.trim()).filter(Boolean);
        }

        return [raw];
    }
    return [];
}

function parseOutcomePrices(value: unknown): [number, number] | null {
    let prices = value;
    if (typeof prices === 'string') {
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

async function getAuthState() {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get("auth")?.value === "true";
    const userCookie = cookieStore.get("user")?.value;
    const user = userCookie ? JSON.parse(userCookie) : null;
    return { isLoggedIn, user };
}

async function fetchMarketInfo(tokenId: string) {
    try {
        const direct = await fetch(`${POLYMARKET_API}/markets/${encodeURIComponent(tokenId)}`, {
            cache: "no-store",
            headers: {
                'Accept': 'application/json',
            }
        });

        if (direct.ok) {
            const market = await direct.json();
            const pair = parseOutcomePrices(market?.outcomePrices);
            if (pair) {
                return {
                    id: String(market?.id || market?.conditionId || tokenId),
                    question: String(market?.question || market?.title || "Untitled Market"),
                    description: String(market?.description || ""),
                    image: String(market?.image || market?.icon || ""),
                    category: "Other",
                    yesPrice: pair[0],
                    noPrice: pair[1],
                    volume: Number(market?.volume ? parseFloat(market.volume) : 0),
                    liquidity: Number(market?.liquidity ? parseFloat(market.liquidity) : 0),
                    conditionId: tokenId,
                };
            }
        }
    } catch {
        // Fall through to event scan.
    }

    try {
        for (const closed of ['false', 'true']) {
            for (let offset = 0; offset <= 2000; offset += 500) {
                const response = await fetch(`${POLYMARKET_API}/events?limit=500&offset=${offset}&closed=${closed}`, {
                    cache: "no-store",
                    headers: {
                        'Accept': 'application/json',
                    }
                });

                if (!response.ok) {
                    break;
                }

                const data = await response.json();
                if (!Array.isArray(data) || data.length === 0) {
                    break;
                }

                for (const event of data) {
                    if (!event.markets || !Array.isArray(event.markets)) continue;

                    for (const market of event.markets) {
                        const conditionId = String(market?.conditionId || '').trim();
                        const marketId = String(market?.id || '').trim();
                        const clobIds = parseTokenIdArray(market?.clobTokenIds);
                        const candidateIds = new Set([conditionId, marketId, ...clobIds].filter(Boolean));
                        if (!candidateIds.has(tokenId)) continue;

                        const pair = parseOutcomePrices(market?.outcomePrices);
                        if (!pair) continue;

                        const tags = event.tags || [];
                        const category = tags.length > 0 && tags[0].label ? tags[0].label : "Other";

                        return {
                            id: String(market?.id || market?.conditionId || tokenId),
                            question: String(market?.question || event?.title || "Untitled Market"),
                            description: String(market?.description || event?.description || ""),
                            image: String(event?.image || event?.icon || ""),
                            category: category,
                            yesPrice: pair[0],
                            noPrice: pair[1],
                            volume: Number(event?.volume ? parseFloat(event.volume) / Math.max(1, event.markets.length) : 0),
                            liquidity: Number(market?.liquidity ? parseFloat(market.liquidity) : 0),
                            conditionId: tokenId,
                        };
                    }
                }

                if (data.length < 500) {
                    break;
                }
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

    return (
        <MarketDetailUI
            marketInfo={marketInfo}
            tokenId={tokenId}
            currency={currency}
            isInWatchlist={isInWatchlist}
            userId={user?.id ?? null}
            userName={user?.name ?? null}
        />
    );
}
