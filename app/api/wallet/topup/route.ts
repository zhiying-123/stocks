import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
    try {
        const userCookie = req.cookies.get("user")?.value;
        if (!userCookie) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }
        const user = JSON.parse(userCookie);
        if (!user?.id) {
            return NextResponse.json({ error: "Invalid user" }, { status: 401 });
        }

        const { amount } = await req.json();
        console.log("[TOP-UP API] User ID:", user.id, "Amount received:", amount, "Type:", typeof amount);

        if (!amount || typeof amount !== "number" || amount <= 0) {
            console.log("[TOP-UP API] Invalid amount");
            return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
        }

        if (amount > 5000) {
            return NextResponse.json({ error: "Maximum top-up amount is RM 5,000" }, { status: 400 });
        }

        // Check current balance before top-up
        const existingWallet = await prisma.userWallet.findUnique({ where: { u_id: user.id } });
        console.log("[TOP-UP API] Balance BEFORE top-up:", existingWallet?.balance ?? "No wallet exists");

        // Check if wallet exists
        if (!existingWallet) {
            return NextResponse.json({ error: "Wallet not activated. Please activate your wallet first." }, { status: 400 });
        }

        // Maximum wallet balance limit
        const MAX_BALANCE = 999999999.99;
        const newBalance = existingWallet.balance + amount;

        if (newBalance > MAX_BALANCE) {
            const availableAmount = MAX_BALANCE - existingWallet.balance;
            return NextResponse.json({
                error: `Cannot top up. Maximum wallet balance is RM ${MAX_BALANCE.toLocaleString()}. You can only add up to RM ${availableAmount.toFixed(2)} more.`
            }, { status: 400 });
        }

        // Upsert wallet — create if not exists, otherwise increment balance
        const wallet = await prisma.userWallet.upsert({
            where: { u_id: user.id },
            create: {
                u_id: user.id,
                balance: 10.00 + amount,
                currency: "MYR",
            },
            update: {
                balance: { increment: amount },
            },
        });

        console.log("[TOP-UP API] Balance AFTER top-up:", wallet.balance);
        console.log("[TOP-UP API] Returning newBalance:", wallet.balance);

        // Revalidate cached pages so they show the updated balance
        revalidatePath('/h_stocks/wallet');
        revalidatePath('/h_stocks');
        revalidatePath('/h_stocks/wallet/topup');

        return NextResponse.json({
            success: true,
            newBalance: wallet.balance,
        });
    } catch (err) {
        console.error("Top-up error:", err);
        return NextResponse.json({ error: "Failed to top up" }, { status: 500 });
    }
}
