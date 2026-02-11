import StockDetailUI from "./stockDetailUI";
import { fetchStockQuote, fetchStockProfile } from "../stock";
import { fetchStockCandles } from "./stockDetail";
import { cookies } from "next/headers";

export default async function StockDetailPage({ params }: { params: Promise<{ symbol: string }> }) {
    const resolvedParams = await params;
    const symbol = resolvedParams.symbol.toUpperCase();

    // Check if user is logged in
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get("auth")?.value === "true";

    let quote = null;
    let profile = null;
    let dailyCandles = null;
    let monthlyCandles = null;

    try {
        [quote, profile, dailyCandles, monthlyCandles] = await Promise.all([
            fetchStockQuote(symbol),
            fetchStockProfile(symbol),
            fetchStockCandles(symbol, 'D', 30),  // Daily for 30 days
            fetchStockCandles(symbol, 'D', 365), // Daily for 1 year (monthly view)
        ]);
    } catch (e) {
        console.error(`Failed to load data for ${symbol}:`, e);
    }

    if (!quote) {
        return (
            <div className="py-12 px-4">
                <div className="max-w-7xl mx-auto text-center">
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">Stock Not Found</h1>
                    <p className="text-gray-600">Unable to load data for {symbol}</p>
                </div>
            </div>
        );
    }

    return (
        <StockDetailUI
            symbol={symbol}
            quote={quote}
            profile={profile}
            dailyCandles={dailyCandles}
            monthlyCandles={monthlyCandles}
            isLoggedIn={isLoggedIn}
        />
    );
}
