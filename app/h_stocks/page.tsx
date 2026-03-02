// H-Stocks Investment Platform - Market Overview
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { fetchStockQuote, fetchStockProfile } from "./stocks/stock";
import WatchlistSection from "./WatchlistSection";
import type { WatchlistItem } from "./types";

export const dynamic = 'force-dynamic';

// ==================== Server Data ====================
async function getOverviewData() {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get("user")?.value;
    const user = userCookie ? JSON.parse(userCookie) : null;

    let portfolio = { totalValue: 0, totalGainLoss: 0, holdingsCount: 0, cashBalance: 0 };
    let watchlistItems: WatchlistItem[] = [];
    let currency = 'MYR'; // Default currency

    if (user?.id) {
        try {
            const [wallet, holdings, watchlist] = await Promise.all([
                prisma.userWallet.findUnique({ where: { u_id: user.id } }),
                prisma.stockHolding.findMany({ where: { u_id: user.id } }),
                prisma.stockWatchlist.findMany({ where: { u_id: user.id }, orderBy: { added_at: 'desc' } }),
            ]);

            if (wallet) {
                portfolio.cashBalance = Number(wallet.balance);
                currency = wallet.currency; // Get currency from wallet
            } else {
                portfolio.cashBalance = 0; // No wallet = no cash
            }
            if (holdings.length > 0) {
                portfolio.holdingsCount = holdings.length;
                const holdingsValue = holdings.reduce(
                    (sum: number, h: any) => sum + h.quantity * h.avg_price, 0
                );
                portfolio.totalValue = holdingsValue + portfolio.cashBalance;
            } else {
                portfolio.totalValue = portfolio.cashBalance;
            }

            // Fetch live prices and profiles for watchlist
            if (watchlist.length > 0) {
                const stocksData = await Promise.all(
                    watchlist.map(async (w: { symbol: string }) => {
                        const [quote, profile] = await Promise.all([
                            fetchStockQuote(w.symbol),
                            fetchStockProfile(w.symbol)
                        ]);
                        return { quote, profile };
                    })
                );
                watchlistItems = watchlist.map((w: { symbol: string }, i: number) => ({
                    symbol: w.symbol,
                    price: stocksData[i]?.quote?.c ?? null,
                    change: stocksData[i]?.quote?.d ?? null,
                    changePercent: stocksData[i]?.quote?.dp ?? null,
                    open: stocksData[i]?.quote?.o ?? null,
                    high: stocksData[i]?.quote?.h ?? null,
                    low: stocksData[i]?.quote?.l ?? null,
                    previousClose: stocksData[i]?.quote?.pc ?? null,
                    volume: null, // Finnhub quote doesn't include volume for current day
                    marketCap: stocksData[i]?.profile?.marketCapitalization ?? null,
                    companyName: stocksData[i]?.profile?.name ?? null,
                }));
            }
        } catch {
            // fallback to defaults
        }
    }

    return { user, portfolio, watchlistItems, currency };
}

// ==================== Page ====================
export default async function HStocksPage() {
    // Check if user is logged in
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get("auth")?.value === "true";

    if (!isLoggedIn) {
        redirect("/login");
    }

    const { user, portfolio, watchlistItems, currency } = await getOverviewData();

    const gainPercent = portfolio.totalValue > 0
        ? ((portfolio.totalGainLoss / portfolio.totalValue) * 100).toFixed(2)
        : "0.00";
    const isPositive = Number(gainPercent) >= 0;

    return (
        <div className="space-y-8">
            {/* Hero Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gray-900 p-8 md:p-10">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-white/3 rounded-full -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-white/2 rounded-full translate-y-1/2" />
                <div className="absolute top-6 right-8 flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs text-emerald-400 font-medium">Live</span>
                </div>

                <div className="relative">
                    <p className="text-gray-400 text-sm font-medium mb-1">
                        Welcome back, <span className="text-white">{user?.name || 'Investor'}</span>
                    </p>
                    <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 tracking-tight">
                        Investment Overview
                    </h1>
                    <p className="text-gray-500 text-sm">
                        {new Date().toLocaleDateString('en-MY', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Portfolio Value</span>
                        <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 mb-1">
                        {currency} {portfolio.totalValue.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </p>
                    <div className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isPositive ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'}`}>
                        <span>{isPositive ? '↑' : '↓'}</span>
                        <span>{isPositive ? '+' : ''}{gainPercent}%</span>
                    </div>
                </div>

                <div className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Gain / Loss</span>
                        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 mb-1">
                        {currency} {portfolio.totalGainLoss.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-xs text-gray-400">All time</span>
                </div>

                <div className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Holdings</span>
                        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 mb-1">{portfolio.holdingsCount}</p>
                    <span className="text-xs text-gray-400">Stocks owned</span>
                </div>

                <div className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cash Balance</span>
                        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 mb-1">
                        {currency} {portfolio.cashBalance.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-xs text-gray-400">Ready to invest</span>
                </div>
            </div>

            {/* Quick Access Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <QuickLink
                    href="/h_stocks/stocks"
                    title="Stock Market"
                    desc="Browse & trade stocks"
                    icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>}
                />
                <QuickLink
                    href="/h_stocks/my-stocks"
                    title="My Stocks"
                    desc="View your holdings"
                    icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>}
                />
                <QuickLink
                    href="/h_stocks/portfolio"
                    title="Portfolio Analytics"
                    desc="Analyze performance"
                    icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" /></svg>}
                />
                <QuickLink
                    href="/h_stocks/wallet"
                    title="Wallet"
                    desc="Manage your balance"
                    icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" /></svg>}
                />
            </div>

            {/* Watchlist */}
            <WatchlistSection items={watchlistItems} />

            {/* Market Info */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-5">
                    <div className="w-1.5 h-5 rounded-full bg-gray-900" />
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Market Info</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                        <span className="text-xs text-gray-400 block mb-1">Market</span>
                        <span className="text-sm font-semibold text-gray-900">US Stocks</span>
                    </div>
                    <div>
                        <span className="text-xs text-gray-400 block mb-1">Data Source</span>
                        <span className="text-sm font-semibold text-gray-900">Finnhub</span>
                    </div>
                    <div>
                        <span className="text-xs text-gray-400 block mb-1">Currency</span>
                        <span className="text-sm font-semibold text-gray-900">{currency}</span>
                    </div>
                    <div>
                        <span className="text-xs text-gray-400 block mb-1">Date</span>
                        <span className="text-sm font-semibold text-gray-900">
                            {new Date().toLocaleDateString('en-MY', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ==================== Components ====================
function QuickLink({ href, title, desc, icon }: {
    href: string; title: string; desc: string; icon: React.ReactNode;
}) {
    return (
        <Link
            href={href}
            className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md p-5 flex items-center gap-4 transition-all"
        >
            <div className="w-11 h-11 rounded-xl bg-gray-900 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-gray-900 group-hover:text-gray-700 transition-colors">{title}</h3>
                <p className="text-xs text-gray-400">{desc}</p>
            </div>
            <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-900 group-hover:translate-x-0.5 transition-all shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
        </Link>
    );
}
