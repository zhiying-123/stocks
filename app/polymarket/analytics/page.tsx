// Polymarket Analytics Page
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import PolymarketAnalyticsUI from "./polymarketAnalyticsUI";

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

    return {
        wallet,
        holdings,
        transactions,
    };
}

export default async function AnalyticsPage() {
    const { isLoggedIn, user } = await getAuthState();

    if (!isLoggedIn) {
        redirect("/login");
    }

    const { wallet, holdings, transactions } = await getAnalyticsData(user.id);
    const currency = wallet?.currency || "MYR";

    return <PolymarketAnalyticsUI holdings={holdings} transactions={transactions} currency={currency} />;
}
