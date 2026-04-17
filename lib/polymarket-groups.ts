import type { PrismaClient, PolymarketMarketGroup } from "@/app/generated/prisma/client";

const POLYMARKET_GAMMA_API = "https://gamma-api.polymarket.com";
const EVENTS_PAGE_SIZE = 500;
const EVENTS_MAX_OFFSET = 5000;

export type GroupSeed = {
    name: string;
    slug: string;
    sourceUrl: string;
    keywords: string[];
};

export const DEFAULT_POLYMARKET_GROUPS: GroupSeed[] = [
    {
        name: "Elon Tweets",
        slug: "elon-tweets",
        sourceUrl: "https://polymarket.com/predictions/elon-tweets",
        keywords: ["elon", "tweet", "tweets", "musk", "x.com"],
    },
    {
        name: "Economic Policy",
        slug: "economic-policy",
        sourceUrl: "https://polymarket.com/predictions/economic-policy",
        keywords: ["economic policy", "economy", "fed", "interest rate", "inflation", "tariff"],
    },
    {
        name: "NBA",
        slug: "nba",
        sourceUrl: "https://polymarket.com/predictions/nba",
        keywords: ["nba", "basketball", "playoffs", "finals", "lakers", "celtics"],
    },
    {
        name: "Movies",
        slug: "movies",
        sourceUrl: "https://polymarket.com/pop-culture/movies",
        keywords: ["movie", "movies", "box office", "oscar", "film", "marvel"],
    },
];

type NormalizedGammaMarket = {
    marketId: string;
    clobTokenId: string | null;
    question: string;
    eventTitle: string;
    eventSlug: string;
    category: string;
    tags: string[];
    yesPrice: number | null;
    noPrice: number | null;
    volume: number | null;
    liquidity: number | null;
    endDate: Date | null;
    closed: boolean;
};

function parseStringArray(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return [];

        try {
            const parsed = JSON.parse(trimmed) as unknown;
            if (Array.isArray(parsed)) {
                return parsed.map((item) => String(item).trim()).filter(Boolean);
            }
        } catch {
            // Fallback to comma-separated parsing.
        }

        if (trimmed.includes(",")) {
            return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
        }

        return [trimmed];
    }

    return [];
}

function parseOutcomePrices(value: unknown): { yes: number | null; no: number | null } {
    let prices: unknown = value;

    if (typeof prices === "string") {
        try {
            prices = JSON.parse(prices);
        } catch {
            return { yes: null, no: null };
        }
    }

    if (!Array.isArray(prices) || prices.length < 2) {
        return { yes: null, no: null };
    }

    const yes = Number(prices[0]);
    const no = Number(prices[1]);

    return {
        yes: Number.isFinite(yes) ? yes : null,
        no: Number.isFinite(no) ? no : null,
    };
}

function toNumberOrNull(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toDateOrNull(value: unknown): Date | null {
    if (!value) return null;
    const date = new Date(String(value));
    return Number.isFinite(date.getTime()) ? date : null;
}

function normalizeSearchText(input: string): string {
    return input.toLowerCase().replace(/\s+/g, " ").trim();
}

function escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keywordAsTermPattern(keyword: string): RegExp | null {
    const normalized = normalizeSearchText(keyword);
    if (!normalized) return null;

    const escaped = escapeRegExp(normalized).replace(/\s+/g, "\\s+");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
}

function marketMatchesKeywords(market: NormalizedGammaMarket, keywords: string[]): boolean {
    if (keywords.length === 0) return false;

    const haystack = normalizeSearchText(
        [market.question, market.eventTitle, market.eventSlug, market.category, market.tags.join(" ")].join(" "),
    );

    return keywords.some((keyword) => {
        const pattern = keywordAsTermPattern(keyword);
        return pattern ? pattern.test(haystack) : false;
    });
}

function normalizeGammaMarkets(rawEvents: unknown[], closed: boolean): NormalizedGammaMarket[] {
    const rows: NormalizedGammaMarket[] = [];

    for (const rawEvent of rawEvents) {
        if (!rawEvent || typeof rawEvent !== "object") continue;
        const event = rawEvent as Record<string, unknown>;

        const eventTitle = String(event.title || "").trim();
        const eventSlug = String(event.slug || "").trim();

        const tagsRaw = Array.isArray(event.tags) ? event.tags : [];
        const tags = tagsRaw
            .map((tag) => {
                if (tag && typeof tag === "object") {
                    const record = tag as Record<string, unknown>;
                    return String(record.label || record.slug || "").trim();
                }
                return String(tag || "").trim();
            })
            .filter(Boolean);

        const category = tags[0] || "Other";

        const marketsRaw = Array.isArray(event.markets) ? event.markets : [];

        for (const rawMarket of marketsRaw) {
            if (!rawMarket || typeof rawMarket !== "object") continue;
            const market = rawMarket as Record<string, unknown>;

            const clobTokenIds = parseStringArray(market.clobTokenIds);
            const marketId = String(market.conditionId || clobTokenIds[0] || market.id || "").trim();
            if (!marketId) continue;

            const question = String(market.question || eventTitle || "Untitled Market").trim();
            const prices = parseOutcomePrices(market.outcomePrices);

            rows.push({
                marketId,
                clobTokenId: clobTokenIds[0] || null,
                question,
                eventTitle,
                eventSlug,
                category,
                tags,
                yesPrice: prices.yes,
                noPrice: prices.no,
                volume: toNumberOrNull(event.volume),
                liquidity: toNumberOrNull(market.liquidity),
                endDate: toDateOrNull(market.endDate || event.end_date_iso),
                closed,
            });
        }
    }

    return rows;
}

async function fetchGammaEventsByClosed(closed: boolean): Promise<unknown[]> {
    const all: unknown[] = [];

    for (let offset = 0; offset <= EVENTS_MAX_OFFSET; offset += EVENTS_PAGE_SIZE) {
        const response = await fetch(
            `${POLYMARKET_GAMMA_API}/events?limit=${EVENTS_PAGE_SIZE}&offset=${offset}&closed=${closed ? "true" : "false"}`,
            {
                cache: "no-store",
                headers: { Accept: "application/json" },
            },
        );

        if (!response.ok) {
            break;
        }

        const data = (await response.json()) as unknown;
        if (!Array.isArray(data) || data.length === 0) {
            break;
        }

        all.push(...data);

        if (data.length < EVENTS_PAGE_SIZE) {
            break;
        }
    }

    return all;
}

export async function ensureDefaultPolymarketGroups(prisma: PrismaClient): Promise<PolymarketMarketGroup[]> {
    for (const seed of DEFAULT_POLYMARKET_GROUPS) {
        await prisma.polymarketMarketGroup.upsert({
            where: { slug: seed.slug },
            create: {
                name: seed.name,
                slug: seed.slug,
                source_url: seed.sourceUrl,
                source_type: "KEYWORD",
                match_keywords: seed.keywords.join(","),
                is_system: true,
            },
            update: {
                name: seed.name,
                source_url: seed.sourceUrl,
                source_type: "KEYWORD",
                match_keywords: seed.keywords.join(","),
                is_system: true,
            },
        });
    }

    return prisma.polymarketMarketGroup.findMany({
        orderBy: [{ is_system: "desc" }, { created_at: "asc" }],
    });
}

function parseGroupKeywords(group: PolymarketMarketGroup): string[] {
    return String(group.match_keywords || "")
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
}

export async function syncPolymarketGroups(prisma: PrismaClient, groups: PolymarketMarketGroup[]) {
    const [openEvents, closedEvents] = await Promise.all([
        fetchGammaEventsByClosed(false),
        fetchGammaEventsByClosed(true),
    ]);

    const openMarkets = normalizeGammaMarkets(openEvents, false);
    const historicalMarkets = normalizeGammaMarkets(closedEvents, true);
    const allMarkets = [...openMarkets, ...historicalMarkets];

    const dedupedByKey = new Map<string, NormalizedGammaMarket>();
    for (const market of allMarkets) {
        const key = `${market.marketId}:${market.closed ? "1" : "0"}`;
        dedupedByKey.set(key, market);
    }

    const dedupedMarkets = [...dedupedByKey.values()];

    const allMatchedMarketIds = new Set<string>();
    const matchedByGroup = new Map<number, NormalizedGammaMarket[]>();

    for (const group of groups) {
        const keywords = parseGroupKeywords(group);
        const matched = dedupedMarkets.filter((market) => marketMatchesKeywords(market, keywords));
        matchedByGroup.set(group.group_id, matched);
        for (const market of matched) {
            allMatchedMarketIds.add(market.marketId);
        }
    }

    const tradeCountMap = new Map<string, number>();
    if (allMatchedMarketIds.size > 0) {
        const tradeCounts = await prisma.polymarketTransaction.groupBy({
            by: ["market_id"],
            where: {
                market_id: { in: [...allMatchedMarketIds] },
            },
            _count: {
                market_id: true,
            },
        });

        for (const item of tradeCounts) {
            tradeCountMap.set(item.market_id, item._count.market_id);
        }
    }

    const summary: Array<{ groupId: number; slug: string; name: string; matched: number; snapshotsCreated: number }> = [];

    for (const group of groups) {
        const matched = matchedByGroup.get(group.group_id) || [];
        const matchedMarketIds = matched.map((market) => market.marketId);

        if (matchedMarketIds.length > 0) {
            await prisma.polymarketGroupedMarket.deleteMany({
                where: {
                    group_id: group.group_id,
                    market_id: { notIn: matchedMarketIds },
                },
            });

            await prisma.polymarketGroupedMarketSnapshot.deleteMany({
                where: {
                    group_id: group.group_id,
                    market_id: { notIn: matchedMarketIds },
                },
            });
        } else {
            await prisma.polymarketGroupedMarket.deleteMany({
                where: { group_id: group.group_id },
            });

            await prisma.polymarketGroupedMarketSnapshot.deleteMany({
                where: { group_id: group.group_id },
            });
        }

        let snapshotsCreated = 0;

        for (const market of matched) {
            await prisma.polymarketGroupedMarket.upsert({
                where: {
                    group_id_market_id: {
                        group_id: group.group_id,
                        market_id: market.marketId,
                    },
                },
                create: {
                    group_id: group.group_id,
                    market_id: market.marketId,
                    clob_token_id: market.clobTokenId,
                    question: market.question,
                    event_title: market.eventTitle || null,
                    event_slug: market.eventSlug || null,
                    category: market.category || null,
                    is_closed: market.closed,
                    first_seen_at: new Date(),
                    last_seen_at: new Date(),
                },
                update: {
                    clob_token_id: market.clobTokenId,
                    question: market.question,
                    event_title: market.eventTitle || null,
                    event_slug: market.eventSlug || null,
                    category: market.category || null,
                    is_closed: market.closed,
                    last_seen_at: new Date(),
                },
            });

            await prisma.polymarketGroupedMarketSnapshot.create({
                data: {
                    group_id: group.group_id,
                    market_id: market.marketId,
                    yes_price: market.yesPrice,
                    no_price: market.noPrice,
                    volume: market.volume,
                    liquidity: market.liquidity,
                    end_date_iso: market.endDate,
                    is_closed: market.closed,
                    question: market.question,
                    category: market.category || null,
                    trade_count: tradeCountMap.get(market.marketId) || 0,
                },
            });

            snapshotsCreated += 1;
        }

        summary.push({
            groupId: group.group_id,
            slug: group.slug,
            name: group.name,
            matched: matched.length,
            snapshotsCreated,
        });
    }

    return {
        totalEvents: openEvents.length + closedEvents.length,
        totalMarketsScanned: dedupedMarkets.length,
        groups: summary,
    };
}
