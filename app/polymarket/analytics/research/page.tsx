import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import MarketResearchUI from "./MarketResearchUI";

const REQUESTED_RESEARCH_MARKET_IDS = [
    "66251427117820730328348516915002643165701087608548320678174884990042459843219", // Elon Tweets
    "107038673287591305588278630641182206593248489517364645241346988779794987745861", // Movie Box Office
    "18690049947242812495755151360212639738977254879109748949267393375856311641700", // US Federal Reserve Interest Rates
    "8186557467277475901094949742490854679817405006696983018588137692207963004648", // NBA Basketball games
];

function isTransientDbError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error || "");
    const normalized = message.toLowerCase();
    return (
        normalized.includes("server has closed the connection") ||
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
            console.warn(`[ANALYTICS_RESEARCH] Retrying DB operation (${label}) after transient error:`, error);
            await new Promise((resolve) => setTimeout(resolve, waitMs));
            attempt += 1;
        }
    }
}

async function getAuthState() {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get("auth")?.value === "true";
    const userCookie = cookieStore.get("user")?.value;
    const user = userCookie ? JSON.parse(userCookie) : null;
    return { isLoggedIn, user };
}

async function getInitialMarketIds(userId: number) {
    let watchlist: Array<{ market_id: string }> = [];
    let alerts: Array<{ market_id: string }> = [];

    try {
        watchlist = await withDbRetry("polymarketWatchlist.findMany", () =>
            prisma.polymarketWatchlist.findMany({
                where: { u_id: userId },
                orderBy: { added_at: "desc" },
                take: 20,
                select: { market_id: true },
            })
        );

        alerts = await withDbRetry("polymarketPriceAlert.findMany", () =>
            prisma.polymarketPriceAlert.findMany({
                where: { u_id: userId },
                orderBy: { created_at: "desc" },
                take: 20,
                select: { market_id: true },
            })
        );
    } catch (error) {
        console.error("[ANALYTICS_RESEARCH] Failed to load initial market IDs:", error);
    }

    return Array.from(
        new Set([
            ...REQUESTED_RESEARCH_MARKET_IDS,
            ...watchlist.map((item) => item.market_id),
            ...alerts.map((item) => item.market_id),
        ].filter(Boolean))
    ).slice(0, 12);
}

export default async function AnalyticsResearchPage() {
    const { isLoggedIn, user } = await getAuthState();

    if (!isLoggedIn || !user?.id) {
        redirect("/login");
    }

    const initialMarketIds = await getInitialMarketIds(user.id);

    return <MarketResearchUI initialMarketIds={initialMarketIds} />;
}
