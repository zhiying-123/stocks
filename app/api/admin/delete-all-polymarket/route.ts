// API Route: Delete all Polymarket wallet transactions
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function DELETE(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const userCookie = cookieStore.get("user")?.value;
        const user = userCookie ? JSON.parse(userCookie) : null;

        if (!user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Delete ALL Polymarket wallet transactions for this user
        const deleted = await prisma.walletTransaction.deleteMany({
            where: {
                u_id: user.id,
                OR: [
                    { transaction_type: 'POLYMARKET_BUY' },
                    { transaction_type: 'POLYMARKET_SELL' }
                ]
            }
        });

        console.log(`[DELETE ALL] Deleted ${deleted.count} Polymarket transactions for user ${user.id}`);

        return NextResponse.json({
            success: true,
            message: 'All Polymarket transactions deleted',
            deleted: deleted.count,
        });

    } catch (error: any) {
        console.error("[DELETE ALL ERROR]", error);
        return NextResponse.json(
            { error: error?.message || "Failed to delete transactions" },
            { status: 500 }
        );
    }
}
