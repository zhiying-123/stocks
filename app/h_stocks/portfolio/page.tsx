// Portfolio Analytics Page - Server Component
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { fetchStockQuote, fetchStockProfile } from "../stocks/stock";
import PortfolioAnalytics from "./portfolioAnalytics";

export const dynamic = 'force-dynamic';

async function getPortfolioData() {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get("auth")?.value === "true";
    const userCookie = cookieStore.get("user")?.value;
    const user = userCookie ? JSON.parse(userCookie) : null;

    if (!isLoggedIn || !user?.id) {
        redirect('/login');
    }

    const [wallet, holdings, transactions] = await Promise.all([
        prisma.userWallet.findUnique({ where: { u_id: user.id } }),
        prisma.stockHolding.findMany({ 
            where: { u_id: user.id },
            orderBy: { updated_at: 'desc' }
        }),
        prisma.stockTransaction.findMany({
            where: { u_id: user.id },
            orderBy: { transaction_date: 'asc' },
        }),
    ]);

    const currency = wallet?.currency || 'MYR';
    const cashBalance = Number(wallet?.balance || 0);

    // Fetch live prices and profiles for all holdings
    const holdingsWithData = await Promise.all(
        holdings.map(async (holding) => {
            const [quote, profile] = await Promise.all([
                fetchStockQuote(holding.symbol),
                fetchStockProfile(holding.symbol),
            ]);

            const currentPrice = quote?.c || holding.avg_price;
            const totalCost = holding.quantity * holding.avg_price;
            const currentValue = holding.quantity * currentPrice;
            const gainLoss = currentValue - totalCost;
            const gainLossPercent = (gainLoss / totalCost) * 100;

            return {
                symbol: holding.symbol,
                companyName: profile?.name || holding.symbol,
                quantity: holding.quantity,
                avgPrice: holding.avg_price,
                currentPrice,
                totalCost,
                currentValue,
                gainLoss,
                gainLossPercent,
                industry: profile?.finnhubIndustry || 'Unknown',
            };
        })
    );

    // Calculate portfolio metrics
    const totalInvested = holdingsWithData.reduce((sum, h) => sum + h.totalCost, 0);
    const totalCurrentValue = holdingsWithData.reduce((sum, h) => sum + h.currentValue, 0);
    const totalGainLoss = totalCurrentValue - totalInvested;
    const totalGainLossPercent = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;

    // Calculate portfolio value including cash
    const totalPortfolioValue = totalCurrentValue + cashBalance;

    // Group by industry
    const industryMap = new Map<string, number>();
    holdingsWithData.forEach(h => {
        const current = industryMap.get(h.industry) || 0;
        industryMap.set(h.industry, current + h.currentValue);
    });

    const industryDistribution = Array.from(industryMap.entries())
        .map(([industry, value]) => ({
            industry,
            value,
            percentage: (value / totalCurrentValue) * 100,
        }))
        .sort((a, b) => b.value - a.value);

    // Group transactions by date for performance chart
    const transactionsByDate = new Map<string, { bought: number; sold: number }>();
    transactions.forEach(tx => {
        const date = new Date(tx.transaction_date).toISOString().split('T')[0];
        const current = transactionsByDate.get(date) || { bought: 0, sold: 0 };
        if (tx.transaction_type === 'BUY') {
            current.bought += Number(tx.total_amount);
        } else {
            current.sold += Number(tx.total_amount);
        }
        transactionsByDate.set(date, current);
    });

    const performanceData = Array.from(transactionsByDate.entries())
        .map(([date, data]) => ({
            date,
            bought: data.bought,
            sold: data.sold,
            net: data.bought - data.sold,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

    return {
        holdings: holdingsWithData,
        currency,
        cashBalance,
        metrics: {
            totalInvested,
            totalCurrentValue,
            totalGainLoss,
            totalGainLossPercent,
            totalPortfolioValue,
            holdingsCount: holdings.length,
        },
        industryDistribution,
        performanceData,
    };
}

export default async function PortfolioPage() {
    const data = await getPortfolioData();
    return <PortfolioAnalytics {...data} />;
}
