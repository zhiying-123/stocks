// My Stocks Page - Server Component
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { fetchStockQuote } from "../stocks/stock";
import MyStocksUI from "./myStocksUI";

async function getHoldingsData() {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get("auth")?.value === "true";
    const userCookie = cookieStore.get("user")?.value;
    const user = userCookie ? JSON.parse(userCookie) : null;

    // Require login for portfolio access
    if (!isLoggedIn || !user?.id) {
        redirect('/login');
    }

    const [rawHoldings, wallet] = await Promise.all([
        prisma.stockHolding.findMany({
            where: { u_id: user.id },
            orderBy: { updated_at: 'desc' },
        }),
        prisma.userWallet.findUnique({ where: { u_id: user.id } }),
    ]);

    const currency = wallet?.currency || 'MYR';

    // Fetch live prices for all holdings
    const quotes = await Promise.all(
        rawHoldings.map(h => fetchStockQuote(h.symbol))
    );

    const holdings = rawHoldings.map((h, i) => ({
        symbol: h.symbol,
        quantity: h.quantity,
        avgPrice: h.avg_price,
        currentPrice: quotes[i]?.c ?? null,
        change: quotes[i]?.d ?? null,
        changePercent: quotes[i]?.dp ?? null,
    }));

    return { holdings, currency };
}

export default async function MyStocksPage() {
    const { holdings, currency } = await getHoldingsData();

    return <MyStocksUI holdings={holdings} currency={currency} />;
}
