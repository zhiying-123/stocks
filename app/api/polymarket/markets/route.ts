// API Route: Get Polymarket Markets
import { NextRequest, NextResponse } from "next/server";

const POLYMARKET_API = "https://gamma-api.polymarket.com";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const limit = searchParams.get("limit") || "100";
        const offset = searchParams.get("offset") || "0";
        const includeClosed = searchParams.get("includeClosed") === "1";

        const fetchEvents = async (closed: "true" | "false") => {
            const response = await fetch(
                `${POLYMARKET_API}/events?limit=${limit}&offset=${offset}&closed=${closed}`,
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
            return Array.isArray(data) ? data : [];
        };
        const openEvents = await fetchEvents("false");
        const closedEvents = includeClosed ? await fetchEvents("true") : [];
        const data = includeClosed ? [...openEvents, ...closedEvents] : openEvents;

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
