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

const PRIORITY_MARKET_RULES = [
    {
        url: "https://polymarket.com/predictions/elon-tweets",
        slugHints: ["elon-tweets"],
        keywordHints: ["elon", "tweet"],
    },
    {
        url: "https://polymarket.com/predictions/economic-policy",
        slugHints: ["economic-policy"],
        keywordHints: ["economic policy", "federal reserve", "interest rate", "inflation", "economy", "fed"],
    },
    {
        url: "https://polymarket.com/predictions/nba",
        slugHints: ["nba"],
        keywordHints: ["nba", "basketball"],
    },
    {
        url: "https://polymarket.com/pop-culture/movies",
        slugHints: ["movies"],
        keywordHints: ["movie", "movies", "box office", "film"],
    },
] as const;

function normalizeText(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getPriorityRank(texts: string[]): number | null {
    const normalizedTexts = texts
        .map((text) => normalizeText(String(text || "")))
        .filter(Boolean);

    for (let index = 0; index < PRIORITY_MARKET_RULES.length; index += 1) {
        const rule = PRIORITY_MARKET_RULES[index];
        const hasSlugHit = rule.slugHints.some((hint) =>
            normalizedTexts.some((text) => text.includes(normalizeText(hint)))
        );

        const hasKeywordHit = rule.keywordHints.some((hint) => {
            const normalizedHint = normalizeText(hint);
            return normalizedTexts.some((text) => text.includes(normalizedHint));
        });

        if (hasSlugHit || hasKeywordHit) {
            return index;
        }
    }

    return null;
}

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
    const optionPriorityRank = new Map<string, number>();

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
                        const tokenId = clobIds[0]?.trim() || String(marketRecord.conditionId || "").trim() || String(marketRecord.id || "").trim();
                        if (!tokenId || optionMap.has(tokenId)) continue;

                        const question = String(
                            marketRecord.question || eventRecord.title || tokenId
                        ).trim();

                        const priorityRank = getPriorityRank([
                            question,
                            String(eventRecord.title || ""),
                            String(eventRecord.slug || ""),
                            String(marketRecord.slug || ""),
                            String(marketRecord.url || ""),
                        ]);

                        optionMap.set(tokenId, {
                            id: tokenId,
                            question: question || tokenId,
                        });

                        if (priorityRank !== null) {
                            const existingRank = optionPriorityRank.get(tokenId);
                            if (existingRank == null || priorityRank < existingRank) {
                                optionPriorityRank.set(tokenId, priorityRank);
                            }
                        }
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
        const leftPriorityRank = optionPriorityRank.get(left.id);
        const rightPriorityRank = optionPriorityRank.get(right.id);

        const leftIsPriority = leftPriorityRank !== undefined;
        const rightIsPriority = rightPriorityRank !== undefined;
        if (leftIsPriority !== rightIsPriority) return leftIsPriority ? -1 : 1;
        if (leftIsPriority && rightIsPriority && leftPriorityRank !== rightPriorityRank) {
            return (leftPriorityRank as number) - (rightPriorityRank as number);
        }

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
