// Manual Top-Up Completion API (for immediate balance update)
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const userCookie = cookieStore.get("user")?.value;
        const user = userCookie ? JSON.parse(userCookie) : null;

        if (!user?.id) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const { amount } = await req.json();

        if (!amount || amount <= 0) {
            return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
        }

        // Get user's wallet
        const wallet = await prisma.userWallet.findUnique({
            where: { u_id: user.id },
        });

        if (!wallet) {
            return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
        }

        // Check for duplicate deposit in the last 5 minutes (prevent double charging)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const recentDeposit = await prisma.walletTransaction.findFirst({
            where: {
                u_id: user.id,
                transaction_type: "DEPOSIT",
                amount: amount,
                transaction_date: {
                    gte: fiveMinutesAgo,
                },
            },
            orderBy: {
                transaction_date: "desc",
            },
        });

        if (recentDeposit) {
            console.log("[TOP-UP COMPLETE] Duplicate deposit detected, skipping:", {
                userId: user.id,
                amount,
                recentDepositId: recentDeposit.transaction_id,
            });
            // Return success with current balance (don't charge again)
            return NextResponse.json({
                success: true,
                newBalance: Number(wallet.balance),
                duplicate: true,
            });
        }

        // Update wallet balance
        const updatedWallet = await prisma.userWallet.update({
            where: { u_id: user.id },
            data: {
                balance: {
                    increment: amount,
                },
                updated_at: new Date(),
            },
        });

        console.log("[TOP-UP COMPLETE] Balance updated:", {
            userId: user.id,
            amount,
            newBalance: Number(updatedWallet.balance),
        });

        // Create wallet transaction record for the deposit
        await prisma.walletTransaction.create({
            data: {
                u_id: user.id,
                transaction_type: "DEPOSIT",
                amount: amount,
                currency: wallet.currency,
                balance_after: Number(updatedWallet.balance),
                description: "Payment completed (Stripe)",
            },
        });

        return NextResponse.json({
            success: true,
            newBalance: Number(updatedWallet.balance),
        });
    } catch (error) {
        console.error("[TOP-UP COMPLETE ERROR]", error);
        return NextResponse.json(
            { error: "Failed to update balance" },
            { status: 500 }
        );
    }
}
