// API Route: Clean old format transactions
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const userCookie = cookieStore.get("user")?.value;
        const user = userCookie ? JSON.parse(userCookie) : null;

        if (!user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get all polymarket wallet transactions
        const transactions = await prisma.walletTransaction.findMany({
            where: {
                u_id: user.id,
                OR: [
                    { transaction_type: 'POLYMARKET_BUY' },
                    { transaction_type: 'POLYMARKET_SELL' }
                ]
            },
            orderBy: { transaction_date: 'desc' },
        });

        // Separate by format
        const newFormat = transactions.filter(tx => {
            if (!tx.description) return false;
            const parts = tx.description.split(' | ');
            return parts.length >= 3; // New format: "Category | Outcome | X shares"
        });

        const oldFormat = transactions.filter(tx => {
            if (!tx.description) return true;
            const parts = tx.description.split(' | ');
            return parts.length < 3; // Old format
        });

        return NextResponse.json({
            success: true,
            total: transactions.length,
            newFormat: {
                count: newFormat.length,
                sample: newFormat.slice(0, 5).map(tx => ({
                    id: tx.transaction_id,
                    description: tx.description,
                    date: tx.transaction_date,
                }))
            },
            oldFormat: {
                count: oldFormat.length,
                sample: oldFormat.slice(0, 10).map(tx => ({
                    id: tx.transaction_id,
                    description: tx.description,
                    date: tx.transaction_date,
                }))
            }
        });

    } catch (error: any) {
        console.error("[CHECK ERROR]", error);
        return NextResponse.json(
            { error: error?.message || "Failed to check transactions" },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const userCookie = cookieStore.get("user")?.value;
        const user = userCookie ? JSON.parse(userCookie) : null;

        if (!user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Delete all old format polymarket transactions
        const deleted = await prisma.walletTransaction.deleteMany({
            where: {
                u_id: user.id,
                OR: [
                    { transaction_type: 'POLYMARKET_BUY' },
                    { transaction_type: 'POLYMARKET_SELL' }
                ],
                NOT: {
                    description: {
                        contains: ' | '
                    }
                }
            }
        });

        return NextResponse.json({
            success: true,
            message: 'Old format transactions deleted',
            deleted: deleted.count,
        });

    } catch (error: any) {
        console.error("[DELETE ERROR]", error);
        return NextResponse.json(
            { error: error?.message || "Failed to delete old transactions" },
            { status: 500 }
        );
    }
}
