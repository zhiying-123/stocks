import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

type AutoTradeAction = "BUY" | "SELL";
type TriggerType = "PRICE_TARGET" | "MOVING_AVERAGE";
type TriggerDirection = "ABOVE" | "BELOW";
type NotifyChannel = "EMAIL" | "DISCORD";

function normalizeNotifyChannels(value: unknown): NotifyChannel[] {
    const fallback: NotifyChannel[] = ["EMAIL", "DISCORD"];

    if (value == null) return fallback;

    const rawValues = Array.isArray(value)
        ? value
        : (typeof value === "string" ? value.split(",") : []);

    const normalized = Array.from(
        new Set(
            rawValues
                .map((item) => String(item).trim().toUpperCase())
                .filter((item): item is NotifyChannel => item === "EMAIL" || item === "DISCORD")
        )
    );

    return normalized.length > 0 ? normalized : fallback;
}

function formatNotifyChannels(channels: NotifyChannel[]) {
    return channels.join(",");
}

function normalizeAction(value: unknown): AutoTradeAction | null {
    if (typeof value !== "string") return null;
    const normalized = value.toUpperCase();
    if (normalized !== "BUY" && normalized !== "SELL") return null;
    return normalized;
}

function normalizeTriggerType(value: unknown): TriggerType | null {
    if (typeof value !== "string") return null;
    const normalized = value.toUpperCase();
    if (normalized !== "PRICE_TARGET" && normalized !== "MOVING_AVERAGE") return null;
    return normalized;
}

function normalizeDirection(value: unknown): TriggerDirection | null {
    if (typeof value !== "string") return null;
    const normalized = value.toUpperCase();
    if (normalized !== "ABOVE" && normalized !== "BELOW") return null;
    return normalized;
}

function normalizePrice(value: unknown): number | null {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return Number(numeric.toFixed(6));
}

function normalizeQuantity(value: unknown): number | null {
    const numeric = Number(value);
    if (!Number.isInteger(numeric) || numeric <= 0) return null;
    return numeric;
}

function normalizeMADays(value: unknown): number | null {
    const numeric = Number(value);
    if (!Number.isInteger(numeric) || numeric < 2 || numeric > 200) return null;
    return numeric;
}

function normalizeSymbol(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const normalized = value.trim().toUpperCase();
    if (!normalized) return null;
    return normalized;
}

async function getAuthedUser() {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get("user")?.value;
    const user = userCookie ? JSON.parse(userCookie) : null;
    return user;
}

function mapRule(rule: {
    auto_id: number;
    u_id: number;
    symbol: string;
    action: string;
    trigger_type: string;
    direction: string;
    target_price: number | null;
    moving_average_days: number | null;
    quantity: number;
    notify_channels: string;
    is_active: boolean;
    last_checked_price: number | null;
    last_trigger_value: number | null;
    executed_at: Date | null;
    triggered_at: Date | null;
    last_error: string | null;
    created_at: Date;
    updated_at: Date;
}) {
    return {
        ...rule,
        notify_channels_list: normalizeNotifyChannels(rule.notify_channels),
    };
}

export async function GET(req: NextRequest) {
    try {
        const user = await getAuthedUser();
        if (!user?.id) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const symbol = normalizeSymbol(req.nextUrl.searchParams.get("symbol"));

        const rules = await prisma.stockAutoTrader.findMany({
            where: {
                u_id: user.id,
                ...(symbol ? { symbol } : {}),
            },
            orderBy: { created_at: "desc" },
        });

        return NextResponse.json({ rules: rules.map(mapRule) });
    } catch (error) {
        console.error("[AUTO TRADER GET]", error);
        return NextResponse.json({ error: "Failed to fetch auto-trader rules" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthedUser();
        if (!user?.id) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const body = await req.json();

        const symbol = normalizeSymbol(body.symbol);
        const action = normalizeAction(body.action);
        const triggerType = normalizeTriggerType(body.triggerType);
        const direction = normalizeDirection(body.direction);
        const quantity = normalizeQuantity(body.quantity);
        const notifyChannels = normalizeNotifyChannels(body.notifyChannels);

        if (!symbol) return NextResponse.json({ error: "Valid symbol is required" }, { status: 400 });
        if (!action) return NextResponse.json({ error: "Action must be BUY or SELL" }, { status: 400 });
        if (!triggerType) return NextResponse.json({ error: "triggerType must be PRICE_TARGET or MOVING_AVERAGE" }, { status: 400 });
        if (!direction) return NextResponse.json({ error: "Direction must be ABOVE or BELOW" }, { status: 400 });
        if (!quantity) return NextResponse.json({ error: "Quantity must be a positive integer" }, { status: 400 });

        let targetPrice: number | null = null;
        let movingAverageDays: number | null = null;

        if (triggerType === "PRICE_TARGET") {
            targetPrice = normalizePrice(body.targetPrice);
            if (!targetPrice) {
                return NextResponse.json({ error: "targetPrice must be a positive number for PRICE_TARGET" }, { status: 400 });
            }
        }

        if (triggerType === "MOVING_AVERAGE") {
            movingAverageDays = normalizeMADays(body.movingAverageDays);
            if (!movingAverageDays) {
                return NextResponse.json({ error: "movingAverageDays must be an integer between 2 and 200" }, { status: 400 });
            }
        }

        const rule = await prisma.stockAutoTrader.create({
            data: {
                u_id: user.id,
                symbol,
                action,
                trigger_type: triggerType,
                direction,
                target_price: targetPrice,
                moving_average_days: movingAverageDays,
                quantity,
                notify_channels: formatNotifyChannels(notifyChannels),
                is_active: true,
            },
        });

        return NextResponse.json({ success: true, rule: mapRule(rule) });
    } catch (error) {
        console.error("[AUTO TRADER POST]", error);
        return NextResponse.json({ error: "Failed to create auto-trader rule" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const user = await getAuthedUser();
        if (!user?.id) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const body = await req.json();
        const autoId = Number(body.autoId);

        if (!Number.isInteger(autoId) || autoId <= 0) {
            return NextResponse.json({ error: "Valid autoId is required" }, { status: 400 });
        }

        const existing = await prisma.stockAutoTrader.findFirst({
            where: {
                auto_id: autoId,
                u_id: user.id,
            },
        });

        if (!existing) {
            return NextResponse.json({ error: "Rule not found" }, { status: 404 });
        }

        const data: {
            symbol?: string;
            action?: string;
            trigger_type?: string;
            direction?: string;
            target_price?: number | null;
            moving_average_days?: number | null;
            quantity?: number;
            notify_channels?: string;
            is_active?: boolean;
            triggered_at?: Date | null;
            executed_at?: Date | null;
            last_error?: string | null;
        } = {};

        if (body.symbol !== undefined) {
            const symbol = normalizeSymbol(body.symbol);
            if (!symbol) return NextResponse.json({ error: "Valid symbol is required" }, { status: 400 });
            data.symbol = symbol;
        }

        if (body.action !== undefined) {
            const action = normalizeAction(body.action);
            if (!action) return NextResponse.json({ error: "Action must be BUY or SELL" }, { status: 400 });
            data.action = action;
        }

        if (body.direction !== undefined) {
            const direction = normalizeDirection(body.direction);
            if (!direction) return NextResponse.json({ error: "Direction must be ABOVE or BELOW" }, { status: 400 });
            data.direction = direction;
        }

        if (body.quantity !== undefined) {
            const quantity = normalizeQuantity(body.quantity);
            if (!quantity) return NextResponse.json({ error: "Quantity must be a positive integer" }, { status: 400 });
            data.quantity = quantity;
        }

        if (body.notifyChannels !== undefined) {
            data.notify_channels = formatNotifyChannels(normalizeNotifyChannels(body.notifyChannels));
        }

        if (body.isActive !== undefined) {
            if (typeof body.isActive !== "boolean") {
                return NextResponse.json({ error: "isActive must be a boolean" }, { status: 400 });
            }
            data.is_active = body.isActive;
            if (body.isActive) {
                data.triggered_at = null;
                data.executed_at = null;
                data.last_error = null;
            }
        }

        if (body.triggerType !== undefined) {
            const normalizedTriggerType = normalizeTriggerType(body.triggerType);
            if (!normalizedTriggerType) {
                return NextResponse.json({ error: "triggerType must be PRICE_TARGET or MOVING_AVERAGE" }, { status: 400 });
            }
            data.trigger_type = normalizedTriggerType;
        }

        const nextTriggerType = (data.trigger_type || existing.trigger_type) as TriggerType;
        const nextTargetPriceInput = body.targetPrice !== undefined ? body.targetPrice : existing.target_price;
        const nextMovingAverageInput = body.movingAverageDays !== undefined ? body.movingAverageDays : existing.moving_average_days;

        if (nextTriggerType === "PRICE_TARGET") {
            const targetPrice = normalizePrice(nextTargetPriceInput);
            if (!targetPrice) {
                return NextResponse.json({ error: "targetPrice must be a positive number for PRICE_TARGET" }, { status: 400 });
            }
            data.target_price = targetPrice;
            data.moving_average_days = null;
        }

        if (nextTriggerType === "MOVING_AVERAGE") {
            const movingAverageDays = normalizeMADays(nextMovingAverageInput);
            if (!movingAverageDays) {
                return NextResponse.json({ error: "movingAverageDays must be an integer between 2 and 200" }, { status: 400 });
            }
            data.moving_average_days = movingAverageDays;
            data.target_price = null;
        }

        if (Object.keys(data).length === 0) {
            return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
        }

        const updated = await prisma.stockAutoTrader.update({
            where: { auto_id: autoId },
            data,
        });

        return NextResponse.json({ success: true, rule: mapRule(updated) });
    } catch (error) {
        console.error("[AUTO TRADER PATCH]", error);
        return NextResponse.json({ error: "Failed to update auto-trader rule" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const user = await getAuthedUser();
        if (!user?.id) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const autoIdRaw = req.nextUrl.searchParams.get("autoId");
        const autoId = Number(autoIdRaw);

        if (!Number.isInteger(autoId) || autoId <= 0) {
            return NextResponse.json({ error: "Valid autoId is required" }, { status: 400 });
        }

        const result = await prisma.stockAutoTrader.deleteMany({
            where: {
                auto_id: autoId,
                u_id: user.id,
            },
        });

        if (result.count === 0) {
            return NextResponse.json({ error: "Rule not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[AUTO TRADER DELETE]", error);
        return NextResponse.json({ error: "Failed to delete auto-trader rule" }, { status: 500 });
    }
}
