import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { sendDiscordAlert, sendDiscordMessage } from "@/lib/discord";

const POLYMARKET_API = "https://gamma-api.polymarket.com";
const EXCHANGE_RATES_TO_USD = {
    USD: 1,
    MYR: 4.50,
    SGD: 1.35,
};

type MarketPriceInfo = {
    yes: number;
    no: number;
    question: string;
};

type AlertNotifyChannel = "EMAIL" | "DISCORD";
type AutoBuyFieldRow = {
    alert_id: number;
    auto_buy_enabled: boolean;
    auto_buy_quantity: number | null;
    auto_buy_budget: number | null;
    auto_buy_retry_max: number;
    auto_buy_retry_count: number;
    auto_buy_cooldown_m: number;
    auto_buy_next_retry_at: Date | null;
    auto_buy_last_error: string | null;
    tp_target_percent: number | null;
    sl_target_percent: number | null;
    parent_alert_id: number | null;
    alert_tag: string | null;
};

function getUserIdFromCookie(req: NextRequest): number | null {
    const raw = req.cookies.get("user")?.value;
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);
        const userId = Number(parsed?.id);
        return Number.isInteger(userId) && userId > 0 ? userId : null;
    } catch {
        return null;
    }
}

function parseNotifyChannels(value: string | null | undefined): AlertNotifyChannel[] {
    if (!value) return ["EMAIL", "DISCORD"];
    const normalized = Array.from(
        new Set(
            value
                .split(",")
                .map((item) => item.trim().toUpperCase())
                .filter((item): item is AlertNotifyChannel => item === "EMAIL" || item === "DISCORD")
        )
    );
    return normalized.length > 0 ? normalized : ["EMAIL", "DISCORD"];
}

function parseNotifyChannelsFromSource(source: string | null | undefined): AlertNotifyChannel[] {
    const raw = String(source || "");
    const [, channelSegment] = raw.split("|");
    return parseNotifyChannels(channelSegment);
}

function formatNotifyChannels(channels: AlertNotifyChannel[]) {
    return channels.join(",");
}

function parseStringArray(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((v) => String(v));
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
        } catch {
            return [];
        }
    }
    return [];
}

function parsePricePair(value: unknown): [number, number] | null {
    let prices = value;

    if (typeof prices === "string") {
        try {
            prices = JSON.parse(prices);
        } catch {
            return null;
        }
    }

    if (!Array.isArray(prices) || prices.length < 2) {
        return null;
    }

    const yes = Number(prices[0]);
    const no = Number(prices[1]);
    if (!Number.isFinite(yes) || !Number.isFinite(no)) {
        return null;
    }

    return [yes, no];
}

async function fetchPriceMap(requiredMarketIds: Set<string>) {
    const priceMap = new Map<string, MarketPriceInfo>();
    if (requiredMarketIds.size === 0) return priceMap;

    const limit = 500;
    const maxPages = 12;

    for (let page = 0; page < maxPages; page += 1) {
        const offset = page * limit;
        const response = await fetch(`${POLYMARKET_API}/events?limit=${limit}&offset=${offset}&closed=false`, {
            cache: "no-store",
            headers: {
                Accept: "application/json",
            },
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            throw new Error(`Polymarket events fetch failed: ${response.status}`);
        }

        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) {
            break;
        }

        for (const event of data) {
            if (!event?.markets || !Array.isArray(event.markets)) continue;

            for (const market of event.markets) {
                const parsedPrices = parsePricePair(market?.outcomePrices);
                if (!parsedPrices) continue;

                const [yesPrice, noPrice] = parsedPrices;

                const conditionId = String(market?.conditionId || "").trim();
                const clobIds = parseStringArray(market?.clobTokenIds)
                    .map((id) => id.trim())
                    .filter(Boolean);
                const candidateIds = Array.from(new Set([conditionId, ...clobIds].filter(Boolean)));
                const matchedIds = candidateIds.filter((id) => requiredMarketIds.has(id));
                if (matchedIds.length === 0) continue;

                const question = String(market?.question || event?.title || matchedIds[0]);
                for (const id of matchedIds) {
                    priceMap.set(id, {
                        yes: yesPrice,
                        no: noPrice,
                        question,
                    });
                }
            }
        }

        if (priceMap.size >= requiredMarketIds.size) {
            break;
        }

        if (data.length < limit) {
            break;
        }
    }

    return priceMap;
}

function isTriggered(direction: string, currentPrice: number, targetPrice: number) {
    if (direction === "ABOVE") return currentPrice >= targetPrice;
    if (direction === "BELOW") return currentPrice <= targetPrice;
    return false;
}

function toYesCondition(outcome: string, direction: string, targetPrice: number) {
    const targetPercent = targetPrice * 100;

    if (outcome === "YES") {
        return {
            operator: direction === "BELOW" ? "≤" : "≥",
            thresholdPercent: targetPercent,
        };
    }

    return {
        operator: direction === "BELOW" ? "≥" : "≤",
        thresholdPercent: 100 - targetPercent,
    };
}

async function executeAutoBuy({
    userId,
    marketId,
    outcome,
    quantity,
    pricePerShare,
    category,
    budgetLimit,
}: {
    userId: number;
    marketId: string;
    outcome: "YES" | "NO";
    quantity: number;
    pricePerShare: number;
    category: string | null;
    budgetLimit: number | null;
}) {
    if (!Number.isFinite(pricePerShare) || pricePerShare <= 0 || pricePerShare >= 1) {
        return { success: false as const, reason: "PRICE_INVALID: Market price is invalid for execution" };
    }

    const wallet = await prisma.userWallet.findUnique({
        where: { u_id: userId },
    });

    if (!wallet) {
        return { success: false as const, reason: "WALLET_NOT_FOUND: Wallet not found" };
    }

    const currency = wallet.currency;
    const exchangeRate = EXCHANGE_RATES_TO_USD[currency as keyof typeof EXCHANGE_RATES_TO_USD];

    if (!exchangeRate) {
        return { success: false as const, reason: `CURRENCY_UNSUPPORTED: Unsupported wallet currency ${currency}` };
    }

    const totalCostUSD = pricePerShare * quantity;
    const totalCostInWalletCurrency = totalCostUSD * exchangeRate;
    const currentBalance = Number(wallet.balance);

    if (budgetLimit != null && totalCostInWalletCurrency > budgetLimit) {
        return {
            success: false as const,
            reason: `BUDGET_EXCEEDED: Estimated cost ${currency} ${totalCostInWalletCurrency.toFixed(2)} exceeds budget ${currency} ${budgetLimit.toFixed(2)}`,
        };
    }

    if (currentBalance < totalCostInWalletCurrency) {
        return {
            success: false as const,
            reason: `INSUFFICIENT_BALANCE: Required ${currency} ${totalCostInWalletCurrency.toFixed(2)}, available ${currency} ${currentBalance.toFixed(2)}`,
        };
    }

    await prisma.$transaction(async (tx) => {
        await tx.userWallet.update({
            where: { u_id: userId },
            data: {
                balance: currentBalance - totalCostInWalletCurrency,
                updated_at: new Date(),
            },
        });

        const existingHolding = await tx.polymarketHolding.findUnique({
            where: {
                u_id_market_id_outcome: {
                    u_id: userId,
                    market_id: marketId,
                    outcome,
                },
            },
        });

        if (existingHolding) {
            const totalShares = existingHolding.quantity + quantity;
            const totalCost = existingHolding.quantity * existingHolding.avg_price + totalCostUSD;
            const newAvgPrice = totalCost / totalShares;

            await tx.polymarketHolding.update({
                where: {
                    u_id_market_id_outcome: {
                        u_id: userId,
                        market_id: marketId,
                        outcome,
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
            await tx.polymarketHolding.create({
                data: {
                    u_id: userId,
                    market_id: marketId,
                    outcome,
                    quantity,
                    avg_price: pricePerShare,
                    category: category || null,
                },
            });
        }

        await tx.polymarketTransaction.create({
            data: {
                u_id: userId,
                market_id: marketId,
                outcome,
                transaction_type: "BUY",
                quantity,
                price: pricePerShare,
                total_amount: totalCostUSD,
                currency,
                category: category || null,
            },
        });
    });

    return {
        success: true as const,
        quantity,
        totalCostUSD,
        totalCostInWalletCurrency,
        currency,
    };
}

async function createLinkedTpSlAlerts({
    alert,
    tpTargetPercent,
    slTargetPercent,
}: {
    alert: {
        alert_id: number;
        u_id: number;
        market_id: string;
        outcome: string;
        source: string;
    };
    tpTargetPercent: number | null;
    slTargetPercent: number | null;
}) {
    const notifyChannels = parseNotifyChannelsFromSource(alert.source);
    const notifySource = `DIRECT|${formatNotifyChannels(notifyChannels)}`;
    const normalizedOutcome = alert.outcome === "NO" ? "NO" : "YES";

    if (tpTargetPercent != null && tpTargetPercent > 0 && tpTargetPercent < 100) {
        const tpAlert = await prisma.polymarketPriceAlert.create({
            data: {
                u_id: alert.u_id,
                market_id: alert.market_id,
                outcome: normalizedOutcome,
                direction: "ABOVE",
                target_price: Number((tpTargetPercent / 100).toFixed(6)),
                source: notifySource,
                is_active: true,
            },
        });

        await prisma.$executeRaw`
            UPDATE "PolymarketPriceAlert"
            SET
                "parent_alert_id" = ${alert.alert_id},
                "alert_tag" = 'TP',
                "auto_buy_enabled" = false,
                "auto_buy_quantity" = NULL,
                "auto_buy_budget" = NULL,
                "auto_buy_retry_max" = 0,
                "auto_buy_retry_count" = 0,
                "auto_buy_next_retry_at" = NULL,
                "auto_buy_last_error" = NULL,
                "updated_at" = NOW()
            WHERE "alert_id" = ${tpAlert.alert_id}
        `;
    }

    if (slTargetPercent != null && slTargetPercent > 0 && slTargetPercent < 100) {
        const slAlert = await prisma.polymarketPriceAlert.create({
            data: {
                u_id: alert.u_id,
                market_id: alert.market_id,
                outcome: normalizedOutcome,
                direction: "BELOW",
                target_price: Number((slTargetPercent / 100).toFixed(6)),
                source: notifySource,
                is_active: true,
            },
        });

        await prisma.$executeRaw`
            UPDATE "PolymarketPriceAlert"
            SET
                "parent_alert_id" = ${alert.alert_id},
                "alert_tag" = 'SL',
                "auto_buy_enabled" = false,
                "auto_buy_quantity" = NULL,
                "auto_buy_budget" = NULL,
                "auto_buy_retry_max" = 0,
                "auto_buy_retry_count" = 0,
                "auto_buy_next_retry_at" = NULL,
                "auto_buy_last_error" = NULL,
                "updated_at" = NOW()
            WHERE "alert_id" = ${slAlert.alert_id}
        `;
    }
}

export async function GET(req: NextRequest) {
    try {
        const manualMode = req.nextUrl.searchParams.get("manual") === "1";
        const manualMarketId = req.nextUrl.searchParams.get("marketId")?.trim() || null;
        const manualUserId = getUserIdFromCookie(req);

        const acceptedSecrets = Array.from(
            new Set([
                process.env.POLYMARKET_ALERT_CRON_SECRET,
                process.env.CRON_SECRET,
            ].filter((value): value is string => Boolean(value && value.trim())))
        );
        let scopedUserId: number | null = null;

        if (acceptedSecrets.length > 0) {
            const headerSecret = req.headers.get("x-cron-secret");
            const authHeader = req.headers.get("authorization") || "";
            const bearerSecret = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
            const querySecret = req.nextUrl.searchParams.get("secret");
            const providedSecrets = [headerSecret, querySecret, bearerSecret].filter((value): value is string => Boolean(value && value.trim()));
            const matched = providedSecrets.some((provided) => acceptedSecrets.includes(provided));
            if (!matched) {
                if (manualMode && manualUserId) {
                    scopedUserId = manualUserId;
                } else {
                    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
                }
            }
        } else if (manualMode) {
            if (!manualUserId) {
                return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
            }
            scopedUserId = manualUserId;
        }

        const alertWhere: { is_active: boolean; u_id?: number; market_id?: string } = { is_active: true };
        if (scopedUserId) {
            alertWhere.u_id = scopedUserId;
        }
        if (manualMarketId) {
            alertWhere.market_id = manualMarketId;
        }

        const activeAlerts = await prisma.polymarketPriceAlert.findMany({
            where: alertWhere,
            orderBy: { created_at: "asc" },
        });

        const autoBuyRows = await prisma.$queryRaw<AutoBuyFieldRow[]>`
            SELECT
                "alert_id",
                "auto_buy_enabled",
                "auto_buy_quantity",
                "auto_buy_budget",
                "auto_buy_retry_max",
                "auto_buy_retry_count",
                "auto_buy_cooldown_m",
                "auto_buy_next_retry_at",
                "auto_buy_last_error",
                "tp_target_percent",
                "sl_target_percent",
                "parent_alert_id",
                "alert_tag"
            FROM "PolymarketPriceAlert"
                        WHERE "is_active" = true
                            AND (${scopedUserId}::int IS NULL OR "u_id" = ${scopedUserId})
                            AND (${manualMarketId}::text IS NULL OR "market_id" = ${manualMarketId})
        `;
        const autoBuyMap = new Map(autoBuyRows.map((row) => [row.alert_id, row]));

        if (activeAlerts.length === 0) {
            return NextResponse.json({
                success: true,
                checked: 0,
                triggered: 0,
                emailsSent: 0,
                discordSent: 0,
            });
        }

        const requiredMarketIds = new Set(activeAlerts.map((alert) => alert.market_id));

        const [priceMap, users] = await Promise.all([
            fetchPriceMap(requiredMarketIds),
            prisma.user.findMany({
                where: {
                    u_id: {
                        in: Array.from(new Set(activeAlerts.map((alert) => alert.u_id))),
                    },
                },
                select: {
                    u_id: true,
                    email: true,
                    name: true,
                },
            }),
        ]);

        const userMap = new Map(users.map((user) => [user.u_id, user]));

        let triggeredCount = 0;
        let emailsSentCount = 0;
        let discordSentCount = 0;
        let autoBuyExecutedCount = 0;
        let autoBuyFailedCount = 0;
        let autoBuyRetryScheduledCount = 0;

        for (const alert of activeAlerts) {
            const autoBuyRow = autoBuyMap.get(alert.alert_id);
            const marketInfo = priceMap.get(alert.market_id);
            if (!marketInfo) {
                if (autoBuyRow?.auto_buy_enabled) {
                    await prisma.$executeRaw`
                        UPDATE "PolymarketPriceAlert"
                        SET
                            "auto_buy_last_error" = 'MARKET_CLOSED_OR_UNAVAILABLE: Market is closed or unavailable',
                            "updated_at" = NOW()
                        WHERE "alert_id" = ${alert.alert_id}
                    `;
                }
                continue;
            }

            const currentPrice = alert.outcome === "NO" ? marketInfo.no : marketInfo.yes;
            const matched = isTriggered(alert.direction, currentPrice, alert.target_price);
            if (!matched) continue;

            const user = userMap.get(alert.u_id);
            const userName = user?.name || "Trader";
            const userEmail = user?.email || null;

            try {
                const currentPercent = (currentPrice * 100).toFixed(2);
                const targetPercent = (alert.target_price * 100).toFixed(2);
                const currentYesPercent = (marketInfo.yes * 100).toFixed(2);
                const yesCondition = toYesCondition(alert.outcome, alert.direction, alert.target_price);
                const conditionText = `YES ${yesCondition.operator} ${yesCondition.thresholdPercent.toFixed(2)}%`;
                const autoBuyRequested = Boolean(autoBuyRow?.auto_buy_enabled) && Number(autoBuyRow?.auto_buy_quantity || 0) > 0;
                let autoBuyExecuted = false;
                let shouldDeactivateAlert = true;
                let shouldSendBaseTriggerNotification = true;
                let retryStateText: string | null = null;
                let autoBuyExecutionDetails: {
                    quantity: number;
                    pricePercent: string;
                    totalCostWallet: string;
                    totalCostUSD: string;
                    currency: string;
                    status: "SUCCESS" | "FAILED";
                    reason?: string;
                } | null = null;

                if (autoBuyRequested) {
                    const now = new Date();
                    const nextRetryAt = autoBuyRow?.auto_buy_next_retry_at ? new Date(autoBuyRow.auto_buy_next_retry_at) : null;
                    if (nextRetryAt && nextRetryAt.getTime() > now.getTime()) {
                        continue;
                    }

                    const autoBuyResult = await executeAutoBuy({
                        userId: alert.u_id,
                        marketId: alert.market_id,
                        outcome: alert.outcome === "NO" ? "NO" : "YES",
                        quantity: Number(autoBuyRow?.auto_buy_quantity),
                        pricePerShare: currentPrice,
                        category: null,
                        budgetLimit: autoBuyRow?.auto_buy_budget ?? null,
                    });

                    if (autoBuyResult.success) {
                        autoBuyExecutedCount += 1;
                        autoBuyExecuted = true;
                        autoBuyExecutionDetails = {
                            quantity: autoBuyResult.quantity,
                            pricePercent: currentPercent,
                            totalCostWallet: autoBuyResult.totalCostInWalletCurrency.toFixed(2),
                            totalCostUSD: autoBuyResult.totalCostUSD.toFixed(4),
                            currency: autoBuyResult.currency,
                            status: "SUCCESS",
                        };

                        await createLinkedTpSlAlerts({
                            alert,
                            tpTargetPercent: autoBuyRow?.tp_target_percent ?? null,
                            slTargetPercent: autoBuyRow?.sl_target_percent ?? null,
                        });
                    } else {
                        autoBuyFailedCount += 1;
                        const nextRetryCount = (autoBuyRow?.auto_buy_retry_count ?? 0) + 1;
                        const retryMax = Math.max(0, autoBuyRow?.auto_buy_retry_max ?? 0);
                        const cooldownMinutes = Math.max(1, autoBuyRow?.auto_buy_cooldown_m ?? 5);
                        const canRetry = nextRetryCount <= retryMax;
                        const nextRetryAtDate = canRetry ? new Date(Date.now() + cooldownMinutes * 60 * 1000) : null;

                        shouldDeactivateAlert = !canRetry;
                        shouldSendBaseTriggerNotification = !canRetry;
                        retryStateText = canRetry
                            ? `Retry scheduled (${nextRetryCount}/${retryMax}) at ${nextRetryAtDate?.toISOString()}`
                            : `Retries exhausted (${Math.max(0, nextRetryCount - 1)}/${retryMax})`;

                        if (canRetry) {
                            autoBuyRetryScheduledCount += 1;
                            await prisma.$executeRaw`
                                UPDATE "PolymarketPriceAlert"
                                SET
                                    "auto_buy_retry_count" = ${nextRetryCount},
                                    "auto_buy_next_retry_at" = ${nextRetryAtDate},
                                    "auto_buy_last_error" = ${autoBuyResult.reason},
                                    "auto_buy_executed_at" = NULL,
                                    "updated_at" = NOW()
                                WHERE "alert_id" = ${alert.alert_id}
                            `;
                        } else {
                            await prisma.$executeRaw`
                                UPDATE "PolymarketPriceAlert"
                                SET
                                    "auto_buy_retry_count" = ${nextRetryCount},
                                    "auto_buy_next_retry_at" = NULL,
                                    "auto_buy_last_error" = ${autoBuyResult.reason},
                                    "auto_buy_executed_at" = NULL,
                                    "updated_at" = NOW()
                                WHERE "alert_id" = ${alert.alert_id}
                            `;
                        }

                        autoBuyExecutionDetails = {
                            quantity: Number(autoBuyRow?.auto_buy_quantity || 0),
                            pricePercent: currentPercent,
                            totalCostWallet: "0.00",
                            totalCostUSD: "0.0000",
                            currency: "-",
                            status: "FAILED",
                            reason: autoBuyResult.reason,
                        };
                    }
                }

                let emailSent = false;
                let discordSent = false;
                const notifyChannels = parseNotifyChannelsFromSource(alert.source);
                const shouldNotifyEmail = notifyChannels.includes("EMAIL");
                const shouldNotifyDiscord = notifyChannels.includes("DISCORD");

                if (shouldSendBaseTriggerNotification && shouldNotifyEmail && userEmail) {
                    try {
                        await sendEmail({
                            to: userEmail,
                            subject: `Polymarket Alert Triggered (${alert.outcome})`,
                            text: [
                                `Hi ${userName},`,
                                "",
                                `Your Polymarket alert has been triggered for:`,
                                `${marketInfo.question}`,
                                "",
                                `Outcome: ${alert.outcome}`,
                                `Condition: ${alert.direction} ${targetPercent}%`,
                                `Current price: ${currentPercent}%`,
                                "",
                                `Market ID: ${alert.market_id}`,
                                "",
                                shouldDeactivateAlert
                                    ? "This alert has now been deactivated."
                                    : "Auto buy failed and is scheduled to retry.",
                            ].join("\n"),
                        });
                        emailSent = true;
                        emailsSentCount += 1;
                    } catch (emailError) {
                        console.error("[POLYMARKET ALERT CHECK] Failed to send alert email", {
                            alertId: alert.alert_id,
                            userId: alert.u_id,
                            emailError,
                        });
                    }
                }

                if (autoBuyRequested && autoBuyExecutionDetails) {
                    if (shouldNotifyEmail && userEmail) {
                        try {
                            await sendEmail({
                                to: userEmail,
                                subject: autoBuyExecutionDetails.status === "SUCCESS"
                                    ? `Auto Buy Executed (${alert.outcome})`
                                    : `Auto Buy Failed (${alert.outcome})`,
                                text: [
                                    `Hi ${userName},`,
                                    "",
                                    autoBuyExecutionDetails.status === "SUCCESS"
                                        ? "Your Auto Buy order has been executed."
                                        : "Your Auto Buy order was triggered but failed.",
                                    `Market: ${marketInfo.question}`,
                                    `Outcome: ${alert.outcome}`,
                                    `Quantity: ${autoBuyExecutionDetails.quantity}`,
                                    `Execution price: ${autoBuyExecutionDetails.pricePercent}%`,
                                    autoBuyExecutionDetails.status === "SUCCESS"
                                        ? `Total cost: ${autoBuyExecutionDetails.currency} ${autoBuyExecutionDetails.totalCostWallet} (USD ${autoBuyExecutionDetails.totalCostUSD})`
                                        : `Failure reason: ${autoBuyExecutionDetails.reason || "Unknown error"}`,
                                    autoBuyExecutionDetails.status === "FAILED" && retryStateText
                                        ? `Retry status: ${retryStateText}`
                                        : "",
                                    "",
                                    `Market ID: ${alert.market_id}`,
                                ].join("\n"),
                            });
                            emailsSentCount += 1;
                        } catch (emailError) {
                            console.error("[POLYMARKET ALERT CHECK] Failed to send auto-buy detail email", {
                                alertId: alert.alert_id,
                                userId: alert.u_id,
                                emailError,
                            });
                        }
                    }

                    if (shouldNotifyDiscord) {
                        try {
                            const sent = await sendDiscordMessage({
                                title: autoBuyExecutionDetails.status === "SUCCESS"
                                    ? "🛒 **Polymarket Auto Buy Executed**"
                                    : "⚠️ **Polymarket Auto Buy Failed**",
                                lines: [
                                    `📌 Market: ${marketInfo.question}`,
                                    `🎯 Outcome: ${alert.outcome}`,
                                    `🔢 Quantity: ${autoBuyExecutionDetails.quantity}`,
                                    `💵 Execution price: ${autoBuyExecutionDetails.pricePercent}%`,
                                    autoBuyExecutionDetails.status === "SUCCESS"
                                        ? `💳 Total cost: ${autoBuyExecutionDetails.currency} ${autoBuyExecutionDetails.totalCostWallet} (USD ${autoBuyExecutionDetails.totalCostUSD})`
                                        : `❌ Reason: ${autoBuyExecutionDetails.reason || "Unknown error"}`,
                                    autoBuyExecutionDetails.status === "FAILED" && retryStateText
                                        ? `🔁 ${retryStateText}`
                                        : "",
                                    `👤 User: ${userName}${userEmail ? ` (${userEmail})` : ""}`,
                                ],
                            });
                            if (sent) {
                                discordSentCount += 1;
                            }
                        } catch (discordError) {
                            console.error("[POLYMARKET ALERT CHECK] Failed to send auto-buy detail discord", {
                                alertId: alert.alert_id,
                                userId: alert.u_id,
                                discordError,
                            });
                        }
                    }
                }

                if (shouldSendBaseTriggerNotification && shouldNotifyDiscord) {
                    try {
                        const sent = await sendDiscordAlert({
                            question: marketInfo.question,
                            conditionText,
                            currentYesPercent,
                            userName,
                            userEmail,
                        });
                        if (sent) {
                            discordSent = true;
                            discordSentCount += 1;
                        }
                    } catch (discordError) {
                        console.error("[POLYMARKET ALERT CHECK] Failed to send discord alert", {
                            alertId: alert.alert_id,
                            userId: alert.u_id,
                            discordError,
                        });
                    }
                }

                if (!emailSent && !discordSent && !autoBuyRequested) {
                    continue;
                }

                if (!shouldDeactivateAlert) {
                    continue;
                }

                await prisma.polymarketPriceAlert.update({
                    where: { alert_id: alert.alert_id },
                    data: {
                        is_active: false,
                        triggered_at: new Date(),
                    },
                });

                await prisma.$executeRaw`
                    UPDATE "PolymarketPriceAlert"
                    SET
                        "auto_buy_enabled" = false,
                        "auto_buy_quantity" = NULL,
                        "auto_buy_next_retry_at" = NULL,
                        "auto_buy_executed_at" = ${autoBuyRequested ? (autoBuyExecuted ? new Date() : null) : null},
                        "auto_buy_last_error" = ${autoBuyExecutionDetails?.status === "FAILED" ? (autoBuyExecutionDetails.reason || "Unknown error") : null},
                        "updated_at" = NOW()
                    WHERE "alert_id" = ${alert.alert_id}
                `;

                triggeredCount += 1;
            } catch (notificationError) {
                console.error("[POLYMARKET ALERT CHECK] Failed processing triggered alert", {
                    alertId: alert.alert_id,
                    userId: alert.u_id,
                    notificationError,
                });
            }
        }

        return NextResponse.json({
            success: true,
            checked: activeAlerts.length,
            triggered: triggeredCount,
            emailsSent: emailsSentCount,
            discordSent: discordSentCount,
            autoBuyExecuted: autoBuyExecutedCount,
            autoBuyFailed: autoBuyFailedCount,
            autoBuyRetryScheduled: autoBuyRetryScheduledCount,
        });
    } catch (error) {
        console.error("[POLYMARKET ALERT CHECK]", error);
        return NextResponse.json({ error: "Failed to process alerts" }, { status: 500 });
    }
}
