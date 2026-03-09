// API Route: Sell Polymarket Position
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

// Exchange rates (base: USD)
const EXCHANGE_RATES_TO_USD = {
    USD: 1,
    MYR: 4.50,
    SGD: 1.35,
};

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const userCookie = cookieStore.get("user")?.value;
        const user = userCookie ? JSON.parse(userCookie) : null;

        if (!user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { marketId, outcome, quantity, pricePerShare } = await request.json();

        // Validate input
        if (!marketId || !outcome || !quantity || !pricePerShare) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        if (quantity <= 0 || pricePerShare <= 0) {
            return NextResponse.json({ error: "Invalid quantity or price" }, { status: 400 });
        }

        if (outcome !== "YES" && outcome !== "NO") {
            return NextResponse.json({ error: "Invalid outcome. Must be YES or NO" }, { status: 400 });
        }

        // Get user wallet
        const wallet = await prisma.userWallet.findUnique({
            where: { u_id: user.id },
        });

        if (!wallet) {
            return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
        }

        const currency = wallet.currency;
        const currentBalance = Number(wallet.balance);

        // Check if user has the holding
        const holding = await prisma.polymarketHolding.findUnique({
            where: {
                u_id_market_id_outcome: {
                    u_id: user.id,
                    market_id: marketId,
                    outcome: outcome,
                },
            },
        });

        if (!holding) {
            return NextResponse.json({ error: "You don't own this position" }, { status: 400 });
        }

        if (holding.quantity < quantity) {
            return NextResponse.json({
                error: `Insufficient shares. You have ${holding.quantity} but trying to sell ${quantity}`,
            }, { status: 400 });
        }

        // Calculate total proceeds in USD
        const totalProceedsUSD = pricePerShare * quantity;

        // Convert to user's wallet currency
        const exchangeRate = EXCHANGE_RATES_TO_USD[currency as keyof typeof EXCHANGE_RATES_TO_USD];
        const totalProceedsInWalletCurrency = totalProceedsUSD * exchangeRate;

        console.log(`[SELL POLYMARKET] ${marketId} (${outcome}): ${quantity} shares @ $${pricePerShare} USD = $${totalProceedsUSD} USD = ${totalProceedsInWalletCurrency.toFixed(2)} ${currency}`);

        // Transaction: Update wallet, holdings, and create transaction record
        const result = await prisma.$transaction(async (tx) => {
            // 1. Add to wallet
            const updatedWallet = await tx.userWallet.update({
                where: { u_id: user.id },
                data: {
                    balance: currentBalance + totalProceedsInWalletCurrency,
                    updated_at: new Date(),
                },
            });

            // 2. Update or delete holding
            let updatedHolding = null;
            const remainingShares = holding.quantity - quantity;

            if (remainingShares > 0) {
                // Update remaining shares
                updatedHolding = await tx.polymarketHolding.update({
                    where: {
                        u_id_market_id_outcome: {
                            u_id: user.id,
                            market_id: marketId,
                            outcome: outcome,
                        },
                    },
                    data: {
                        quantity: remainingShares,
                        updated_at: new Date(),
                    },
                });
            } else {
                // Delete holding if sold all
                await tx.polymarketHolding.delete({
                    where: {
                        u_id_market_id_outcome: {
                            u_id: user.id,
                            market_id: marketId,
                            outcome: outcome,
                        },
                    },
                });
            }

            // 3. Record Polymarket transaction
            await tx.polymarketTransaction.create({
                data: {
                    u_id: user.id,
                    market_id: marketId,
                    outcome: outcome,
                    transaction_type: "SELL",
                    quantity: quantity,
                    price: pricePerShare,
                    total_amount: totalProceedsUSD,
                    currency: currency,
                },
            });

            // 4. Record wallet transaction for tracking money flow
            await tx.walletTransaction.create({
                data: {
                    u_id: user.id,
                    transaction_type: "POLYMARKET_SELL",
                    amount: totalProceedsInWalletCurrency,
                    currency: currency,
                    symbol: marketId,
                    quantity: Math.round(quantity),
                    price: pricePerShare,
                    description: `Sold ${quantity} ${outcome} shares`,
                    balance_after: updatedWallet.balance,
                },
            });

            return {
                holding: updatedHolding,
                wallet: updatedWallet,
            };
        });

        return NextResponse.json({
            success: true,
            message: `Successfully sold ${quantity} ${outcome} shares`,
            holding: result.holding,
            newBalance: result.wallet.balance,
        });

    } catch (error) {
        console.error("[SELL POLYMARKET ERROR]", error);
        return NextResponse.json(
            { error: "Failed to sell Polymarket position" },
            { status: 500 }
        );
    }
}
