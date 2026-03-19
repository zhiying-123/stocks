import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import AlertsUI from "./AlertsUI";

const POLYMARKET_API = "https://gamma-api.polymarket.com";

type MarketSnapshot = {
    question: string;
    yesPricePercent: number | null;
    noPricePercent: number | null;
};

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

function parseOutcomePrices(value: unknown): [number, number] | null {
    let prices = value;
    if (typeof prices === "string") {
        try {
            prices = JSON.parse(prices);
        } catch {
            return null;
        }
    }

    if (!Array.isArray(prices) || prices.length < 2) return null;
    const yes = Number(prices[0]);
    const no = Number(prices[1]);
    if (!Number.isFinite(yes) || !Number.isFinite(no)) return null;

    return [yes, no];
}

function parseNotifyChannels(value: string | null | undefined) {
    const fallback: Array<"EMAIL" | "DISCORD"> = ["EMAIL", "DISCORD"];
    if (!value) return fallback;

    const normalized = Array.from(
        new Set(
            value
                .split(",")
                .map((item) => item.trim().toUpperCase())
                .filter((item): item is "EMAIL" | "DISCORD" => item === "EMAIL" || item === "DISCORD")
        )
    );

    return normalized.length > 0 ? normalized : fallback;
}

function parseNotifyChannelsFromSource(source: string | null | undefined) {
    const raw = String(source || "");
    const [, channelSegment] = raw.split("|");
    return parseNotifyChannels(channelSegment);
}

async function fetchMarketSnapshotsByIds(marketIds: string[]) {
    const idSet = new Set(marketIds.filter(Boolean));
    const map = new Map<string, MarketSnapshot>();

    if (idSet.size === 0) {
        return map;
    }

    try {
        const response = await fetch(`${POLYMARKET_API}/events?limit=500&offset=0&closed=false`, {
            cache: "no-store",
            headers: {
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            return map;
        }

        const events = await response.json();
        if (!Array.isArray(events)) {
            return map;
        }

        for (const event of events) {
            if (!event?.markets || !Array.isArray(event.markets)) continue;

            for (const market of event.markets) {
                const clobIds = parseStringArray(market?.clobTokenIds);
                const tokenId = clobIds[0]?.trim() || String(market?.conditionId || "").trim();
                if (!tokenId || !idSet.has(tokenId)) continue;

                const pair = parseOutcomePrices(market?.outcomePrices);
                const yesPricePercent = pair ? Number((pair[0] * 100).toFixed(2)) : null;
                const noPricePercent = pair ? Number((pair[1] * 100).toFixed(2)) : null;

                map.set(tokenId, {
                    question: String(market?.question || event?.title || tokenId),
                    yesPricePercent,
                    noPricePercent,
                });
            }
        }
    } catch {
        return map;
    }

    return map;
}

async function getAuthState() {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get("auth")?.value === "true";
    const userCookie = cookieStore.get("user")?.value;
    const user = userCookie ? JSON.parse(userCookie) : null;
    return { isLoggedIn, user };
}

export default async function AlertsPage() {
    const { isLoggedIn, user } = await getAuthState();

    if (!isLoggedIn || !user?.id) {
        redirect("/login");
    }

    const alerts = await prisma.polymarketPriceAlert.findMany({
        where: { u_id: user.id },
        orderBy: { created_at: "desc" },
    });

    const snapshots = await fetchMarketSnapshotsByIds(alerts.map((alert) => alert.market_id));

    const normalizedAlerts = alerts.map((alert) => {
        const snapshot = snapshots.get(alert.market_id);

        return {
            ...alert,
            outcome: (alert.outcome === "NO" ? "NO" : "YES") as "YES" | "NO",
            direction: (alert.direction === "BELOW" ? "BELOW" : "ABOVE") as "ABOVE" | "BELOW",
            created_at: alert.created_at.toISOString(),
            triggered_at: alert.triggered_at ? alert.triggered_at.toISOString() : null,
            target_price_percent: Number((alert.target_price * 100).toFixed(2)),
            market_question: snapshot?.question || alert.market_id,
            current_yes_percent: snapshot?.yesPricePercent ?? null,
            current_no_percent: snapshot?.noPricePercent ?? null,
            notify_channels_list: parseNotifyChannelsFromSource(alert.source),
        };
    });

    return (
        <AlertsUI
            initialPolymarketAlerts={normalizedAlerts}
        />
    );
}
