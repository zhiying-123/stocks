import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

type AlertDirection = "ABOVE" | "BELOW";
type AlertOutcome = "YES" | "NO";
type AlertNotifyChannel = "EMAIL" | "DISCORD";

function normalizeNotifyChannels(value: unknown): AlertNotifyChannel[] {
    const fallback: AlertNotifyChannel[] = ["EMAIL", "DISCORD"];

    if (value == null) return fallback;

    const rawValues = Array.isArray(value)
        ? value
        : (typeof value === "string" ? value.split(",") : []);

    const normalized = Array.from(
        new Set(
            rawValues
                .map((item) => String(item).trim().toUpperCase())
                .filter((item): item is AlertNotifyChannel => item === "EMAIL" || item === "DISCORD")
        )
    );

    return normalized.length > 0 ? normalized : fallback;
}

function parseNotifyChannelsString(value: string | null | undefined): AlertNotifyChannel[] {
    return normalizeNotifyChannels(value ?? undefined);
}

function formatNotifyChannels(channels: AlertNotifyChannel[]) {
    return channels.join(",");
}

function parseSourceBase(source: string | null | undefined) {
    const base = String(source || "DIRECT").split("|")[0]?.trim();
    return base || "DIRECT";
}

function buildSourceWithNotifyChannels(sourceBase: string, channels: AlertNotifyChannel[]) {
    return `${sourceBase}|${formatNotifyChannels(channels)}`;
}

function parseNotifyChannelsFromSource(source: string | null | undefined): AlertNotifyChannel[] {
    const raw = String(source || "");
    const [, channelSegment] = raw.split("|");
    return normalizeNotifyChannels(channelSegment);
}

function normalizeDirection(value: unknown): AlertDirection | null {
    if (typeof value !== "string") return null;
    const normalized = value.toUpperCase();
    if (normalized !== "ABOVE" && normalized !== "BELOW") return null;
    return normalized;
}

function normalizeOutcome(value: unknown): AlertOutcome {
    if (typeof value !== "string") return "YES";
    return value.toUpperCase() === "NO" ? "NO" : "YES";
}

function normalizeTargetPrice(value: unknown): number | null {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;

    const decimal = numeric > 1 ? numeric / 100 : numeric;
    if (decimal <= 0 || decimal >= 1) return null;

    return decimal;
}

async function getAuthedUser() {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get("user")?.value;
    const user = userCookie ? JSON.parse(userCookie) : null;
    return user;
}

export async function GET(req: NextRequest) {
    try {
        const user = await getAuthedUser();
        if (!user?.id) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const marketId = req.nextUrl.searchParams.get("marketId") || undefined;

        const alerts = await prisma.polymarketPriceAlert.findMany({
            where: {
                u_id: user.id,
                ...(marketId ? { market_id: marketId } : {}),
            },
            orderBy: { created_at: "desc" },
        });

        return NextResponse.json({
            alerts: alerts.map((alert) => ({
                ...alert,
                notify_channels_list: parseNotifyChannelsFromSource(alert.source),
                target_price_percent: Number((alert.target_price * 100).toFixed(2)),
            })),
        });
    } catch (error) {
        console.error("[POLYMARKET ALERTS GET]", error);
        return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthedUser();
        if (!user?.id) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const { marketId, targetPrice, direction, outcome, notifyChannels } = await req.json();

        if (!marketId || typeof marketId !== "string") {
            return NextResponse.json({ error: "Market ID required" }, { status: 400 });
        }

        const normalizedDirection = normalizeDirection(direction);
        if (!normalizedDirection) {
            return NextResponse.json({ error: "Direction must be ABOVE or BELOW" }, { status: 400 });
        }

        const normalizedOutcome = normalizeOutcome(outcome);
        const normalizedTargetPrice = normalizeTargetPrice(targetPrice);
        const normalizedNotifyChannels = normalizeNotifyChannels(notifyChannels);
        if (!normalizedTargetPrice) {
            return NextResponse.json({ error: "Target price must be between 0 and 1 (or 0-100%)" }, { status: 400 });
        }

        const source = buildSourceWithNotifyChannels("DIRECT", normalizedNotifyChannels);

        const alert = await prisma.polymarketPriceAlert.create({
            data: {
                u_id: user.id,
                market_id: marketId,
                outcome: normalizedOutcome,
                direction: normalizedDirection,
                target_price: normalizedTargetPrice,
                source,
                is_active: true,
            },
        });

        return NextResponse.json({
            success: true,
            alert: {
                ...alert,
                notify_channels_list: parseNotifyChannelsFromSource(alert.source),
                target_price_percent: Number((alert.target_price * 100).toFixed(2)),
            },
        });
    } catch (error) {
        console.error("[POLYMARKET ALERTS POST]", error);
        return NextResponse.json({ error: "Failed to create alert" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const user = await getAuthedUser();
        if (!user?.id) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const alertIdRaw = req.nextUrl.searchParams.get("alertId");
        const alertId = Number(alertIdRaw);

        if (!Number.isInteger(alertId) || alertId <= 0) {
            return NextResponse.json({ error: "Valid alertId is required" }, { status: 400 });
        }

        const result = await prisma.polymarketPriceAlert.deleteMany({
            where: {
                alert_id: alertId,
                u_id: user.id,
            },
        });

        if (result.count === 0) {
            return NextResponse.json({ error: "Alert not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[POLYMARKET ALERTS DELETE]", error);
        return NextResponse.json({ error: "Failed to delete alert" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const user = await getAuthedUser();
        if (!user?.id) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const { alertId, targetPrice, direction, outcome, isActive, notifyChannels } = await req.json();
        const numericAlertId = Number(alertId);

        if (!Number.isInteger(numericAlertId) || numericAlertId <= 0) {
            return NextResponse.json({ error: "Valid alertId is required" }, { status: 400 });
        }

        const data: {
            target_price?: number;
            direction?: AlertDirection;
            outcome?: AlertOutcome;
            is_active?: boolean;
            triggered_at?: Date | null;
            source?: string;
        } = {};

        if (targetPrice !== undefined) {
            const normalizedTargetPrice = normalizeTargetPrice(targetPrice);
            if (!normalizedTargetPrice) {
                return NextResponse.json({ error: "Target price must be between 0 and 1 (or 0-100%)" }, { status: 400 });
            }
            data.target_price = normalizedTargetPrice;
        }

        if (direction !== undefined) {
            const normalizedDirection = normalizeDirection(direction);
            if (!normalizedDirection) {
                return NextResponse.json({ error: "Direction must be ABOVE or BELOW" }, { status: 400 });
            }
            data.direction = normalizedDirection;
        }

        if (outcome !== undefined) {
            data.outcome = normalizeOutcome(outcome);
        }

        if (notifyChannels !== undefined) {
            const normalizedNotifyChannels = normalizeNotifyChannels(notifyChannels);
            data.source = buildSourceWithNotifyChannels("DIRECT", normalizedNotifyChannels);
        }

        if (isActive !== undefined) {
            if (typeof isActive !== "boolean") {
                return NextResponse.json({ error: "isActive must be a boolean" }, { status: 400 });
            }
            data.is_active = isActive;
            if (isActive) {
                data.triggered_at = null;
            }
        }

        if (Object.keys(data).length === 0) {
            return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
        }

        const existing = await prisma.polymarketPriceAlert.findFirst({
            where: {
                alert_id: numericAlertId,
                u_id: user.id,
            },
        });

        if (!existing) {
            return NextResponse.json({ error: "Alert not found" }, { status: 404 });
        }

        if (notifyChannels !== undefined) {
            const normalizedNotifyChannels = normalizeNotifyChannels(notifyChannels);
            data.source = buildSourceWithNotifyChannels(parseSourceBase(existing.source), normalizedNotifyChannels);
        }

        const updated = await prisma.polymarketPriceAlert.update({
            where: { alert_id: numericAlertId },
            data,
        });

        return NextResponse.json({
            success: true,
            alert: {
                ...updated,
                notify_channels_list: parseNotifyChannelsFromSource(updated.source),
                target_price_percent: Number((updated.target_price * 100).toFixed(2)),
            },
        });
    } catch (error) {
        console.error("[POLYMARKET ALERTS PATCH]", error);
        return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
    }
}
