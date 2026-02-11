import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

async function getUser() {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get("user")?.value;
    return userCookie ? JSON.parse(userCookie) : null;
}

// Get watchlist
export async function GET() {
    const user = await getUser();
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const watchlist = await prisma.stockWatchlist.findMany({
            where: { u_id: user.id },
            orderBy: { added_at: 'desc' }
        });
        return NextResponse.json({ watchlist });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch watchlist" }, { status: 500 });
    }
}

// Add to watchlist
export async function POST(req: NextRequest) {
    const user = await getUser();
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { symbol } = await req.json();
    if (!symbol) return NextResponse.json({ error: "Symbol required" }, { status: 400 });

    try {
        const item = await prisma.stockWatchlist.create({
            data: { u_id: user.id, symbol: symbol.toUpperCase() },
        });
        return NextResponse.json(item);
    } catch {
        return NextResponse.json({ error: "Already in watchlist" }, { status: 409 });
    }
}

// Remove from watchlist
export async function DELETE(req: NextRequest) {
    const user = await getUser();
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { symbol } = await req.json();
    if (!symbol) return NextResponse.json({ error: "Symbol required" }, { status: 400 });

    try {
        await prisma.stockWatchlist.delete({
            where: { u_id_symbol: { u_id: user.id, symbol: symbol.toUpperCase() } },
        });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
}
