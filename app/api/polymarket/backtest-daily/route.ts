import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendDiscordMessage } from "@/lib/discord";
import { ensureDefaultPolymarketGroups, syncPolymarketGroups } from "@/lib/polymarket-groups";

const PRIORITY_GROUP_SLUGS = ["nba", "elon-tweets", "economic-policy", "movies"] as const;
const DEFAULT_DAILY_BATCH_SIZE = 12;
const MIN_DAILY_BATCH_SIZE = 10;
const MAX_DAILY_BATCH_SIZE = 20;

type StaffUser = {
    id?: number;
    role?: string;
    name?: string;
    email?: string;
};

type CandidateMarket = {
    groupName: string;
    groupSlug: string;
    marketId: string;
    clobTokenId: string;
    question: string;
    isClosed: boolean;
    volume: number;
    liquidity: number;
};

type BacktestRunSuccess = {
    ok: true;
    marketId: string;
    clobTokenId: string;
    group: string;
    market: string;
    netPnL: number;
    returnPct: number;
    tradesExecuted: number;
    discordSent: boolean;
};

type BacktestRunFailure = {
    ok: false;
    error: string;
};

type BacktestRunResult = BacktestRunSuccess | BacktestRunFailure;

function isStaffOrAdmin(role: string | undefined) {
    const normalized = String(role || "").toLowerCase();
    return normalized === "staff" || normalized === "admin";
}

function normalizeBatchSize(raw: unknown) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_DAILY_BATCH_SIZE;
    const rounded = Math.floor(parsed);
    if (rounded < MIN_DAILY_BATCH_SIZE) return MIN_DAILY_BATCH_SIZE;
    if (rounded > MAX_DAILY_BATCH_SIZE) return MAX_DAILY_BATCH_SIZE;
    return rounded;
}

function getDateWindow(daysBack: number) {
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - daysBack);

    return {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
    };
}

async function getAuthedUser(): Promise<StaffUser | null> {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get("user")?.value;
    if (!userCookie) return null;

    try {
        return JSON.parse(userCookie) as StaffUser;
    } catch {
        return null;
    }
}

function getGroupPriority(slug: string) {
    const index = PRIORITY_GROUP_SLUGS.indexOf(slug as (typeof PRIORITY_GROUP_SLUGS)[number]);
    return index >= 0 ? index : PRIORITY_GROUP_SLUGS.length;
}

async function getCandidateMarkets(limit: number) {
    await ensureDefaultPolymarketGroups(prisma);

    const groups = await prisma.polymarketMarketGroup.findMany({
        where: {
            slug: {
                in: [...PRIORITY_GROUP_SLUGS],
            },
        },
        orderBy: [{ is_system: "desc" }, { created_at: "asc" }],
    });

    if (groups.length === 0) {
        return [] as CandidateMarket[];
    }

    await syncPolymarketGroups(prisma, groups);

    const groupIds = groups.map((group) => group.group_id);

    const [markets, snapshots] = await Promise.all([
        prisma.polymarketGroupedMarket.findMany({
            where: {
                group_id: { in: groupIds },
            },
            include: {
                group: {
                    select: {
                        slug: true,
                        name: true,
                    },
                },
            },
            orderBy: [{ is_closed: "asc" }, { last_seen_at: "desc" }],
            take: 600,
        }),
        prisma.polymarketGroupedMarketSnapshot.findMany({
            where: {
                group_id: { in: groupIds },
            },
            orderBy: { collected_at: "desc" },
            select: {
                group_id: true,
                market_id: true,
                volume: true,
                liquidity: true,
            },
            take: 4000,
        }),
    ]);

    const latestSnapshotByKey = new Map<string, { volume: number; liquidity: number }>();
    for (const snapshot of snapshots) {
        const key = `${snapshot.group_id}:${snapshot.market_id}`;
        if (!latestSnapshotByKey.has(key)) {
            latestSnapshotByKey.set(key, {
                volume: Number(snapshot.volume || 0),
                liquidity: Number(snapshot.liquidity || 0),
            });
        }
    }

    const candidates: CandidateMarket[] = markets
        .map((market) => {
            const key = `${market.group_id}:${market.market_id}`;
            const latestSnapshot = latestSnapshotByKey.get(key);
            const clobTokenId = String(market.clob_token_id || market.market_id).trim();

            return {
                groupName: market.group.name,
                groupSlug: market.group.slug,
                marketId: market.market_id,
                clobTokenId,
                question: market.question,
                isClosed: market.is_closed,
                volume: Number(latestSnapshot?.volume || 0),
                liquidity: Number(latestSnapshot?.liquidity || 0),
            };
        })
        .filter((market) => Boolean(market.clobTokenId));

    candidates.sort((left, right) => {
        const groupPriorityDiff = getGroupPriority(left.groupSlug) - getGroupPriority(right.groupSlug);
        if (groupPriorityDiff !== 0) return groupPriorityDiff;

        if (left.isClosed !== right.isClosed) {
            return left.isClosed ? 1 : -1;
        }

        if (right.volume !== left.volume) {
            return right.volume - left.volume;
        }

        if (right.liquidity !== left.liquidity) {
            return right.liquidity - left.liquidity;
        }

        return left.question.localeCompare(right.question);
    });

    const uniqueByClobToken = new Set<string>();
    const selected: CandidateMarket[] = [];

    for (const candidate of candidates) {
        if (uniqueByClobToken.has(candidate.clobTokenId)) continue;
        uniqueByClobToken.add(candidate.clobTokenId);
        selected.push(candidate);
        if (selected.length >= limit) break;
    }

    return selected;
}

async function runBacktestForCandidate(origin: string, candidate: CandidateMarket): Promise<BacktestRunResult> {
    const window = getDateWindow(45);

    const response = await fetch(`${origin}/api/polymarket/backtest-auto-buy-sell`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
            marketId: candidate.clobTokenId,
            action: "BOTH",
            triggerType: "PRICE_TARGET",
            direction: "ABOVE",
            buyTargetPrice: 0.43,
            sellTargetPrice: 0.57,
            quantity: 5,
            start: window.start,
            end: window.end,
            initialCash: 1000,
            initialPosition: 0,
            mode: "repeat",
        }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        result?: {
            netPnL?: number;
            returnPct?: number;
            tradesExecuted?: number;
            buyTrades?: number;
            sellTrades?: number;
        };
    };

    if (!response.ok || !payload.result) {
        return {
            ok: false,
            error: payload.error || "Backtest API failed",
        };
    }

    const result = payload.result;
    const netPnL = Number(result.netPnL || 0);
    const returnPct = Number(result.returnPct || 0);
    const tradesExecuted = Number(result.tradesExecuted || 0);
    const buyTrades = Number(result.buyTrades || 0);
    const sellTrades = Number(result.sellTrades || 0);

    const discordSent = await sendDiscordMessage({
        title: "Polymarket backtest completed",
        lines: [
            `Theme: ${candidate.groupName}`,
            `Market: ${candidate.question}`,
            `Net PnL: ${netPnL >= 0 ? "+" : ""}${netPnL.toFixed(2)}`,
            `Return: ${returnPct.toFixed(2)}%`,
            `Trades: total=${tradesExecuted}, buy=${buyTrades}, sell=${sellTrades}`,
            `Detail: ${origin}/polymarket/market/${encodeURIComponent(candidate.clobTokenId)}`,
        ],
        mention: false,
    });

    return {
        ok: true,
        marketId: candidate.marketId,
        clobTokenId: candidate.clobTokenId,
        group: candidate.groupName,
        market: candidate.question,
        netPnL,
        returnPct,
        tradesExecuted,
        discordSent,
    };
}

async function runDailyBatch(origin: string, batchSize: number) {
    const candidates = await getCandidateMarkets(batchSize);
    const completed: BacktestRunSuccess[] = [];
    const failed: Array<{ marketId: string; clobTokenId: string; group: string; market: string; error: string }> = [];

    for (const candidate of candidates) {
        const result = await runBacktestForCandidate(origin, candidate);
        if (result.ok === true) {
            completed.push(result);
        } else {
            failed.push({
                marketId: candidate.marketId,
                clobTokenId: candidate.clobTokenId,
                group: candidate.groupName,
                market: candidate.question,
                error: result.error,
            });
        }
    }

    const discordDelivered = completed.filter((item) => item.discordSent).length;

    await sendDiscordMessage({
        title: "Polymarket daily backtest batch summary",
        lines: [
            `Requested batch size: ${batchSize}`,
            `Selected markets: ${candidates.length}`,
            `Completed backtests: ${completed.length}`,
            `Discord notifications delivered: ${discordDelivered}`,
            `Failed backtests: ${failed.length}`,
            `Theme priority: NBA, Elon Tweets, Economic Policy, Movies`,
        ],
        mention: false,
    });

    return {
        batchSize,
        selectedMarkets: candidates.length,
        completedCount: completed.length,
        failedCount: failed.length,
        discordDelivered,
        completed,
        failed,
    };
}

function isCronRequestAuthorized(req: NextRequest) {
    const acceptedSecrets = Array.from(
        new Set(
            [process.env.POLYMARKET_BACKTEST_CRON_SECRET, process.env.CRON_SECRET].filter(
                (value): value is string => Boolean(value && value.trim()),
            ),
        ),
    );

    if (acceptedSecrets.length === 0) {
        return true;
    }

    const headerSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("authorization") || "";
    const bearerSecret = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const querySecret = req.nextUrl.searchParams.get("secret");
    const providedSecrets = [headerSecret, querySecret, bearerSecret].filter(
        (value): value is string => Boolean(value && value.trim()),
    );

    return providedSecrets.some((provided) => acceptedSecrets.includes(provided));
}

export async function GET(req: NextRequest) {
    try {
        if (!isCronRequestAuthorized(req)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const batchSize = normalizeBatchSize(req.nextUrl.searchParams.get("limit"));
        const result = await runDailyBatch(req.nextUrl.origin, batchSize);
        return NextResponse.json({ success: true, source: "cron", ...result });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to run daily polymarket backtests";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthedUser();
        if (!user?.id || !isStaffOrAdmin(user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = (await req.json().catch(() => ({}))) as { limit?: number };
        const batchSize = normalizeBatchSize(body.limit);
        const result = await runDailyBatch(req.nextUrl.origin, batchSize);

        return NextResponse.json({
            success: true,
            source: "manual",
            requestedBy: user.name || user.email || `User ${user.id}`,
            ...result,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to run manual polymarket backtests";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}