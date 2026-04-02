// Polymarket Analytics Page
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import PolymarketAnalyticsUI from "./polymarketAnalyticsUI";

const POLYMARKET_API = "https://gamma-api.polymarket.com";

type MarketOption = {
    id: string;
    question: string;
};

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

async function fetchMarketOptions(preferredIds: string[]): Promise<MarketOption[]> {
    const preferredSet = new Set(preferredIds.filter(Boolean));
    const optionMap = new Map<string, MarketOption>();

    try {
        const response = await fetch(`${POLYMARKET_API}/events?limit=300&offset=0&closed=false`, {
            cache: "no-store",
            headers: { Accept: "application/json" },
        });

        if (response.ok) {
            const data = (await response.json()) as unknown;
            if (Array.isArray(data)) {
                for (const event of data) {
                    if (typeof event !== "object" || event === null) continue;
                    const eventRecord = event as Record<string, unknown>;
                    const markets = eventRecord.markets;
                    if (!Array.isArray(markets)) continue;

                    for (const market of markets) {
                        if (typeof market !== "object" || market === null) continue;
                        const marketRecord = market as Record<string, unknown>;
                        const clobIds = parseStringArray(marketRecord.clobTokenIds);
                        const tokenId = String(marketRecord.conditionId || "").trim() || clobIds[0]?.trim();
                        if (!tokenId || optionMap.has(tokenId)) continue;

                        const question = String(
                            marketRecord.question || eventRecord.title || tokenId
                        ).trim();

                        optionMap.set(tokenId, {
                            id: tokenId,
                            question: question || tokenId,
                        });
                    }
                }
            }
        }
    } catch {
        // Ignore network errors; will fall back to preferred IDs only.
    }

    for (const id of preferredSet) {
        if (!optionMap.has(id)) {
            optionMap.set(id, { id, question: id });
        }
    }

    const allOptions = Array.from(optionMap.values());
    allOptions.sort((left, right) => {
        const leftPreferred = preferredSet.has(left.id) ? 1 : 0;
        const rightPreferred = preferredSet.has(right.id) ? 1 : 0;
        if (leftPreferred !== rightPreferred) return rightPreferred - leftPreferred;
        return left.question.localeCompare(right.question);
    });

    return allOptions.slice(0, 300);
}

async function getAuthState() {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get("auth")?.value === "true";
    const userCookie = cookieStore.get("user")?.value;
    const user = userCookie ? JSON.parse(userCookie) : null;
    return { isLoggedIn, user };
}

async function getAnalyticsData(userId: number) {
    // Get user wallet
    const wallet = await prisma.userWallet.findUnique({
        where: { u_id: userId },
    });

    // Get all holdings
    const holdings = await prisma.polymarketHolding.findMany({
        where: { u_id: userId },
        orderBy: { updated_at: 'desc' },
    });

    // Get all transactions
    const transactions = await prisma.polymarketTransaction.findMany({
        where: { u_id: userId },
        orderBy: { transaction_date: 'desc' },
    });

    const preferredMarketIds = Array.from(
        new Set([
            ...holdings.map((holding) => holding.market_id),
            ...transactions.map((transaction) => transaction.market_id),
        ])
    );

    const marketOptions = await fetchMarketOptions(preferredMarketIds);

    return {
        wallet,
        holdings,
        transactions,
        marketOptions,
    };
}

export default async function AnalyticsPage() {
    const { isLoggedIn, user } = await getAuthState();

    if (!isLoggedIn) {
        redirect("/login");
    }

    const { wallet, holdings, transactions, marketOptions } = await getAnalyticsData(user.id);
    const currency = wallet?.currency || "MYR";

    return <PolymarketAnalyticsUI holdings={holdings} transactions={transactions} currency={currency} marketOptions={marketOptions} />;
}
