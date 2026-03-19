import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { sendDiscordAlert } from "@/lib/discord";

const POLYMARKET_API = "https://gamma-api.polymarket.com";

type MarketPriceInfo = {
    yes: number;
    no: number;
    question: string;
};

type AlertNotifyChannel = "EMAIL" | "DISCORD";

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

async function fetchPriceMap() {
    const response = await fetch(`${POLYMARKET_API}/events?limit=500&offset=0&closed=false`, {
        cache: "no-store",
        headers: {
            Accept: "application/json",
        },
    });

    if (!response.ok) {
        throw new Error(`Polymarket events fetch failed: ${response.status}`);
    }

    const data = await response.json();
    const priceMap = new Map<string, MarketPriceInfo>();

    if (!Array.isArray(data)) {
        return priceMap;
    }

    for (const event of data) {
        if (!event?.markets || !Array.isArray(event.markets)) continue;

        for (const market of event.markets) {
            const parsedPrices = parsePricePair(market?.outcomePrices);
            if (!parsedPrices) continue;

            const [yesPrice, noPrice] = parsedPrices;

            const clobIds = parseStringArray(market?.clobTokenIds);
            const tokenId = clobIds[0]?.trim() || String(market?.conditionId || "").trim();
            if (!tokenId) continue;

            priceMap.set(tokenId, {
                yes: yesPrice,
                no: noPrice,
                question: String(market?.question || event?.title || tokenId),
            });
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

export async function GET(req: NextRequest) {
    try {
        const expectedSecret = process.env.POLYMARKET_ALERT_CRON_SECRET || process.env.CRON_SECRET;
        if (expectedSecret) {
            const headerSecret = req.headers.get("x-cron-secret");
            const querySecret = req.nextUrl.searchParams.get("secret");
            if (headerSecret !== expectedSecret && querySecret !== expectedSecret) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        }

        const activeAlerts = await prisma.polymarketPriceAlert.findMany({
            where: { is_active: true },
            orderBy: { created_at: "asc" },
        });

        if (activeAlerts.length === 0) {
            return NextResponse.json({
                success: true,
                checked: 0,
                triggered: 0,
                emailsSent: 0,
                discordSent: 0,
            });
        }

        const [priceMap, users] = await Promise.all([
            fetchPriceMap(),
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

        for (const alert of activeAlerts) {
            const marketInfo = priceMap.get(alert.market_id);
            if (!marketInfo) continue;

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

                let emailSent = false;
                let discordSent = false;
                const notifyChannels = parseNotifyChannelsFromSource(alert.source);
                const shouldNotifyEmail = notifyChannels.includes("EMAIL");
                const shouldNotifyDiscord = notifyChannels.includes("DISCORD");

                if (shouldNotifyEmail && userEmail) {
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
                                "This alert has now been deactivated.",
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

                if (shouldNotifyDiscord) {
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

                if (!emailSent && !discordSent) {
                    continue;
                }

                await prisma.polymarketPriceAlert.update({
                    where: { alert_id: alert.alert_id },
                    data: {
                        is_active: false,
                        triggered_at: new Date(),
                    },
                });

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
        });
    } catch (error) {
        console.error("[POLYMARKET ALERT CHECK]", error);
        return NextResponse.json({ error: "Failed to process alerts" }, { status: 500 });
    }
}
