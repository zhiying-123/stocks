import "dotenv/config";
import prisma from "../lib/prisma";

const POLYMARKET_API = "https://gamma-api.polymarket.com";

type TopicConfig = {
    topic: string;
    mustIncludeAny: string[][];
    bonusTerms: string[];
};

type CandidateMarket = {
    topic: string;
    marketId: string;
    conditionId: string;
    question: string;
    volume: number;
    yesPrice: number | null;
    noPrice: number | null;
    score: number;
};

const TOPICS: TopicConfig[] = [
    {
        topic: "Elon Tweets",
        mustIncludeAny: [["elon", "musk"], ["tweet", "tweets", "x post", "post on x"]],
        bonusTerms: ["tesla", "doge", "trump", "mentions"],
    },
    {
        topic: "Movie Box Office",
        mustIncludeAny: [["movie", "film", "box office", "top grossing", "opening weekend"], ["2026", "weekend", "domestic", "grossing"]],
        bonusTerms: ["gross", "domestic", "ticket", "theater", "opening", "box office"],
    },
    {
        topic: "US Federal Reserve Interest Rates",
        mustIncludeAny: [["federal reserve", "fed", "fomc"], ["rate", "interest", "cut", "hike", "bps"]],
        bonusTerms: ["meeting", "target", "range", "jpow", "powell"],
    },
    {
        topic: "NBA Basketball games",
        mustIncludeAny: [["nba"], ["game", "win", "wins", "vs", "spread"]],
        bonusTerms: ["playoffs", "finals", "lakers", "celtics", "warriors", "knicks"],
    },
];

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

function parsePrices(value: unknown): [number, number] | null {
    let raw = value;
    if (typeof raw === "string") {
        try {
            raw = JSON.parse(raw);
        } catch {
            return null;
        }
    }

    if (!Array.isArray(raw) || raw.length < 2) return null;
    const yes = Number(raw[0]);
    const no = Number(raw[1]);
    if (!Number.isFinite(yes) || !Number.isFinite(no)) return null;
    return [yes, no];
}

function textMatchesTopic(textLower: string, cfg: TopicConfig): { matched: boolean; score: number } {
    for (const group of cfg.mustIncludeAny) {
        const hasGroupMatch = group.some((term) => textLower.includes(term));
        if (!hasGroupMatch) return { matched: false, score: 0 };
    }

    let score = 10;
    for (const group of cfg.mustIncludeAny) {
        for (const term of group) {
            if (textLower.includes(term)) score += 2;
        }
    }

    for (const term of cfg.bonusTerms) {
        if (textLower.includes(term)) score += 1;
    }

    return { matched: true, score };
}

async function fetchOpenEvents(limit = 500, maxPages = 5) {
    const events: any[] = [];

    for (let page = 0; page < maxPages; page += 1) {
        const offset = page * limit;
        const url = `${POLYMARKET_API}/events?limit=${limit}&offset=${offset}&closed=false`;
        const res = await fetch(url, {
            headers: { Accept: "application/json" },
            cache: "no-store",
        });

        if (!res.ok) {
            throw new Error(`Failed to fetch events (${res.status}) at offset ${offset}`);
        }

        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) break;

        events.push(...data);

        if (data.length < limit) break;
    }

    return events;
}

function pickCandidates(events: any[]) {
    const byTopic: Record<string, CandidateMarket[]> = {};
    for (const cfg of TOPICS) byTopic[cfg.topic] = [];

    for (const event of events) {
        const markets = Array.isArray(event?.markets) ? event.markets : [];

        for (const market of markets) {
            const question = String(market?.question || event?.title || "").trim();
            if (!question) continue;

            const textLower = question.toLowerCase();
            const conditionId = String(market?.conditionId || "").trim();
            const clobIds = parseStringArray(market?.clobTokenIds)
                .map((id) => id.trim())
                .filter(Boolean);
            const marketId = (clobIds[0] || conditionId).trim();
            if (!marketId) continue;

            const prices = parsePrices(market?.outcomePrices);
            const yesPrice = prices ? prices[0] : null;
            const noPrice = prices ? prices[1] : null;
            const volume = Number(market?.volume || event?.volume || 0) || 0;

            for (const cfg of TOPICS) {
                const match = textMatchesTopic(textLower, cfg);
                if (!match.matched) continue;

                byTopic[cfg.topic].push({
                    topic: cfg.topic,
                    marketId,
                    conditionId,
                    question,
                    volume,
                    yesPrice,
                    noPrice,
                    score: match.score,
                });
            }
        }
    }

    return byTopic;
}

function chooseBestPerTopic(byTopic: Record<string, CandidateMarket[]>) {
    const selected: CandidateMarket[] = [];

    for (const cfg of TOPICS) {
        const ranked = (byTopic[cfg.topic] || [])
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return b.volume - a.volume;
            });

        if (ranked[0]) selected.push(ranked[0]);
    }

    return selected;
}

async function main() {
    const email = process.argv[2]?.trim().toLowerCase();
    if (!email) {
        throw new Error("Usage: npx tsx scripts/add-requested-market-alerts.ts <email>");
    }

    const user = await prisma.user.findFirst({
        where: {
            email: {
                equals: email,
                mode: "insensitive",
            },
        },
        select: {
            u_id: true,
            email: true,
            name: true,
        },
    });

    if (!user) {
        throw new Error(`User not found: ${email}`);
    }

    const events = await fetchOpenEvents();
    const byTopic = pickCandidates(events);
    const picks = chooseBestPerTopic(byTopic);

    if (picks.length === 0) {
        throw new Error("No matching open markets found for requested topics");
    }

    const results: Array<Record<string, unknown>> = [];

    for (const pick of picks) {
        const watchlist = await prisma.polymarketWatchlist.upsert({
            where: {
                u_id_market_id: {
                    u_id: user.u_id,
                    market_id: pick.marketId,
                },
            },
            update: {},
            create: {
                u_id: user.u_id,
                market_id: pick.marketId,
            },
        });

        const existingAlert = await prisma.polymarketPriceAlert.findFirst({
            where: {
                u_id: user.u_id,
                market_id: pick.marketId,
                outcome: "YES",
                direction: "ABOVE",
                target_price: 0.55,
                is_active: true,
            },
            orderBy: {
                created_at: "desc",
            },
        });

        const alert = existingAlert
            ? existingAlert
            : await prisma.polymarketPriceAlert.create({
                data: {
                    u_id: user.u_id,
                    market_id: pick.marketId,
                    outcome: "YES",
                    direction: "ABOVE",
                    target_price: 0.55,
                    source: "DIRECT|EMAIL,DISCORD",
                    is_active: true,
                },
            });

        results.push({
            topic: pick.topic,
            marketId: pick.marketId,
            conditionId: pick.conditionId,
            question: pick.question,
            volume: pick.volume,
            yesPrice: pick.yesPrice,
            noPrice: pick.noPrice,
            watchlistId: watchlist.watchlist_id,
            alertId: alert.alert_id,
            reusedExistingAlert: Boolean(existingAlert),
        });
    }

    console.log(
        JSON.stringify(
            {
                success: true,
                user,
                addedCount: results.length,
                alertRule: {
                    outcome: "YES",
                    direction: "ABOVE",
                    targetPrice: 0.55,
                    targetPricePercent: 55,
                    source: "DIRECT|EMAIL,DISCORD",
                },
                markets: results,
            },
            null,
            2,
        ),
    );
}

main()
    .catch((error) => {
        console.error("ADD_REQUESTED_MARKET_ALERTS_FAILED", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
