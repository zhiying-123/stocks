// API Route: Get Market Details with Real Chart Data
import { NextRequest, NextResponse } from "next/server";

const CLOB_API = "https://clob.polymarket.com";
const DATA_API = "https://data-api.polymarket.com";
const GAMMA_API = "https://gamma-api.polymarket.com";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const tokenId = searchParams.get("tokenId");

        if (!tokenId) {
            return NextResponse.json({ error: "Token ID required" }, { status: 400 });
        }

        // Fetch real price history from CLOB API using token ID
        const priceHistoryResponse = await fetch(
            `${CLOB_API}/prices-history?market=${tokenId}&interval=all`,
            {
                headers: { "Content-Type": "application/json" },
                cache: "no-store",
            }
        ).catch(() => null);

        let priceHistory: any[] = [];
        if (priceHistoryResponse?.ok) {
            const rawData = await priceHistoryResponse.json();
            console.log("[MARKET DETAILS] Raw CLOB response type:", typeof rawData, "keys:", rawData ? Object.keys(rawData) : 'null');
            // Handle {history: [...]} or direct array
            if (Array.isArray(rawData)) {
                priceHistory = rawData;
            } else if (rawData?.history && Array.isArray(rawData.history)) {
                priceHistory = rawData.history;
            } else if (rawData && typeof rawData === 'object') {
                // Try to find any array in the response
                for (const key of Object.keys(rawData)) {
                    if (Array.isArray(rawData[key]) && rawData[key].length > 0) {
                        priceHistory = rawData[key];
                        console.log(`[MARKET DETAILS] Found array in key: ${key}, length: ${priceHistory.length}`);
                        break;
                    }
                }
            }
            console.log("[MARKET DETAILS] priceHistory length:", priceHistory.length);
            if (priceHistory[0]) console.log("[MARKET DETAILS] first item:", JSON.stringify(priceHistory[0]));
        } else {
            console.log("[MARKET DETAILS] CLOB response not ok:", priceHistoryResponse?.status);
        }

        // Fetch price from Data API as backup
        const dataApiResponse = await fetch(
            `${DATA_API}/prices?market=${tokenId}`,
            {
                headers: { "Content-Type": "application/json" },
                cache: "no-store",
            }
        ).catch(() => null);

        const dataApiPrices = dataApiResponse?.ok ? await dataApiResponse.json() : null;

        return NextResponse.json({
            success: true,
            priceHistory,
            dataApiPrices,
        });

    } catch (error) {
        console.error("[MARKET DETAILS ERROR]", error);
        return NextResponse.json(
            { error: "Failed to fetch market details" },
            { status: 500 }
        );
    }
}
