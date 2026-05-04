import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendDiscordMessage } from "@/lib/discord";
import runBacktest from "@/lib/backtest-runner";
import { ensureDefaultPolymarketGroups, syncPolymarketGroups } from "@/lib/polymarket-groups";

const PRIORITY_GROUP_SLUGS = ["nba", "elon-tweets", "economic-policy", "movies"] as const;
const DEFAULT_DAILY_BATCH_SIZE = 12;
const MIN_DAILY_BATCH_SIZE = 5;
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

type DailyBatchPlan = {
    candidates: CandidateMarket[];
    excludedCount: number;
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

function parseExcludedTokenIds(raw: unknown) {
    if (!Array.isArray(raw)) return [] as string[];

    return raw
        .map((value) => String(value || "").trim())
        .filter((value) => Boolean(value));
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

function pickBalancedCandidateMarkets(candidates: CandidateMarket[], limit: number) {
    if (limit <= 0 || candidates.length === 0) {
        return [] as CandidateMarket[];
    }

    const uniqueByClobToken = new Set<string>();
    const groupedCandidates = new Map<string, CandidateMarket[]>();

    for (const candidate of candidates) {
        if (uniqueByClobToken.has(candidate.clobTokenId)) continue;
        uniqueByClobToken.add(candidate.clobTokenId);

        const existing = groupedCandidates.get(candidate.groupSlug) || [];
        existing.push(candidate);
        groupedCandidates.set(candidate.groupSlug, existing);
    }

    const orderedGroups = PRIORITY_GROUP_SLUGS.map((slug) => ({
        slug,
        candidates: groupedCandidates.get(slug) || [],
    })).filter((group) => group.candidates.length > 0);

    const selected: CandidateMarket[] = [];

    for (let round = 0; selected.length < limit; round += 1) {
        let addedAny = false;

        for (const group of orderedGroups) {
            const nextCandidate = group.candidates[round];
            if (!nextCandidate) continue;

            selected.push(nextCandidate);
            addedAny = true;

            if (selected.length >= limit) {
                break;
            }
        }

        if (!addedAny) {
            break;
        }
    }

    return selected;
}

async function loadCandidateMarkets(syncFirst: boolean, activeGroupSlugs: string[] = [...PRIORITY_GROUP_SLUGS]) {
    await ensureDefaultPolymarketGroups(prisma);

    const groups = await prisma.polymarketMarketGroup.findMany({
        where: {
            slug: {
                in: activeGroupSlugs,
            },
        },
        orderBy: [{ is_system: "desc" }, { created_at: "asc" }],
    });

    if (groups.length === 0) {
        return [] as CandidateMarket[];
    }

    if (syncFirst) {
        await syncPolymarketGroups(prisma, groups);
    }

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

    return candidates;
}

async function getCandidateMarkets(limit: number, activeGroupSlugs: string[] = [...PRIORITY_GROUP_SLUGS]) {
    const candidates = await loadCandidateMarkets(true, activeGroupSlugs);
    return pickBalancedCandidateMarkets(candidates, limit);
}

async function getCachedCandidateMarkets(limit: number, activeGroupSlugs: string[] = [...PRIORITY_GROUP_SLUGS]) {
    const candidates = await loadCandidateMarkets(false, activeGroupSlugs);
    return pickBalancedCandidateMarkets(candidates, limit);
}

async function getDailyBatchPlan(
    limit: number,
    excludedClobTokenIds: string[] = [],
    groupFilters: string[] = [...PRIORITY_GROUP_SLUGS],
): Promise<DailyBatchPlan> {
    const excludedSet = new Set(excludedClobTokenIds.map((value) => value.trim()).filter(Boolean));
    const candidates = await getCandidateMarkets(limit + excludedSet.size + 20, groupFilters);
    const planned: CandidateMarket[] = [];

    for (const candidate of candidates) {
        if (excludedSet.has(candidate.clobTokenId)) continue;
        planned.push(candidate);
        if (planned.length >= limit) break;
    }

    return {
        candidates: planned,
        excludedCount: excludedSet.size,
    };
}

async function getDailyBatchPreview(
    limit: number,
    excludedClobTokenIds: string[] = [],
    groupFilters: string[] = [...PRIORITY_GROUP_SLUGS],
): Promise<DailyBatchPlan> {
    const excludedSet = new Set(excludedClobTokenIds.map((value) => value.trim()).filter(Boolean));
    const candidates = await getCachedCandidateMarkets(limit + excludedSet.size + 20, groupFilters);
    const planned: CandidateMarket[] = [];

    for (const candidate of candidates) {
        if (excludedSet.has(candidate.clobTokenId)) continue;
        planned.push(candidate);
        if (planned.length >= limit) break;
    }

    return {
        candidates: planned,
        excludedCount: excludedSet.size,
    };
}

async function runBacktestForCandidate(origin: string, candidate: CandidateMarket): Promise<BacktestRunResult> {
    const window = getDateWindow(45);

    try {
        const payload = await runBacktest({
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
        } as any);

        if (!payload || !(payload as any).ok) {
            return { ok: false, error: (payload as any)?.error || "Backtest failed" };
        }

        const result = (payload as any).result || {};
        const netPnL = Number(result.netPnL || 0);
        const returnPct = Number(result.returnPct || 0);
        const tradesExecuted = Number(result.tradesExecuted || result.tradesExecuted || 0);
        const buyTrades = Number(result.buyTrades || 0);
        const sellTrades = Number(result.sellTrades || 0);

        const finalEquity = Number(((result?.finalEquity) ?? (1000 + netPnL)).toFixed?.() ?? (1000 + netPnL));
        const vsBuyAndHold = Number((result?.vsBuyAndHoldPct ?? 0) as number);
        const maxDrawdown = Number((result?.maxDrawdownPct ?? 0) as number);

        const discordSent = await sendDiscordMessage({
            title: "Polymarket Backtest Completed (Auto)",
            lines: [],
            mention: false,
            embed: {
                title: `Polymarket Backtest Completed (Auto)`,
                url: `${origin}/polymarket/market/${encodeURIComponent(candidate.clobTokenId)}`,
                description: `This is a daily automated recommendation.`,
                color: 3066993,
                fields: [
                    { name: "Generated", value: new Date().toISOString(), inline: false },
                    { name: "Market", value: candidate.question, inline: false },
                    { name: "Window", value: `${window.start} to ${window.end}`, inline: false },
                    { name: "Setup", value: `BOTH | PRICE_TARGET | mode=repeat`, inline: false },
                    { name: "Net PnL", value: `${netPnL >= 0 ? "+" : ""}${netPnL.toFixed(2)} (${returnPct.toFixed(2)}%)`, inline: true },
                    { name: "Final Equity", value: `${Number(finalEquity).toFixed(2)}`, inline: true },
                    { name: "Vs Buy & Hold", value: `${Number(vsBuyAndHold).toFixed(2)} pp`, inline: true },
                    { name: "Trades", value: `executed=${tradesExecuted}, buy=${buyTrades}, sell=${sellTrades}`, inline: false },
                    { name: "Max Drawdown", value: `${Number(maxDrawdown).toFixed(2)}%`, inline: false },
                ],
                footerText: `Requested by: Polymarket Backtest (Auto)`,
                timestamp: new Date().toISOString(),
            },
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
    } catch (err: any) {
        return { ok: false, error: err?.message || String(err) };
    }
}

async function runDailyBatch(
    origin: string,
    batchSize: number,
    excludedClobTokenIds: string[] = [],
    groupFilters: string[] = [...PRIORITY_GROUP_SLUGS],
) {
    const plan = await getDailyBatchPlan(batchSize, excludedClobTokenIds, groupFilters);
    const candidates = plan.candidates;
    const completed: BacktestRunSuccess[] = [];
    const failed: Array<{ marketId: string; clobTokenId: string; group: string; market: string; error: string }> = [];

    // OPTIMIZATION: Pre-load price history for all candidates in parallel
    // This populates the cache in backtest-runner, making subsequent backtest runs much faster
    const priceLoadPromises = candidates.map((candidate) =>
        fetch(`https://clob.polymarket.com/prices-history?market=${encodeURIComponent(candidate.clobTokenId)}&interval=all`, {
            next: { revalidate: 300 },
            headers: { Accept: "application/json" },
        }).catch(() => null)
    );

    // Wait for all price data to be fetched (with timeout to avoid blocking)
    await Promise.race([
        Promise.all(priceLoadPromises),
        new Promise((resolve) => setTimeout(resolve, 15000)), // 15 second timeout
    ]).catch(() => {
        // Errors during pre-loading are non-critical; backtests will still work
    });

    // Run backtests with higher concurrency now that price data is cached
    // Can safely increase to 10 since the main bottleneck (API calls) is pre-loaded
    const CONCURRENCY = Math.min(10, Math.max(1, candidates.length));

    for (let i = 0; i < candidates.length; i += CONCURRENCY) {
        const chunk = candidates.slice(i, i + CONCURRENCY);
        const promises = chunk.map(async (candidate) => {
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
        });

        // Wait for this batch to finish before starting the next.
        await Promise.all(promises);
    }

    const discordDelivered = completed.filter((item) => item.discordSent).length;

    await sendDiscordMessage({
        title: "Polymarket daily automated backtest recommendation",
        lines: [
            `Run type: daily automated`,
            `Requested batch size: ${batchSize}`,
            `Selected markets: ${candidates.length}`,
            `Themes: ${groupFilters.join(", ")}`,
            `Completed backtests: ${completed.length}`,
            `Discord notifications delivered: ${discordDelivered}`,
            `Failed backtests: ${failed.length}`,
            `Recommendation note: this batch was auto-picked from the daily priority pool.`,
        ],
        mention: false,
    });

    return {
        batchSize,
        selectedMarkets: candidates.length,
        excludedCount: plan.excludedCount,
        plannedMarkets: candidates.map((candidate) => ({
            marketId: candidate.marketId,
            clobTokenId: candidate.clobTokenId,
            group: candidate.groupName,
            market: candidate.question,
            isClosed: candidate.isClosed,
            volume: candidate.volume,
            liquidity: candidate.liquidity,
        })),
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

        const body = (await req.json().catch(() => ({}))) as {
            limit?: number;
            previewOnly?: boolean;
            excludedClobTokenIds?: unknown;
            groupFilters?: unknown;
        };
        const batchSize = normalizeBatchSize(body.limit);
        const excludedClobTokenIds = parseExcludedTokenIds(body.excludedClobTokenIds);
        const groupFilters = parseGroupFilters(body.groupFilters);

        if (body.previewOnly === true) {
            const plan = await getDailyBatchPreview(batchSize, excludedClobTokenIds, groupFilters);
            return NextResponse.json({
                success: true,
                source: "preview",
                requestedBy: user.name || user.email || `User ${user.id}`,
                batchSize,
                excludedCount: plan.excludedCount,
                groupFilters,
                plannedMarkets: plan.candidates.map((candidate) => ({
                    marketId: candidate.marketId,
                    clobTokenId: candidate.clobTokenId,
                    group: candidate.groupName,
                    market: candidate.question,
                    isClosed: candidate.isClosed,
                    volume: candidate.volume,
                    liquidity: candidate.liquidity,
                })),
            });
        }

        const result = await runDailyBatch(req.nextUrl.origin, batchSize, excludedClobTokenIds, groupFilters);

        return NextResponse.json({
            success: true,
            source: "manual",
            requestedBy: user.name || user.email || `User ${user.id}`,
            groupFilters,
            ...result,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to run manual polymarket backtests";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

function parseGroupFilters(raw: unknown) {
    const allowed = new Set<string>(PRIORITY_GROUP_SLUGS);
    if (!Array.isArray(raw)) {
        return [...PRIORITY_GROUP_SLUGS] as string[];
    }

    const normalized = Array.from(
        new Set(
            raw
                .map((value) => String(value || "").trim())
                .filter((value) => allowed.has(value)),
        ),
    );

    return normalized.length > 0 ? normalized : ([...PRIORITY_GROUP_SLUGS] as string[]);
}