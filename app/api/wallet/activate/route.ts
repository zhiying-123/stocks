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

        // Check if wallet already exists
        const existing = await prisma.userWallet.findUnique({ where: { u_id: user.id } });
        if (existing) {
            return NextResponse.json({ error: "Wallet already activated" }, { status: 400 });
        }

        // Create wallet with welcome bonus of RM 10.00
        const wallet = await prisma.userWallet.create({
            data: {
                u_id: user.id,
                balance: 10.00,
                currency: "MYR",
            },
        });

        console.log("[WALLET ACTIVATE] Created wallet for user", user.id, "with welcome bonus RM 10.00");

        // Revalidate pages
        revalidatePath('/h_stocks/wallet');
        revalidatePath('/h_stocks');

        return NextResponse.json({
            success: true,
            balance: wallet.balance,
            message: "Wallet activated! Welcome bonus of RM 10.00 credited.",
        });
    } catch (err) {
        console.error("Wallet activation error:", err);
        return NextResponse.json({ error: "Failed to activate wallet" }, { status: 500 });
    }
}
