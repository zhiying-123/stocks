// API Route: Buy Polymarket Position
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

// Exchange rates (base: USD - Polymarket prices are in USD)
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

        console.log("[BUY POLYMARKET] User cookie:", user ? `id=${user.id}, email=${user.email}` : "NO USER COOKIE");

        if (!user?.id) {
            return NextResponse.json({ error: "Unauthorized - please log in again" }, { status: 401 });
        }

        const body = await request.json();
        const { marketId, outcome, quantity, pricePerShare, category } = body;

        console.log("[BUY POLYMARKET] Request body:", JSON.stringify({ marketId, outcome, quantity, pricePerShare, category }));

        // Validate input
        if (!marketId || !outcome || !quantity || pricePerShare == null) {
            return NextResponse.json({ error: `Missing required fields: marketId=${!!marketId}, outcome=${!!outcome}, quantity=${!!quantity}, pricePerShare=${pricePerShare}` }, { status: 400 });
        }

        if (quantity <= 0 || pricePerShare <= 0) {
            return NextResponse.json({ error: "Invalid quantity or price" }, { status: 400 });
        }

        if (outcome !== "YES" && outcome !== "NO") {
            return NextResponse.json({ error: "Invalid outcome. Must be YES or NO" }, { status: 400 });
        }

        // Debug: Check if prisma is defined
        console.log("[BUY POLYMARKET] Prisma client:", typeof prisma, prisma ? "OK" : "UNDEFINED");

        if (!prisma) {
            return NextResponse.json({ error: "Database connection error" }, { status: 500 });
        }

        // Get user wallet
        const wallet = await prisma.userWallet.findUnique({
            where: { u_id: user.id },
        });

        if (!wallet) {
            return NextResponse.json({ error: "Wallet not found. Please activate your wallet first at /wallet." }, { status: 404 });
        }

        const currency = wallet.currency;
        const currentBalance = Number(wallet.balance);

        // Calculate total cost in USD
        const totalCostUSD = pricePerShare * quantity;

        // Convert to user's wallet currency
        const exchangeRate = EXCHANGE_RATES_TO_USD[currency as keyof typeof EXCHANGE_RATES_TO_USD];
        if (!exchangeRate) {
            return NextResponse.json({ error: `Unsupported currency: ${currency}` }, { status: 400 });
        }
        const totalCostInWalletCurrency = totalCostUSD * exchangeRate;

        console.log(`[BUY POLYMARKET] User ${user.id}: ${marketId} (${outcome}): ${quantity} shares @ $${pricePerShare} USD = $${totalCostUSD} USD = ${totalCostInWalletCurrency.toFixed(2)} ${currency}, Balance: ${currentBalance.toFixed(2)} ${currency}`);

        // Check if user has enough balance
        if (currentBalance < totalCostInWalletCurrency) {
            return NextResponse.json({
                error: `Insufficient balance. Required: ${currency} ${totalCostInWalletCurrency.toFixed(2)}, Available: ${currency} ${currentBalance.toFixed(2)}`,
            }, { status: 400 });
        }

        // Transaction: Update wallet, holdings, and create transaction record
        const result = await prisma.$transaction(async (tx) => {
            // 1. Deduct from wallet
            const updatedWallet = await tx.userWallet.update({
                where: { u_id: user.id },
                data: {
                    balance: currentBalance - totalCostInWalletCurrency,
                    updated_at: new Date(),
                },
            });

            // 2. Update or create holding
            const existingHolding = await tx.polymarketHolding.findUnique({
                where: {
                    u_id_market_id_outcome: {
                        u_id: user.id,
                        market_id: marketId,
                        outcome: outcome,
                    },
                },
            });

            let updatedHolding;
            if (existingHolding) {
                // Calculate new average price
                const totalShares = existingHolding.quantity + quantity;
                const totalCost = (existingHolding.quantity * existingHolding.avg_price) + totalCostUSD;
                const newAvgPrice = totalCost / totalShares;

                updatedHolding = await tx.polymarketHolding.update({
                    where: {
                        u_id_market_id_outcome: {
                            u_id: user.id,
                            market_id: marketId,
                            outcome: outcome,
                        },
                    },
                    data: {
                        quantity: totalShares,
                        avg_price: newAvgPrice,
                        category: category || existingHolding.category,
                        updated_at: new Date(),
                    },
                });
            } else {
                // Create new holding
                updatedHolding = await tx.polymarketHolding.create({
                    data: {
                        u_id: user.id,
                        market_id: marketId,
                        outcome: outcome,
                        quantity: quantity,
                        avg_price: pricePerShare,
                        category: category || null,
                    },
                });
            }

            // 3. Record Polymarket transaction
            await tx.polymarketTransaction.create({
                data: {
                    u_id: user.id,
                    market_id: marketId,
                    outcome: outcome,
                    transaction_type: "BUY",
                    quantity: quantity,
                    price: pricePerShare,
                    total_amount: totalCostUSD,
                    currency: currency,
                    category: category || null,
                },
            });

            return {
                holding: updatedHolding,
                wallet: updatedWallet,
            };
        });

        return NextResponse.json({
            success: true,
            message: `Successfully bought ${quantity} ${outcome} shares`,
            holding: result.holding,
            newBalance: result.wallet.balance,
        });

    } catch (error: any) {
        console.error("[BUY POLYMARKET ERROR]", error);
        const message = error?.message || "Failed to buy Polymarket position";
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
