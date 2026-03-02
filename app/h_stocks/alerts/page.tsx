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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-1">Price Alerts</h1>
                        <p className="text-gray-600 text-sm">
                            Manage your stock price notifications
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">{alerts.length}</div>
                        <div className="text-xs text-gray-500">Total Alerts</div>
                    </div>
                </div>
            </div>

            {/* Alerts List */}
            <AlertsUI alerts={alerts} />
        </div>
    );
}
