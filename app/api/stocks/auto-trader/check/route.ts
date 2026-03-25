import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { sendDiscordMessage } from "@/lib/discord";

type AutoTradeAction = "BUY" | "SELL";
type TriggerType = "PRICE_TARGET" | "MOVING_AVERAGE";
type TriggerDirection = "ABOVE" | "BELOW";
type NotifyChannel = "EMAIL" | "DISCORD";

const EXCHANGE_RATES_TO_USD = {
    USD: 1,
    MYR: 4.50,
    SGD: 1.35,
};

function parseNotifyChannels(value: string | null | undefined): NotifyChannel[] {
    if (!value) return ["EMAIL", "DISCORD"];

    const normalized = Array.from(
        new Set(
            value
                .split(",")
                .map((item) => item.trim().toUpperCase())
                .filter((item): item is NotifyChannel => item === "EMAIL" || item === "DISCORD")
        )
    );

    return normalized.length > 0 ? normalized : ["EMAIL", "DISCORD"];
}

function isTriggered(direction: TriggerDirection, currentPrice: number, triggerValue: number) {
    if (direction === "ABOVE") return currentPrice >= triggerValue;
    return currentPrice <= triggerValue;
}

async function fetchCurrentPriceUSD(symbol: string): Promise<number | null> {
    const key = process.env.FINNHUB_API_KEY;
    if (!key) throw new Error("Missing FINNHUB_API_KEY in environment");

    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`;
    const response = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json" },
    });

    if (!response.ok) {
        return null;
    }

    const data = await response.json();
    const currentPrice = Number(data?.c);
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
        return null;
    }

    return currentPrice;
}

async function fetchMovingAverageUSD(symbol: string, days: number): Promise<number | null> {
    const key = process.env.FINNHUB_API_KEY;
    if (!key) throw new Error("Missing FINNHUB_API_KEY in environment");

    const now = Math.floor(Date.now() / 1000);
    const lookbackDays = Math.max(days * 3, 30);
    const from = now - lookbackDays * 24 * 60 * 60;

    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${now}&token=${key}`;
    const response = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json" },
    });

    if (!response.ok) {
        return null;
    }

    const data = await response.json();
    if (data?.s !== "ok" || !Array.isArray(data?.c)) {
        return null;
    }

    const closes = data.c
        .map((value: unknown) => Number(value))
        .filter((value: number) => Number.isFinite(value) && value > 0);

    if (closes.length < days) {
        return null;
    }

    const recent = closes.slice(-days);
    const sum = recent.reduce((acc: number, value: number) => acc + value, 0);

    return Number((sum / days).toFixed(6));
}

async function executeAutoTrade({
    userId,
    symbol,
    action,
    quantity,
    pricePerShareUSD,
}: {
    userId: number;
    symbol: string;
    action: AutoTradeAction;
    quantity: number;
    pricePerShareUSD: number;
}) {
    const wallet = await prisma.userWallet.findUnique({
        where: { u_id: userId },
    });

    if (!wallet) {
        return { success: false as const, reason: "Wallet not found" };
    }

    const currency = wallet.currency;
    const exchangeRate = EXCHANGE_RATES_TO_USD[currency as keyof typeof EXCHANGE_RATES_TO_USD];

    if (!exchangeRate) {
        return { success: false as const, reason: `Unsupported wallet currency: ${currency}` };
    }

    const amountInUSD = pricePerShareUSD * quantity;
    const amountInWalletCurrency = amountInUSD * exchangeRate;
    const currentBalance = Number(wallet.balance);

    if (action === "BUY") {
        if (currentBalance < amountInWalletCurrency) {
            return {
                success: false as const,
                reason: `Insufficient balance. Required ${currency} ${amountInWalletCurrency.toFixed(2)}, available ${currency} ${currentBalance.toFixed(2)}`,
            };
        }

        await prisma.$transaction(async (tx) => {
            const updatedWallet = await tx.userWallet.update({
                where: { u_id: userId },
                data: {
                    balance: currentBalance - amountInWalletCurrency,
                    updated_at: new Date(),
                },
            });

            const existingHolding = await tx.stockHolding.findUnique({
                where: {
                    u_id_symbol: {
                        u_id: userId,
                        symbol,
                    },
                },
            });

            if (existingHolding) {
                const totalShares = existingHolding.quantity + quantity;
                const totalCostUSD = existingHolding.quantity * existingHolding.avg_price + amountInUSD;
                const newAvgPrice = totalCostUSD / totalShares;

                await tx.stockHolding.update({
                    where: {
                        u_id_symbol: {
                            u_id: userId,
                            symbol,
                        },
                    },
                    data: {
                        quantity: totalShares,
                        avg_price: newAvgPrice,
                        updated_at: new Date(),
                    },
                });
            } else {
                await tx.stockHolding.create({
                    data: {
                        u_id: userId,
                        symbol,
                        quantity,
                        avg_price: pricePerShareUSD,
                    },
                });
            }

            await tx.stockTransaction.create({
                data: {
                    u_id: userId,
                    symbol,
                    transaction_type: "BUY",
                    quantity,
                    price: pricePerShareUSD,
                    total_amount: amountInWalletCurrency,
                    currency,
                },
            });

            await tx.walletTransaction.create({
                data: {
                    u_id: userId,
                    transaction_type: "STOCK_BUY",
                    amount: amountInWalletCurrency,
                    currency,
                    symbol,
                    quantity,
                    price: pricePerShareUSD,
                    description: `AutoTrader BUY ${quantity} shares of ${symbol}`,
                    balance_after: Number(updatedWallet.balance),
                },
            });
        });

        return {
            success: true as const,
            walletCurrency: currency,
            amountInWalletCurrency,
            amountInUSD,
        };
    }

    const holding = await prisma.stockHolding.findUnique({
        where: {
            u_id_symbol: {
                u_id: userId,
                symbol,
            },
        },
    });

    if (!holding || holding.quantity < quantity) {
        return {
            success: false as const,
            reason: `Insufficient shares to sell. Own ${holding?.quantity || 0}, requested ${quantity}`,
        };
    }

    await prisma.$transaction(async (tx) => {
        const updatedWallet = await tx.userWallet.update({
            where: { u_id: userId },
            data: {
                balance: currentBalance + amountInWalletCurrency,
                updated_at: new Date(),
            },
        });

        const remainingQuantity = holding.quantity - quantity;

        if (remainingQuantity === 0) {
            await tx.stockHolding.delete({
                where: {
                    u_id_symbol: {
                        u_id: userId,
                        symbol,
                    },
                },
            });
        } else {
            await tx.stockHolding.update({
                where: {
                    u_id_symbol: {
                        u_id: userId,
                        symbol,
                    },
                },
                data: {
                    quantity: remainingQuantity,
                    updated_at: new Date(),
                },
            });
        }

        await tx.stockTransaction.create({
            data: {
                u_id: userId,
                symbol,
                transaction_type: "SELL",
                quantity,
                price: pricePerShareUSD,
                total_amount: amountInWalletCurrency,
                currency,
            },
        });

        await tx.walletTransaction.create({
            data: {
                u_id: userId,
                transaction_type: "STOCK_SELL",
                amount: amountInWalletCurrency,
                currency,
                symbol,
                quantity,
                price: pricePerShareUSD,
                description: `AutoTrader SELL ${quantity} shares of ${symbol}`,
                balance_after: Number(updatedWallet.balance),
            },
        });
    });

    return {
        success: true as const,
        walletCurrency: currency,
        amountInWalletCurrency,
        amountInUSD,
    };
}

async function notifyExecution({
    channels,
    userEmail,
    userName,
    symbol,
    action,
    quantity,
    currentPriceUSD,
    triggerType,
    triggerValue,
    status,
    failureReason,
}: {
    channels: NotifyChannel[];
    userEmail: string | null;
    userName: string;
    symbol: string;
    action: AutoTradeAction;
    quantity: number;
    currentPriceUSD: number;
    triggerType: TriggerType;
    triggerValue: number;
    status: "SUCCESS" | "FAILED";
    failureReason?: string;
}) {
    const triggerText = triggerType === "PRICE_TARGET"
        ? `Target price ${triggerValue.toFixed(4)} USD`
        : `${Math.round(triggerValue)}-day MA ${triggerValue.toFixed(4)} USD`;

    const summaryLine = status === "SUCCESS"
        ? `Executed ${action} ${quantity} ${symbol} @ ${currentPriceUSD.toFixed(4)} USD.`
        : `Trade failed for ${action} ${quantity} ${symbol} @ ${currentPriceUSD.toFixed(4)} USD.`;

    const reasonLine = failureReason ? `Reason: ${failureReason}` : null;

    if (channels.includes("EMAIL") && userEmail) {
        try {
            await sendEmail({
                to: userEmail,
                subject: status === "SUCCESS"
                    ? `AutoTrader Executed: ${action} ${symbol}`
                    : `AutoTrader Failed: ${action} ${symbol}`,
                text: [
                    `Hi ${userName},`,
                    "",
                    "Your stock auto-trader rule has been triggered.",
                    summaryLine,
                    `Trigger: ${triggerText}`,
                    reasonLine,
                    "",
                    "This rule has been deactivated.",
                ].filter(Boolean).join("\n"),
            });
        } catch (emailError) {
            console.error("[AUTO TRADER CHECK] Failed to send email", emailError);
        }
    }

    if (channels.includes("DISCORD")) {
        try {
            await sendDiscordMessage({
                title: status === "SUCCESS"
                    ? "🤖 **Stock AutoTrader Executed**"
                    : "⚠️ **Stock AutoTrader Triggered But Failed**",
                lines: [
                    `📌 Symbol: ${symbol}`,
                    `📈 Action: ${action}`,
                    `🔢 Quantity: ${quantity}`,
                    `💵 Current Price: ${currentPriceUSD.toFixed(4)} USD`,
                    `🎯 Trigger: ${triggerText}`,
                    reasonLine || "✅ Rule deactivated after execution.",
                    `👤 User: ${userName}${userEmail ? ` (${userEmail})` : ""}`,
                ].filter(Boolean) as string[],
            });
        } catch (discordError) {
            console.error("[AUTO TRADER CHECK] Failed to send discord message", discordError);
        }
    }
}

export async function GET(req: NextRequest) {
    try {
        const expectedSecret = process.env.STOCK_AUTO_TRADER_CRON_SECRET || process.env.CRON_SECRET;
        if (expectedSecret) {
            const headerSecret = req.headers.get("x-cron-secret");
            const querySecret = req.nextUrl.searchParams.get("secret");
            if (headerSecret !== expectedSecret && querySecret !== expectedSecret) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        }

        const activeRules = await prisma.stockAutoTrader.findMany({
            where: { is_active: true },
            orderBy: { created_at: "asc" },
        });

        if (activeRules.length === 0) {
            return NextResponse.json({
                success: true,
                checked: 0,
                triggered: 0,
                executed: 0,
                failed: 0,
            });
        }

        const users = await prisma.user.findMany({
            where: {
                u_id: {
                    in: Array.from(new Set(activeRules.map((rule) => rule.u_id))),
                },
            },
            select: {
                u_id: true,
                email: true,
                name: true,
            },
        });

        const userMap = new Map(users.map((user) => [user.u_id, user]));
        const quoteCache = new Map<string, number | null>();
        const maCache = new Map<string, number | null>();

        let triggeredCount = 0;
        let executedCount = 0;
        let failedCount = 0;

        for (const rule of activeRules) {
            try {
                const symbol = rule.symbol.toUpperCase();

                let currentPriceUSD = quoteCache.get(symbol);
                if (currentPriceUSD === undefined) {
                    currentPriceUSD = await fetchCurrentPriceUSD(symbol);
                    quoteCache.set(symbol, currentPriceUSD);
                }

                if (!currentPriceUSD) {
                    await prisma.stockAutoTrader.update({
                        where: { auto_id: rule.auto_id },
                        data: {
                            last_error: "Unable to fetch current stock price",
                        },
                    });
                    continue;
                }

                let triggerValue: number | null = null;

                if (rule.trigger_type === "PRICE_TARGET") {
                    triggerValue = rule.target_price;
                } else if (rule.trigger_type === "MOVING_AVERAGE") {
                    const days = rule.moving_average_days;
                    if (!days) {
                        await prisma.stockAutoTrader.update({
                            where: { auto_id: rule.auto_id },
                            data: { last_error: "Missing moving_average_days for MOVING_AVERAGE rule" },
                        });
                        continue;
                    }

                    const cacheKey = `${symbol}:${days}`;
                    let movingAverage = maCache.get(cacheKey);
                    if (movingAverage === undefined) {
                        movingAverage = await fetchMovingAverageUSD(symbol, days);
                        maCache.set(cacheKey, movingAverage);
                    }
                    triggerValue = movingAverage;
                }

                if (!triggerValue) {
                    await prisma.stockAutoTrader.update({
                        where: { auto_id: rule.auto_id },
                        data: {
                            last_checked_price: currentPriceUSD,
                            last_trigger_value: null,
                            last_error: "Unable to resolve trigger value",
                        },
                    });
                    continue;
                }

                const direction = rule.direction as TriggerDirection;
                const matched = isTriggered(direction, currentPriceUSD, triggerValue);

                await prisma.stockAutoTrader.update({
                    where: { auto_id: rule.auto_id },
                    data: {
                        last_checked_price: currentPriceUSD,
                        last_trigger_value: triggerValue,
                        last_error: null,
                    },
                });

                if (!matched) {
                    continue;
                }

                triggeredCount += 1;

                const action = rule.action as AutoTradeAction;
                const executionResult = await executeAutoTrade({
                    userId: rule.u_id,
                    symbol,
                    action,
                    quantity: rule.quantity,
                    pricePerShareUSD: currentPriceUSD,
                });

                const user = userMap.get(rule.u_id);
                const userName = user?.name || "Trader";
                const userEmail = user?.email || null;
                const channels = parseNotifyChannels(rule.notify_channels);

                if (executionResult.success) {
                    executedCount += 1;

                    await prisma.stockAutoTrader.update({
                        where: { auto_id: rule.auto_id },
                        data: {
                            is_active: false,
                            triggered_at: new Date(),
                            executed_at: new Date(),
                            last_error: null,
                        },
                    });

                    await notifyExecution({
                        channels,
                        userEmail,
                        userName,
                        symbol,
                        action,
                        quantity: rule.quantity,
                        currentPriceUSD,
                        triggerType: rule.trigger_type as TriggerType,
                        triggerValue,
                        status: "SUCCESS",
                    });
                } else {
                    failedCount += 1;

                    await prisma.stockAutoTrader.update({
                        where: { auto_id: rule.auto_id },
                        data: {
                            is_active: false,
                            triggered_at: new Date(),
                            executed_at: null,
                            last_error: executionResult.reason,
                        },
                    });

                    await notifyExecution({
                        channels,
                        userEmail,
                        userName,
                        symbol,
                        action,
                        quantity: rule.quantity,
                        currentPriceUSD,
                        triggerType: rule.trigger_type as TriggerType,
                        triggerValue,
                        status: "FAILED",
                        failureReason: executionResult.reason,
                    });
                }
            } catch (ruleError) {
                console.error("[AUTO TRADER CHECK] Failed to process rule", {
                    autoId: rule.auto_id,
                    userId: rule.u_id,
                    ruleError,
                });

                await prisma.stockAutoTrader.update({
                    where: { auto_id: rule.auto_id },
                    data: {
                        last_error: ruleError instanceof Error ? ruleError.message : "Unexpected error",
                    },
                }).catch(() => {
                    return null;
                });
            }
        }

        return NextResponse.json({
            success: true,
            checked: activeRules.length,
            triggered: triggeredCount,
            executed: executedCount,
            failed: failedCount,
        });
    } catch (error) {
        console.error("[AUTO TRADER CHECK]", error);
        return NextResponse.json({ error: "Failed to run auto-trader check" }, { status: 500 });
    }
}
