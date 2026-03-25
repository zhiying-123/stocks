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

function normalizeAutoBuyEnabled(value: unknown): boolean {
    return value === true;
}

function normalizeAutoBuyQuantity(value: unknown): number | null {
    if (value == null || value === "") return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return Number(numeric.toFixed(6));
}

function normalizeAutoBuyBudget(value: unknown): number | null {
    if (value == null || value === "") return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return Number(numeric.toFixed(2));
}

function normalizeRetryMax(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(20, Math.floor(numeric)));
}

function normalizeCooldownMinutes(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 5;
    return Math.max(1, Math.min(1440, Math.floor(numeric)));
}

function normalizePercentOptional(value: unknown): number | null {
    if (value == null || value === "") return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0 || numeric >= 100) return null;
    return Number(numeric.toFixed(2));
}

async function getAuthedUser() {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get("user")?.value;
    const user = userCookie ? JSON.parse(userCookie) : null;
    return user;
}

type AutoBuyFieldRow = {
    alert_id: number;
    auto_buy_enabled: boolean;
    auto_buy_quantity: number | null;
    auto_buy_budget: number | null;
    auto_buy_retry_max: number;
    auto_buy_retry_count: number;
    auto_buy_cooldown_m: number;
    auto_buy_next_retry_at: Date | null;
    auto_buy_executed_at: Date | null;
    auto_buy_last_error: string | null;
    tp_target_percent: number | null;
    sl_target_percent: number | null;
    parent_alert_id: number | null;
    alert_tag: string | null;
};

async function getAutoBuyMapByUser(userId: number) {
    const rows = await prisma.$queryRaw<AutoBuyFieldRow[]>`
        SELECT
            "alert_id",
            "auto_buy_enabled",
            "auto_buy_quantity",
            "auto_buy_budget",
            "auto_buy_retry_max",
            "auto_buy_retry_count",
            "auto_buy_cooldown_m",
            "auto_buy_next_retry_at",
            "auto_buy_executed_at",
            "auto_buy_last_error",
            "tp_target_percent",
            "sl_target_percent",
            "parent_alert_id",
            "alert_tag"
        FROM "PolymarketPriceAlert"
        WHERE "u_id" = ${userId}
    `;

    return new Map(rows.map((row) => [row.alert_id, row]));
}

async function getAutoBuyRowByAlertId(userId: number, alertId: number) {
    const rows = await prisma.$queryRaw<AutoBuyFieldRow[]>`
        SELECT
            "alert_id",
            "auto_buy_enabled",
            "auto_buy_quantity",
            "auto_buy_budget",
            "auto_buy_retry_max",
            "auto_buy_retry_count",
            "auto_buy_cooldown_m",
            "auto_buy_next_retry_at",
            "auto_buy_executed_at",
            "auto_buy_last_error",
            "tp_target_percent",
            "sl_target_percent",
            "parent_alert_id",
            "alert_tag"
        FROM "PolymarketPriceAlert"
        WHERE "u_id" = ${userId} AND "alert_id" = ${alertId}
        LIMIT 1
    `;

    return rows[0] ?? null;
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

        const autoBuyMap = await getAutoBuyMapByUser(user.id);

        return NextResponse.json({
            alerts: alerts.map((alert) => ({
                ...alert,
                notify_channels_list: parseNotifyChannelsFromSource(alert.source),
                target_price_percent: Number((alert.target_price * 100).toFixed(2)),
                auto_buy_enabled: autoBuyMap.get(alert.alert_id)?.auto_buy_enabled ?? false,
                auto_buy_quantity: autoBuyMap.get(alert.alert_id)?.auto_buy_quantity ?? null,
                auto_buy_budget: autoBuyMap.get(alert.alert_id)?.auto_buy_budget ?? null,
                auto_buy_retry_max: autoBuyMap.get(alert.alert_id)?.auto_buy_retry_max ?? 0,
                auto_buy_retry_count: autoBuyMap.get(alert.alert_id)?.auto_buy_retry_count ?? 0,
                auto_buy_cooldown_m: autoBuyMap.get(alert.alert_id)?.auto_buy_cooldown_m ?? 5,
                auto_buy_next_retry_at: autoBuyMap.get(alert.alert_id)?.auto_buy_next_retry_at ?? null,
                auto_buy_last_error: autoBuyMap.get(alert.alert_id)?.auto_buy_last_error ?? null,
                tp_target_percent: autoBuyMap.get(alert.alert_id)?.tp_target_percent ?? null,
                sl_target_percent: autoBuyMap.get(alert.alert_id)?.sl_target_percent ?? null,
                parent_alert_id: autoBuyMap.get(alert.alert_id)?.parent_alert_id ?? null,
                alert_tag: autoBuyMap.get(alert.alert_id)?.alert_tag ?? null,
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

        const {
            marketId,
            targetPrice,
            direction,
            outcome,
            notifyChannels,
            autoBuyEnabled,
            autoBuyQuantity,
            autoBuyBudget,
            autoBuyRetryMax,
            autoBuyCooldownMinutes,
            tpTargetPercent,
            slTargetPercent,
        } = await req.json();

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
        const normalizedAutoBuyEnabled = normalizeAutoBuyEnabled(autoBuyEnabled);
        const normalizedAutoBuyQuantity = normalizeAutoBuyQuantity(autoBuyQuantity);
        const normalizedAutoBuyBudget = normalizeAutoBuyBudget(autoBuyBudget);
        const normalizedRetryMax = normalizeRetryMax(autoBuyRetryMax);
        const normalizedCooldownMinutes = normalizeCooldownMinutes(autoBuyCooldownMinutes);
        const normalizedTpTargetPercent = normalizePercentOptional(tpTargetPercent);
        const normalizedSlTargetPercent = normalizePercentOptional(slTargetPercent);

        if (!normalizedTargetPrice) {
            return NextResponse.json({ error: "Target price must be between 0 and 1 (or 0-100%)" }, { status: 400 });
        }

        if (normalizedAutoBuyEnabled && !normalizedAutoBuyQuantity) {
            return NextResponse.json({ error: "autoBuyQuantity must be a positive number when auto-buy is enabled" }, { status: 400 });
        }

        if (!normalizedAutoBuyEnabled && (normalizedTpTargetPercent !== null || normalizedSlTargetPercent !== null)) {
            return NextResponse.json({ error: "TP/SL linkage requires auto-buy enabled" }, { status: 400 });
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

        await prisma.$executeRaw`
            UPDATE "PolymarketPriceAlert"
            SET
                "auto_buy_enabled" = ${normalizedAutoBuyEnabled},
                "auto_buy_quantity" = ${normalizedAutoBuyEnabled ? normalizedAutoBuyQuantity : null},
                "auto_buy_budget" = ${normalizedAutoBuyEnabled ? normalizedAutoBuyBudget : null},
                "auto_buy_retry_max" = ${normalizedAutoBuyEnabled ? normalizedRetryMax : 0},
                "auto_buy_retry_count" = 0,
                "auto_buy_cooldown_m" = ${normalizedAutoBuyEnabled ? normalizedCooldownMinutes : 5},
                "auto_buy_next_retry_at" = NULL,
                "auto_buy_executed_at" = NULL,
                "auto_buy_last_error" = NULL,
                "tp_target_percent" = ${normalizedAutoBuyEnabled ? normalizedTpTargetPercent : null},
                "sl_target_percent" = ${normalizedAutoBuyEnabled ? normalizedSlTargetPercent : null},
                "parent_alert_id" = NULL,
                "alert_tag" = NULL,
                "updated_at" = NOW()
            WHERE "alert_id" = ${alert.alert_id} AND "u_id" = ${user.id}
        `;

        return NextResponse.json({
            success: true,
            alert: {
                ...alert,
                notify_channels_list: parseNotifyChannelsFromSource(alert.source),
                target_price_percent: Number((alert.target_price * 100).toFixed(2)),
                auto_buy_enabled: normalizedAutoBuyEnabled,
                auto_buy_quantity: normalizedAutoBuyEnabled ? normalizedAutoBuyQuantity : null,
                auto_buy_budget: normalizedAutoBuyEnabled ? normalizedAutoBuyBudget : null,
                auto_buy_retry_max: normalizedAutoBuyEnabled ? normalizedRetryMax : 0,
                auto_buy_retry_count: 0,
                auto_buy_cooldown_m: normalizedAutoBuyEnabled ? normalizedCooldownMinutes : 5,
                auto_buy_next_retry_at: null,
                auto_buy_last_error: null,
                tp_target_percent: normalizedAutoBuyEnabled ? normalizedTpTargetPercent : null,
                sl_target_percent: normalizedAutoBuyEnabled ? normalizedSlTargetPercent : null,
                parent_alert_id: null,
                alert_tag: null,
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

        const patchBody = await req.json();
        const {
            alertId,
            targetPrice,
            direction,
            outcome,
            isActive,
            notifyChannels,
            autoBuyEnabled,
            autoBuyQuantity,
            autoBuyBudget,
            autoBuyRetryMax,
            autoBuyCooldownMinutes,
            tpTargetPercent,
            slTargetPercent,
        } = patchBody;
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

        let autoBuyPatch:
            | {
                enabled: boolean;
                quantity: number | null;
                budget: number | null;
                retryMax: number;
                retryCount: number;
                cooldownMinutes: number;
                nextRetryAt: Date | null;
                executedAt: Date | null;
                lastError: string | null;
                tpTargetPercent: number | null;
                slTargetPercent: number | null;
            }
            | null = null;

        const existing = await prisma.polymarketPriceAlert.findFirst({
            where: {
                alert_id: numericAlertId,
                u_id: user.id,
            },
        });

        if (!existing) {
            return NextResponse.json({ error: "Alert not found" }, { status: 404 });
        }

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

        const nextIsActive = isActive !== undefined ? isActive : existing.is_active;

        if (isActive === false) {
            autoBuyPatch = {
                enabled: false,
                quantity: null,
                budget: null,
                retryMax: 0,
                retryCount: 0,
                cooldownMinutes: 5,
                nextRetryAt: null,
                executedAt: null,
                lastError: null,
                tpTargetPercent: null,
                slTargetPercent: null,
            };
        }

        if (
            autoBuyEnabled !== undefined ||
            autoBuyQuantity !== undefined ||
            autoBuyBudget !== undefined ||
            autoBuyRetryMax !== undefined ||
            autoBuyCooldownMinutes !== undefined ||
            tpTargetPercent !== undefined ||
            slTargetPercent !== undefined
        ) {
            const autoBuyRow = await getAutoBuyRowByAlertId(user.id, numericAlertId);
            const normalizedAutoBuyEnabled = autoBuyEnabled !== undefined
                ? normalizeAutoBuyEnabled(autoBuyEnabled)
                : (autoBuyRow?.auto_buy_enabled ?? false);
            const normalizedAutoBuyQuantity = autoBuyQuantity !== undefined
                ? normalizeAutoBuyQuantity(autoBuyQuantity)
                : (autoBuyRow?.auto_buy_quantity ?? null);
            const normalizedAutoBuyBudget = autoBuyBudget !== undefined
                ? normalizeAutoBuyBudget(autoBuyBudget)
                : (autoBuyRow?.auto_buy_budget ?? null);
            const normalizedRetryMax = autoBuyRetryMax !== undefined
                ? normalizeRetryMax(autoBuyRetryMax)
                : (autoBuyRow?.auto_buy_retry_max ?? 0);
            const normalizedCooldownMinutes = autoBuyCooldownMinutes !== undefined
                ? normalizeCooldownMinutes(autoBuyCooldownMinutes)
                : (autoBuyRow?.auto_buy_cooldown_m ?? 5);
            const normalizedTpTargetPercent = tpTargetPercent !== undefined
                ? normalizePercentOptional(tpTargetPercent)
                : (autoBuyRow?.tp_target_percent ?? null);
            const normalizedSlTargetPercent = slTargetPercent !== undefined
                ? normalizePercentOptional(slTargetPercent)
                : (autoBuyRow?.sl_target_percent ?? null);

            if (!nextIsActive && normalizedAutoBuyEnabled) {
                return NextResponse.json({ error: "Auto buy can only be enabled for active alerts" }, { status: 400 });
            }

            if (normalizedAutoBuyEnabled && !normalizedAutoBuyQuantity) {
                return NextResponse.json({ error: "autoBuyQuantity must be a positive number when auto-buy is enabled" }, { status: 400 });
            }

            if (!normalizedAutoBuyEnabled && (normalizedTpTargetPercent !== null || normalizedSlTargetPercent !== null)) {
                return NextResponse.json({ error: "TP/SL linkage requires auto-buy enabled" }, { status: 400 });
            }

            autoBuyPatch = {
                enabled: normalizedAutoBuyEnabled,
                quantity: normalizedAutoBuyEnabled ? normalizedAutoBuyQuantity : null,
                budget: normalizedAutoBuyEnabled ? normalizedAutoBuyBudget : null,
                retryMax: normalizedAutoBuyEnabled ? normalizedRetryMax : 0,
                retryCount: normalizedAutoBuyEnabled ? (autoBuyRow?.auto_buy_retry_count ?? 0) : 0,
                cooldownMinutes: normalizedAutoBuyEnabled ? normalizedCooldownMinutes : 5,
                nextRetryAt: normalizedAutoBuyEnabled ? (autoBuyRow?.auto_buy_next_retry_at ?? null) : null,
                executedAt: null,
                lastError: normalizedAutoBuyEnabled ? (autoBuyRow?.auto_buy_last_error ?? null) : null,
                tpTargetPercent: normalizedAutoBuyEnabled ? normalizedTpTargetPercent : null,
                slTargetPercent: normalizedAutoBuyEnabled ? normalizedSlTargetPercent : null,
            };
        }

        if (!nextIsActive) {
            autoBuyPatch = {
                enabled: false,
                quantity: null,
                budget: null,
                retryMax: 0,
                retryCount: 0,
                cooldownMinutes: 5,
                nextRetryAt: null,
                executedAt: null,
                lastError: null,
                tpTargetPercent: null,
                slTargetPercent: null,
            };
        }

        if (Object.keys(data).length === 0 && !autoBuyPatch) {
            return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
        }

        if (notifyChannels !== undefined) {
            const normalizedNotifyChannels = normalizeNotifyChannels(notifyChannels);
            data.source = buildSourceWithNotifyChannels(parseSourceBase(existing.source), normalizedNotifyChannels);
        }

        let updated: any = existing;

        if (Object.keys(data).length > 0) {
            updated = await prisma.polymarketPriceAlert.update({
                where: { alert_id: numericAlertId },
                data: data as any,
            });
        }

        if (autoBuyPatch) {
            await prisma.$executeRaw`
                UPDATE "PolymarketPriceAlert"
                SET
                    "auto_buy_enabled" = ${autoBuyPatch.enabled},
                    "auto_buy_quantity" = ${autoBuyPatch.quantity},
                    "auto_buy_budget" = ${autoBuyPatch.budget},
                    "auto_buy_retry_max" = ${autoBuyPatch.retryMax},
                    "auto_buy_retry_count" = ${autoBuyPatch.retryCount},
                    "auto_buy_cooldown_m" = ${autoBuyPatch.cooldownMinutes},
                    "auto_buy_next_retry_at" = ${autoBuyPatch.nextRetryAt},
                    "auto_buy_executed_at" = ${autoBuyPatch.executedAt},
                    "auto_buy_last_error" = ${autoBuyPatch.lastError},
                    "tp_target_percent" = ${autoBuyPatch.tpTargetPercent},
                    "sl_target_percent" = ${autoBuyPatch.slTargetPercent},
                    "updated_at" = NOW()
                WHERE "alert_id" = ${numericAlertId} AND "u_id" = ${user.id}
            `;
        }

        const refreshed = await prisma.polymarketPriceAlert.findFirst({
            where: {
                alert_id: numericAlertId,
                u_id: user.id,
            },
        });

        if (refreshed) {
            updated = refreshed;
        }

        const updatedAutoBuy = autoBuyPatch
            ? {
                auto_buy_enabled: autoBuyPatch.enabled,
                auto_buy_quantity: autoBuyPatch.quantity,
                auto_buy_budget: autoBuyPatch.budget,
                auto_buy_retry_max: autoBuyPatch.retryMax,
                auto_buy_retry_count: autoBuyPatch.retryCount,
                auto_buy_cooldown_m: autoBuyPatch.cooldownMinutes,
                auto_buy_next_retry_at: autoBuyPatch.nextRetryAt,
                auto_buy_last_error: autoBuyPatch.lastError,
                tp_target_percent: autoBuyPatch.tpTargetPercent,
                sl_target_percent: autoBuyPatch.slTargetPercent,
                parent_alert_id: null,
                alert_tag: null,
            }
            : await getAutoBuyRowByAlertId(user.id, numericAlertId);

        return NextResponse.json({
            success: true,
            alert: {
                ...updated,
                notify_channels_list: parseNotifyChannelsFromSource(updated.source),
                target_price_percent: Number((updated.target_price * 100).toFixed(2)),
                auto_buy_enabled: updatedAutoBuy?.auto_buy_enabled ?? false,
                auto_buy_quantity: updatedAutoBuy?.auto_buy_quantity ?? null,
                auto_buy_budget: updatedAutoBuy?.auto_buy_budget ?? null,
                auto_buy_retry_max: updatedAutoBuy?.auto_buy_retry_max ?? 0,
                auto_buy_retry_count: updatedAutoBuy?.auto_buy_retry_count ?? 0,
                auto_buy_cooldown_m: updatedAutoBuy?.auto_buy_cooldown_m ?? 5,
                auto_buy_next_retry_at: updatedAutoBuy?.auto_buy_next_retry_at ?? null,
                auto_buy_last_error: updatedAutoBuy?.auto_buy_last_error ?? null,
                tp_target_percent: updatedAutoBuy?.tp_target_percent ?? null,
                sl_target_percent: updatedAutoBuy?.sl_target_percent ?? null,
                parent_alert_id: updatedAutoBuy?.parent_alert_id ?? null,
                alert_tag: updatedAutoBuy?.alert_tag ?? null,
            },
        });
    } catch (error) {
        console.error("[POLYMARKET ALERTS PATCH]", error);
        const message = error instanceof Error ? error.message : "Failed to update alert";
        return NextResponse.json({ error: message || "Failed to update alert" }, { status: 500 });
    }
}
