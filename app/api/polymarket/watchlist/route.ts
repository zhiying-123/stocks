// Polymarket Watchlist API
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

// GET - Fetch user's watchlist
export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const userCookie = cookieStore.get("user")?.value;
        const user = userCookie ? JSON.parse(userCookie) : null;

        if (!user?.id) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const watchlist = await prisma.polymarketWatchlist.findMany({
            where: { u_id: user.id },
            orderBy: { added_at: "desc" },
        });

        return NextResponse.json({
            watchlist: watchlist.map((w: any) => w.market_id)
        });
    } catch (error) {
        console.error("[POLYMARKET WATCHLIST GET]", error);
        return NextResponse.json({ error: "Failed to fetch watchlist" }, { status: 500 });
    }
}

// POST - Add to watchlist
export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const userCookie = cookieStore.get("user")?.value;
        const user = userCookie ? JSON.parse(userCookie) : null;

        if (!user?.id) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const { marketId } = await req.json();

        if (!marketId) {
            return NextResponse.json({ error: "Market ID required" }, { status: 400 });
        }

        // Check if already in watchlist
        const existing = await prisma.polymarketWatchlist.findUnique({
            where: {
                u_id_market_id: {
                    u_id: user.id,
                    market_id: marketId,
                },
            },
        });

        if (existing) {
            return NextResponse.json({ message: "Already in watchlist" }, { status: 200 });
        }

        await prisma.polymarketWatchlist.create({
            data: {
                u_id: user.id,
                market_id: marketId,
            },
        });

        console.log("[POLYMARKET WATCHLIST] Added:", { userId: user.id, marketId });

        return NextResponse.json({ success: true, message: "Added to watchlist" });
    } catch (error) {
        console.error("[POLYMARKET WATCHLIST POST]", error);
        return NextResponse.json({ error: "Failed to add to watchlist" }, { status: 500 });
    }
}

// DELETE - Remove from watchlist
export async function DELETE(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const userCookie = cookieStore.get("user")?.value;
        const user = userCookie ? JSON.parse(userCookie) : null;

        if (!user?.id) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const marketId = searchParams.get("marketId");

        if (!marketId) {
            return NextResponse.json({ error: "Market ID required" }, { status: 400 });
        }

        await prisma.polymarketWatchlist.delete({
            where: {
                u_id_market_id: {
                    u_id: user.id,
                    market_id: marketId,
                },
            },
        });

        console.log("[POLYMARKET WATCHLIST] Removed:", { userId: user.id, marketId });

        return NextResponse.json({ success: true, message: "Removed from watchlist" });
    } catch (error) {
        console.error("[POLYMARKET WATCHLIST DELETE]", error);
        return NextResponse.json({ error: "Failed to remove from watchlist" }, { status: 500 });
    }
}
