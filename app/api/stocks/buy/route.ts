// API Route: Buy Stock
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

        // Calculate total cost in USD (stock prices are in USD)
        const totalCostUSD = pricePerShare * quantity;

        // Convert to user's wallet currency
        const exchangeRate = EXCHANGE_RATES_TO_USD[currency as keyof typeof EXCHANGE_RATES_TO_USD];
        const totalCostInWalletCurrency = totalCostUSD * exchangeRate;

        console.log(`[BUY STOCK] ${symbol}: ${quantity} shares @ $${pricePerShare} USD = $${totalCostUSD} USD = ${totalCostInWalletCurrency.toFixed(2)} ${currency}`);

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
            const existingHolding = await tx.stockHolding.findUnique({
                where: {
                    u_id_symbol: {
                        u_id: user.id,
                        symbol: symbol,
                    },
                },
            });

            let updatedHolding;
            if (existingHolding) {
                // Calculate new average price
                const totalShares = existingHolding.quantity + quantity;
                const totalCost = (existingHolding.quantity * existingHolding.avg_price) + totalCostUSD;
                const newAvgPrice = totalCost / totalShares;

                updatedHolding = await tx.stockHolding.update({
                    where: {
                        u_id_symbol: {
                            u_id: user.id,
                            symbol: symbol,
                        },
                    },
                    data: {
                        quantity: totalShares,
                        avg_price: newAvgPrice,
                        updated_at: new Date(),
                    },
                });
            } else {
                // Create new holding
                updatedHolding = await tx.stockHolding.create({
                    data: {
                        u_id: user.id,
                        symbol: symbol,
                        quantity: quantity,
                        avg_price: pricePerShare,
                    },
                });
            }

            // 3. Create transaction record
            const transaction = await tx.stockTransaction.create({
                data: {
                    u_id: user.id,
                    symbol: symbol,
                    transaction_type: 'BUY',
                    quantity: quantity,
                    price: pricePerShare,
                    total_amount: totalCostInWalletCurrency,
                    currency: currency,
                },
            });

            return { updatedWallet, updatedHolding, transaction };
        });

        console.log(`[BUY STOCK SUCCESS] User ${user.id} bought ${quantity} ${symbol} @ $${pricePerShare}`);

        return NextResponse.json({
            success: true,
            message: `Successfully bought ${quantity} shares of ${symbol}`,
            data: {
                symbol: symbol,
                quantity: quantity,
                pricePerShare: pricePerShare,
                totalCostUSD: totalCostUSD,
                totalCostInCurrency: totalCostInWalletCurrency,
                currency: currency,
                newBalance: Number(result.updatedWallet.balance),
                holding: {
                    totalShares: result.updatedHolding.quantity,
                    avgPrice: result.updatedHolding.avg_price,
                },
            },
        });
    } catch (error) {
        console.error("[BUY STOCK ERROR]", error);
        return NextResponse.json({ error: "Failed to process purchase" }, { status: 500 });
    }
}
