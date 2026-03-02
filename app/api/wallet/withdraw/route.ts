// Withdrawal API - Request payout
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import Stripe from "stripe";

function getStripe() {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    return new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2026-01-28.clover",
    });
}

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

        const currentBalance = Number(wallet.balance);

        // Check if user has sufficient balance
        if (currentBalance < amount) {
            return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
        }

        // Deduct amount from wallet
        const updatedWallet = await prisma.userWallet.update({
            where: { u_id: user.id },
            data: {
                balance: {
                    decrement: amount,
                },
                updated_at: new Date(),
            },
        });

        console.log("[WITHDRAWAL] Processed withdrawal:", {
            userId: user.id,
            amount,
            newBalance: Number(updatedWallet.balance)
        });

        return NextResponse.json({
            success: true,
            newBalance: Number(updatedWallet.balance),
            withdrawnAmount: amount,
            message: 'Withdrawal request submitted successfully. Processing within 1-3 business days.',
        });
    } catch (error) {
        console.error("[WITHDRAWAL ERROR]", error);
        return NextResponse.json(
            { error: "Failed to process withdrawal" },
            { status: 500 }
        );
    }
}
