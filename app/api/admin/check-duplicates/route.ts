// API Route: Check for duplicate transactions
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

        console.log(`[CHECK] Found ${transactions.length} Polymarket transactions in WalletTransaction`);

        // Group by transaction details to find duplicates
        const grouped = new Map<string, any[]>();

        transactions.forEach(tx => {
            // Create a key based on type, symbol, amount, and date (rounded to second)
            const dateKey = Math.floor(new Date(tx.transaction_date).getTime() / 1000);
            const key = `${tx.transaction_type}-${tx.symbol}-${tx.amount}-${dateKey}`;

            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            grouped.get(key)!.push(tx);
        });

        // Find duplicates
        const duplicates = Array.from(grouped.entries())
            .filter(([_, txs]) => txs.length > 1)
            .map(([key, txs]) => ({
                key,
                count: txs.length,
                transactions: txs.map(tx => ({
                    id: tx.transaction_id,
                    type: tx.transaction_type,
                    amount: tx.amount,
                    description: tx.description,
                    date: tx.transaction_date.toISOString(),
                }))
            }));

        return NextResponse.json({
            success: true,
            total: transactions.length,
            duplicateGroups: duplicates.length,
            duplicates: duplicates,
            sample: transactions.slice(0, 10).map(tx => ({
                id: tx.transaction_id,
                type: tx.transaction_type,
                amount: tx.amount,
                description: tx.description,
                date: tx.transaction_date.toISOString(),
            }))
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

        // Get all polymarket wallet transactions
        const transactions = await prisma.walletTransaction.findMany({
            where: {
                u_id: user.id,
                OR: [
                    { transaction_type: 'POLYMARKET_BUY' },
                    { transaction_type: 'POLYMARKET_SELL' }
                ]
            },
            orderBy: { transaction_date: 'asc' }, // Keep oldest
        });

        // Group by transaction details to find duplicates
        const grouped = new Map<string, any[]>();

        transactions.forEach(tx => {
            const dateKey = Math.floor(new Date(tx.transaction_date).getTime() / 1000);
            const key = `${tx.transaction_type}-${tx.symbol}-${tx.amount}-${dateKey}`;

            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            grouped.get(key)!.push(tx);
        });

        // Find IDs to delete (keep first, delete rest)
        const idsToDelete: number[] = [];
        grouped.forEach((txs) => {
            if (txs.length > 1) {
                // Keep the first one, delete the rest
                for (let i = 1; i < txs.length; i++) {
                    idsToDelete.push(txs[i].transaction_id);
                }
            }
        });

        console.log(`[CLEANUP] Found ${idsToDelete.length} duplicate transactions to delete`);

        if (idsToDelete.length > 0) {
            const deleted = await prisma.walletTransaction.deleteMany({
                where: {
                    transaction_id: {
                        in: idsToDelete
                    }
                }
            });

            console.log(`[CLEANUP] Deleted ${deleted.count} duplicate transactions`);

            return NextResponse.json({
                success: true,
                message: 'Duplicates removed successfully',
                deleted: deleted.count,
            });
        } else {
            return NextResponse.json({
                success: true,
                message: 'No duplicates found',
                deleted: 0,
            });
        }

    } catch (error: any) {
        console.error("[CLEANUP ERROR]", error);
        return NextResponse.json(
            { error: error?.message || "Failed to remove duplicates" },
            { status: 500 }
        );
    }
}
