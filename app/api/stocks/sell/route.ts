// API Route: Sell Stock
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

// Exchange rates (base: USD - stock prices are in USD)
const EXCHANGE_RATES_TO_USD = {
    USD: 1,
    MYR: 4.50,  // 1 USD = 4.50 MYR
    SGD: 1.35,  // 1 USD = 1.35 SGD
};

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const userCookie = cookieStore.get("user")?.value;
        const user = userCookie ? JSON.parse(userCookie) : null;

        if (!user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { symbol, quantity, pricePerShare } = await request.json();

        // Validate input
        if (!symbol || !quantity || !pricePerShare) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        if (quantity <= 0 || pricePerShare <= 0) {
            return NextResponse.json({ error: "Invalid quantity or price" }, { status: 400 });
        }

        // Get user wallet
        const wallet = await prisma.userWallet.findUnique({
            where: { u_id: user.id },
        });

        if (!wallet) {
            return NextResponse.json({ error: "Wallet not found. Please activate your wallet first." }, { status: 404 });
        }

        const currency = wallet.currency;
        const currentBalance = Number(wallet.balance);

        // Check if user has this stock
        const holding = await prisma.stockHolding.findUnique({
            where: {
                u_id_symbol: {
                    u_id: user.id,
                    symbol: symbol,
                },
            },
        });

        if (!holding) {
            return NextResponse.json({ error: "You don't own this stock" }, { status: 400 });
        }

        if (holding.quantity < quantity) {
            return NextResponse.json({
                error: `Insufficient shares. You own ${holding.quantity} shares, trying to sell ${quantity}`,
            }, { status: 400 });
        }

        // Calculate total revenue in USD (stock prices are in USD)
        const totalRevenueUSD = pricePerShare * quantity;

        // Convert to user's wallet currency
        const exchangeRate = EXCHANGE_RATES_TO_USD[currency as keyof typeof EXCHANGE_RATES_TO_USD];
        const totalRevenueInWalletCurrency = totalRevenueUSD * exchangeRate;

        console.log(`[SELL STOCK] ${symbol}: ${quantity} shares @ $${pricePerShare} USD = $${totalRevenueUSD} USD = ${totalRevenueInWalletCurrency.toFixed(2)} ${currency}`);

        // Transaction: Update wallet, holdings, and create transaction record
        const result = await prisma.$transaction(async (tx) => {
            // 1. Add to wallet
            const updatedWallet = await tx.userWallet.update({
                where: { u_id: user.id },
                data: {
                    balance: currentBalance + totalRevenueInWalletCurrency,
                    updated_at: new Date(),
                },
            });

            // 2. Update or delete holding
            const newQuantity = holding.quantity - quantity;
            let updatedHolding;

            if (newQuantity === 0) {
                // Delete holding if selling all shares
                await tx.stockHolding.delete({
                    where: {
                        u_id_symbol: {
                            u_id: user.id,
                            symbol: symbol,
                        },
                    },
                });
                updatedHolding = { quantity: 0, avg_price: 0 };
            } else {
                // Update holding with remaining shares
                updatedHolding = await tx.stockHolding.update({
                    where: {
                        u_id_symbol: {
                            u_id: user.id,
                            symbol: symbol,
                        },
                    },
                    data: {
                        quantity: newQuantity,
                        updated_at: new Date(),
                    },
                });
            }

            // 3. Create transaction record
            const transaction = await tx.stockTransaction.create({
                data: {
                    u_id: user.id,
                    symbol: symbol,
                    transaction_type: 'SELL',
                    quantity: quantity,
                    price: pricePerShare,
                    total_amount: totalRevenueInWalletCurrency,
                    currency: currency,
                },
            });

            return { updatedWallet, updatedHolding, transaction };
        });

        console.log(`[SELL STOCK SUCCESS] User ${user.id} sold ${quantity} ${symbol} @ $${pricePerShare}`);

        return NextResponse.json({
            success: true,
            message: `Successfully sold ${quantity} shares of ${symbol}`,
            data: {
                symbol: symbol,
                quantity: quantity,
                pricePerShare: pricePerShare,
                totalRevenueUSD: totalRevenueUSD,
                totalRevenueInCurrency: totalRevenueInWalletCurrency,
                currency: currency,
                newBalance: Number(result.updatedWallet.balance),
                holding: {
                    remainingShares: result.updatedHolding.quantity,
                    avgPrice: result.updatedHolding.avg_price || 0,
                },
            },
        });
    } catch (error) {
        console.error("[SELL STOCK ERROR]", error);
        return NextResponse.json({ error: "Failed to process sale" }, { status: 500 });
    }
}
