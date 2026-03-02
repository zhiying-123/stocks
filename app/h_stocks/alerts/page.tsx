// Price Alerts Page - Server Component
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { fetchStockQuote, fetchStockProfile } from "../stocks/stock";
import AlertsUI from "./alertsUI";

export const dynamic = 'force-dynamic';

async function getAlertsData() {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get("auth")?.value === "true";
    const userCookie = cookieStore.get("user")?.value;
    const user = userCookie ? JSON.parse(userCookie) : null;

    if (!isLoggedIn || !user?.id) {
        redirect('/login');
    }

    const alerts = await prisma.priceAlert.findMany({
        where: { u_id: user.id },
        orderBy: [
            { is_active: 'desc' },
            { is_triggered: 'desc' },
            { created_at: 'desc' }
        ],
    });

    // Fetch current prices for all symbols
    const uniqueSymbols = [...new Set(alerts.map(a => a.symbol))];
    const quotesMap = new Map();
    const profilesMap = new Map();

    await Promise.all(
        uniqueSymbols.map(async (symbol) => {
            const [quote, profile] = await Promise.all([
                fetchStockQuote(symbol),
                fetchStockProfile(symbol),
            ]);
            quotesMap.set(symbol, quote);
            profilesMap.set(symbol, profile);
        })
    );

    const alertsWithData = alerts.map(alert => {
        const quote = quotesMap.get(alert.symbol);
        const profile = profilesMap.get(alert.symbol);
        const currentPrice = quote?.c || alert.reference_price || 0;

        return {
            ...alert,
            currentPrice,
            companyName: profile?.name || alert.symbol,
        };
    });

    return { user, alerts: alertsWithData };
}

export default async function AlertsPage() {
    const { user, alerts } = await getAlertsData();

    const activeCount = alerts.filter(a => a.is_active && !a.is_triggered).length;
    const triggeredCount = alerts.filter(a => a.is_triggered).length;

    return (
        <div className="space-y-8">
            {/* Hero Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gray-900 p-8 md:p-10">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-white/3 rounded-full -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-white/2 rounded-full translate-y-1/2" />
                <div className="absolute top-6 right-8 flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs text-emerald-400 font-medium">Active</span>
                </div>

                <div className="relative">
                    <p className="text-gray-400 text-sm font-medium mb-1">
                        Notification Management
                    </p>
                    <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 tracking-tight">
                        Price Alerts
                    </h1>
                    <p className="text-gray-500 text-sm">
                        Get notified when stock prices reach your target
                    </p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Alerts</span>
                        <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 mb-1">{alerts.length}</p>
                    <span className="text-xs text-gray-400">Monitoring {alerts.length} stocks</span>
                </div>

                <div className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active</span>
                        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 mb-1">{activeCount}</p>
                    <div className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full text-gray-700 bg-gray-100">
                        <span>●</span>
                        <span>Watching</span>
                    </div>
                </div>

                <div className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Triggered</span>
                        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 mb-1">{triggeredCount}</p>
                    <div className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full text-emerald-700 bg-emerald-50">
                        <span>✓</span>
                        <span>Reached</span>
                    </div>
                </div>
            </div>

            {/* Create Alert Button */}
            {alerts.length > 0 && (
                <div className="flex justify-end">
                    <a
                        href="/h_stocks/stocks"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white font-semibold text-sm rounded-xl hover:bg-gray-800 transition-all shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create New Alert
                    </a>
                </div>
            )}

            {/* Alerts List */}
            <AlertsUI alerts={alerts} />
        </div>
    );
}
