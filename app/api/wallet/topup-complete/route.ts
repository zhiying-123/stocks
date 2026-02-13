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
