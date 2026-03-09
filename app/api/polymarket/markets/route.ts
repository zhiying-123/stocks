// API Route: Get Polymarket Markets
import { NextRequest, NextResponse } from "next/server";

const POLYMARKET_API = "https://gamma-api.polymarket.com";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const limit = searchParams.get("limit") || "100";
        const offset = searchParams.get("offset") || "0";

        // Fetch markets from Polymarket API
        const response = await fetch(
            `${POLYMARKET_API}/events?limit=${limit}&offset=${offset}&active=true`,
            {
                headers: {
                    "Content-Type": "application/json",
                },
                cache: "no-store",
            }
        );

        if (!response.ok) {
            throw new Error(`Polymarket API error: ${response.status}`);
        }

        const data = await response.json();

        return NextResponse.json({
            success: true,
            markets: data,
        });

    } catch (error) {
        console.error("[POLYMARKET MARKETS ERROR]", error);
        return NextResponse.json(
            { error: "Failed to fetch markets" },
            { status: 500 }
        );
    }
}
