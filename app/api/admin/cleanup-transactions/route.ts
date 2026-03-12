// API Route: Clean up duplicate Polymarket transactions
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const userCookie = cookieStore.get("user")?.value;
        const user = userCookie ? JSON.parse(userCookie) : null;

        // Only allow logged in users (you can add admin check here)
        if (!user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.log('[CLEANUP] Starting cleanup process...');

        // 1. Check current state
        const polymarketCount = await prisma.polymarketTransaction.count();
        const walletPolyCount = await prisma.walletTransaction.count({
            where: {
                OR: [
                    { transaction_type: 'POLYMARKET_BUY' },
                    { transaction_type: 'POLYMARKET_SELL' }
                ]
            }
        });

        console.log(`[CLEANUP] Found ${polymarketCount} PolymarketTransaction records`);
        console.log(`[CLEANUP] Found ${walletPolyCount} WalletTransaction Polymarket records`);

        // 2. Delete all PolymarketTransaction records (we now only use WalletTransaction)
        const deletedPolymarket = await prisma.polymarketTransaction.deleteMany({});

        console.log(`[CLEANUP] ✓ Deleted ${deletedPolymarket.count} PolymarketTransaction records`);

        return NextResponse.json({
            success: true,
            message: 'Cleanup completed successfully',
            deleted: {
                polymarketTransactions: deletedPolymarket.count,
            },
            remaining: {
                walletTransactions: walletPolyCount,
            }
        });

    } catch (error: any) {
        console.error("[CLEANUP ERROR]", error);
        return NextResponse.json(
            { error: error?.message || "Failed to clean up transactions" },
            { status: 500 }
        );
    }
}
