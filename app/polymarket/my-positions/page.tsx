// My Positions Page
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import MyPositionsUI from "./myPositionsUI";

const POLYMARKET_API = "https://gamma-api.polymarket.com";

async function getAuthState() {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get("auth")?.value === "true";
    const userCookie = cookieStore.get("user")?.value;
    const user = userCookie ? JSON.parse(userCookie) : null;
    return { isLoggedIn, user };
}

async function getUserHoldings(userId: number) {
    try {
        const holdings = await prisma.polymarketHolding.findMany({
            where: { u_id: userId },
            orderBy: { updated_at: 'desc' },
        });
        return holdings;
    } catch (error) {
        console.error("Error fetching holdings:", error);
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

async function getMarketDetails(marketIds: string[]) {
    try {
        // Fetch market details for all holdings
        const markets: any = {};

        // For now, return empty object - in production, you'd fetch from Polymarket API
        // This would require batch fetching market details
        for (const id of marketIds) {
            markets[id] = {
                question: `Market ${id}`,
                currentYesPrice: 0.5,
                currentNoPrice: 0.5,
            };
        }

        return markets;
    } catch (error) {
        console.error("Error fetching market details:", error);
        return {};
    }
}

export default async function MyPositionsPage() {
    const { isLoggedIn, user } = await getAuthState();

    if (!isLoggedIn) {
        redirect("/login");
    }

    const holdings = await getUserHoldings(user.id);
    const wallet = await getUserWallet(user.id);
    const currency = wallet?.currency || "MYR";

    // Get market details for all holdings
    const marketIds = holdings.map(h => h.market_id);
    const marketDetails = await getMarketDetails(marketIds);

    // Transform holdings to include current prices
    const enrichedHoldings = holdings.map(holding => ({
        ...holding,
        marketQuestion: marketDetails[holding.market_id]?.question || `Market ${holding.market_id}`,
        currentPrice: holding.outcome === 'YES'
            ? marketDetails[holding.market_id]?.currentYesPrice || 0.5
            : marketDetails[holding.market_id]?.currentNoPrice || 0.5,
    }));

    return <MyPositionsUI holdings={enrichedHoldings} currency={currency} />;
}
