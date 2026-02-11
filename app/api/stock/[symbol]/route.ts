import { NextRequest, NextResponse } from "next/server";
import { fetchStockQuote, fetchStockProfile } from "@/app/h_stocks/stocks/stock";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ symbol: string }> }
) {
    const resolvedParams = await params;
    const symbol = resolvedParams.symbol.toUpperCase();

    try {
        const [quote, profile] = await Promise.all([
            fetchStockQuote(symbol),
            fetchStockProfile(symbol)
        ]);

        if (!quote) {
            return NextResponse.json(
                { error: "Stock not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ quote, profile });
    } catch (error) {
        console.error(`Error fetching stock ${symbol}:`, error);
        return NextResponse.json(
            { error: "Failed to fetch stock data" },
            { status: 500 }
        );
    }
}
