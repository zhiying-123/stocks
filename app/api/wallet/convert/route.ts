// API Route: Convert wallet currency
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

// Exchange rates (base: MYR)
const EXCHANGE_RATES = {
    MYR: 1,
    SGD: 0.30,  // 1 MYR = 0.30 SGD
    USD: 0.22,  // 1 MYR = 0.22 USD
};

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const userCookie = cookieStore.get("user")?.value;
        const user = userCookie ? JSON.parse(userCookie) : null;

        if (!user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { toCurrency } = await request.json();

        if (!toCurrency || !["MYR", "SGD", "USD"].includes(toCurrency)) {
            return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
        }

        // Get current wallet
        const wallet = await prisma.userWallet.findUnique({
            where: { u_id: user.id },
        });

        if (!wallet) {
            return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
        }

        const currentCurrency = wallet.currency;

        if (currentCurrency === toCurrency) {
            return NextResponse.json({
                error: "Already using this currency",
                currentCurrency,
            }, { status: 400 });
        }

        const currentBalance = Number(wallet.balance);

        // Convert: Current -> MYR -> Target
        const balanceInMYR = currentBalance / EXCHANGE_RATES[currentCurrency as keyof typeof EXCHANGE_RATES];
        const newBalance = balanceInMYR * EXCHANGE_RATES[toCurrency as keyof typeof EXCHANGE_RATES];

        // Update wallet
        const updatedWallet = await prisma.userWallet.update({
            where: { u_id: user.id },
            data: {
                currency: toCurrency,
                balance: newBalance,
                updated_at: new Date(),
            },
        });

        console.log(`[CURRENCY CONVERT] User ${user.id}: ${currentBalance} ${currentCurrency} → ${newBalance} ${toCurrency}`);

        return NextResponse.json({
            success: true,
            oldCurrency: currentCurrency,
            newCurrency: toCurrency,
            oldBalance: currentBalance,
            newBalance: Number(updatedWallet.balance),
            rate: EXCHANGE_RATES[toCurrency as keyof typeof EXCHANGE_RATES] / EXCHANGE_RATES[currentCurrency as keyof typeof EXCHANGE_RATES],
        });
    } catch (error) {
        console.error("[CURRENCY CONVERT ERROR]", error);
        return NextResponse.json({ error: "Conversion failed" }, { status: 500 });
    }
}
