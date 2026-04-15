import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

function unauthorized() {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const isLoggedIn = cookieStore.get("auth")?.value === "true";
        const userCookie = cookieStore.get("user")?.value;

        if (!isLoggedIn || !userCookie) {
            return unauthorized();
        }

        const { confirmText } = await request.json();
        if (String(confirmText || "").trim().toUpperCase() !== "DELETE") {
            return NextResponse.json({ error: "Confirmation text is invalid" }, { status: 400 });
        }

        const user = JSON.parse(userCookie) as { id?: number };
        const userId = Number(user?.id);

        if (!Number.isFinite(userId) || userId <= 0) {
            return unauthorized();
        }

        await prisma.$transaction(async (tx) => {
            await tx.stockAutoTrader.deleteMany({ where: { u_id: userId } });
            await tx.stockHolding.deleteMany({ where: { u_id: userId } });
            await tx.stockTransaction.deleteMany({ where: { u_id: userId } });
            await tx.stockWatchlist.deleteMany({ where: { u_id: userId } });
            await tx.walletTransaction.deleteMany({ where: { u_id: userId } });

            await tx.polymarketHolding.deleteMany({ where: { u_id: userId } });
            await tx.polymarketTransaction.deleteMany({ where: { u_id: userId } });
            await tx.polymarketWatchlist.deleteMany({ where: { u_id: userId } });
            await tx.polymarketComment.deleteMany({ where: { u_id: userId } });
            await tx.polymarketPriceAlert.deleteMany({ where: { u_id: userId } });

            await tx.userWallet.deleteMany({ where: { u_id: userId } });
            await tx.user.deleteMany({ where: { u_id: userId } });
        });

        const response = NextResponse.json({ success: true });
        response.cookies.set("auth", "", {
            path: "/",
            maxAge: 0,
            expires: new Date(0),
        });
        response.cookies.set("user", "", {
            path: "/",
            maxAge: 0,
            expires: new Date(0),
        });

        return response;
    } catch (error) {
        console.error("Delete account error:", error);
        return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
    }
}
