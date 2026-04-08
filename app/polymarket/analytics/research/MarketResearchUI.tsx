'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type MarketOption = {
    id: string;
    name: string;
};

type MarketDetail = {
    id: string;
    question: string;
    name: string;
    category: string;
    endDate: string;
    yesPrice: number | null;
    noPrice: number | null;
    volume: number;
    liquidity: number;
    resolvedFrom: string;
};

const POLYMARKET_API = 'https://gamma-api.polymarket.com';

function parseTokenIdArray(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
        const raw = value.trim();
        if (!raw) return [];

        const quoted = Array.from(raw.matchAll(/"([^\"]+)"/g)).map((m) => m[1].trim()).filter(Boolean);
        if (quoted.length > 0) return quoted;

        const numeric = Array.from(raw.matchAll(/\d+/g)).map((m) => m[0].trim()).filter(Boolean);
        if (numeric.length > 0) return numeric;

        if (raw.includes(',')) {
            return raw.split(',').map((part) => part.trim()).filter(Boolean);
        }

        return [raw];
    }
    return [];
}

function parsePair(value: unknown): [number, number] | null {
    let prices = value;
    if (typeof prices === 'string') {
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

function formatVolume(value: number) {
    if (!Number.isFinite(value) || value <= 0) return '$0';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
}

function getCandidateIds(market: any): Set<string> {
    const conditionId = String(market?.conditionId || '').trim();
    const marketId = String(market?.id || '').trim();
    const clobIds = parseTokenIdArray(market?.clobTokenIds);
    return new Set([conditionId, marketId, ...clobIds].filter(Boolean));
}

function getCategoryFromTags(tags: any): string {
    if (!Array.isArray(tags) || tags.length === 0) return 'Other';
    const first = tags[0];
    if (typeof first === 'string') {
        const label = first.trim();
        return label || 'Other';
    }
    const label = String(first?.label || '').trim();
    return label || 'Other';
}

function buildDetailFromMarket(targetId: string, market: any, fallbackCategory = 'Other', resolvedFrom = 'unknown'): MarketDetail {
    const pair = parsePair(market?.outcomePrices);
    const eventTitle = String(
        market?.events?.[0]?.title
        || market?.event?.title
        || market?.groupItemTitle
        || '',
    ).trim();
    const question = String(market?.question || market?.title || targetId).trim() || targetId;
    const name = eventTitle || question;

    return {
        id: targetId,
        question,
        name,
        category: getCategoryFromTags(market?.tags) || fallbackCategory,
        endDate: String(market?.endDate || market?.end_date_iso || ''),
        yesPrice: pair ? pair[0] : null,
        noPrice: pair ? pair[1] : null,
        volume: Number(market?.volume ? parseFloat(market.volume) : 0),
        liquidity: Number(market?.liquidity ? parseFloat(market.liquidity) : 0),
        resolvedFrom,
    };
}

async function resolveMarketDetail(targetId: string): Promise<MarketDetail | null> {
    const id = targetId.trim();
    if (!id) return null;

    try {
        const response = await fetch(`/api/polymarket/market-details?tokenId=${encodeURIComponent(id)}`, {
            cache: 'no-store',
        });

        if (response.ok) {
            const payload = await response.json();
            const market = payload?.marketInfo;
            if (market && typeof market === 'object') {
                return {
                    id,
                    question: String(market.question || market.name || id),
                    name: String(market.name || market.question || id),
                    category: String(market.category || 'Other'),
                    endDate: String(market.endDate || ''),
                    yesPrice: typeof market.yesPrice === 'number' ? market.yesPrice : null,
                    noPrice: typeof market.noPrice === 'number' ? market.noPrice : null,
                    volume: Number(market.volume || 0),
                    liquidity: Number(market.liquidity || 0),
                    resolvedFrom: 'api-market-details',
                };
            }
        }
    } catch {
        // Fall through to direct gamma lookup.
    }

    try {
        const direct = await fetch(`${POLYMARKET_API}/markets/${encodeURIComponent(id)}`, {
            cache: 'no-store',
            headers: { Accept: 'application/json' },
        });

        if (direct.ok) {
            const market = await direct.json();
            const candidateIds = getCandidateIds(market);
            if (candidateIds.has(id)) {
                return buildDetailFromMarket(id, market, 'Other', 'direct-market');
            }
        }
    } catch {
        // Fall through to event scan.
    }

    const queryLookups = [
        ['id', id],
        ['ids', id],
        ['clob_token_ids', id],
        ['condition_ids', id],
    ] as const;

    for (const [key, value] of queryLookups) {
        try {
            const response = await fetch(`${POLYMARKET_API}/markets?${key}=${encodeURIComponent(value)}`, {
                cache: 'no-store',
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) continue;

            const markets = await response.json();
            if (!Array.isArray(markets) || markets.length === 0) continue;

            const exact = markets.find((market) => getCandidateIds(market).has(id));
            if (!exact) continue;

            return buildDetailFromMarket(id, exact, 'Other', `markets-query-${key}`);
        } catch {
            // Continue to next lookup strategy.
        }
    }

    for (const closed of ['false', 'true']) {
        for (let offset = 0; offset <= 2000; offset += 500) {
            try {
                const response = await fetch(`${POLYMARKET_API}/events?limit=500&offset=${offset}&closed=${closed}`, {
                    cache: 'no-store',
                    headers: { Accept: 'application/json' },
                });
                if (!response.ok) break;

                const events = await response.json();
                if (!Array.isArray(events) || events.length === 0) break;

                for (const event of events) {
                    const markets = Array.isArray(event?.markets) ? event.markets : [];
                    for (const market of markets) {
                        const candidateIds = getCandidateIds(market);
                        if (!candidateIds.has(id)) continue;

                        const detail = buildDetailFromMarket(
                            id,
                            {
                                ...market,
                                title: market?.title || event?.title,
                                end_date_iso: market?.end_date_iso || event?.end_date_iso,
                                volume: market?.volume || (event?.volume ? String(parseFloat(event.volume) / Math.max(1, markets.length)) : '0'),
                            },
                            getCategoryFromTags(event?.tags),
                            `events-${closed}-${offset}`,
                        );

                        if (!detail.question || detail.question === id) {
                            detail.question = String(event?.title || id);
                        }

                        return detail;
                    }
                }

                if (events.length < 500) break;
            } catch {
                break;
            }
        }
    }

    return null;
}

export default function MarketResearchUI({ initialMarketIds }: { initialMarketIds: string[] }) {
    const [trackedIds, setTrackedIds] = useState<string[]>(initialMarketIds);
    const [marketDetails, setMarketDetails] = useState<Record<string, MarketDetail | null>>({});
    const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});
    const [query, setQuery] = useState('');
    const [options, setOptions] = useState<MarketOption[]>([]);

    useEffect(() => {
        let cancelled = false;

        async function loadOptions() {
            try {
                const response = await fetch('/api/polymarket/markets?limit=300&offset=0&includeClosed=1', {
                    cache: 'no-store',
                });
                if (!response.ok) return;

                const payload = await response.json();
                const events = Array.isArray(payload?.markets) ? payload.markets : [];
                if (events.length === 0) return;

                const map = new Map<string, MarketOption>();
                for (const event of events) {
                    const markets = Array.isArray(event?.markets) ? event.markets : [];
                    const eventTitle = String(event?.title || '').trim();
                    if (!eventTitle) continue;

                    for (const market of markets) {
                        const conditionId = String(market?.conditionId || '').trim();
                        const marketId = String(market?.id || '').trim();
                        const clobIds = parseTokenIdArray(market?.clobTokenIds);
                        const tokenId = clobIds[0] || conditionId || marketId;
                        if (!tokenId || map.has(tokenId)) continue;

                        map.set(tokenId, {
                            id: tokenId,
                            name: eventTitle,
                        });
                    }
                }

                if (!cancelled) {
                    setOptions(Array.from(map.values()));
                }
            } catch {
                // Keep manual mode only.
            }
        }

        void loadOptions();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        trackedIds.forEach((id) => {
            if (id in marketDetails) return;

            setLoadingIds((prev) => ({ ...prev, [id]: true }));
            void resolveMarketDetail(id)
                .then((detail) => {
                    setMarketDetails((prev) => ({ ...prev, [id]: detail }));
                })
                .finally(() => {
                    setLoadingIds((prev) => ({ ...prev, [id]: false }));
                });
        });
    }, [marketDetails, trackedIds]);

    const filteredOptions = useMemo(() => {
        const key = query.trim().toLowerCase();
        if (!key) return options.slice(0, 80);
        return options
            .filter((option) => option.name.toLowerCase().includes(key))
            .slice(0, 80);
    }, [options, query]);

    function addMarketId(rawId: string) {
        const id = rawId.trim();
        if (!id) return;
        setTrackedIds((prev) => (prev.includes(id) ? prev : [id, ...prev]));
        setQuery('');
    }

    function removeMarketId(id: string) {
        setTrackedIds((prev) => prev.filter((item) => item !== id));
    }

    return (
        <div className="mx-auto w-full max-w-screen-2xl px-6 py-5 space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Market Research Studio</h1>
                    <p className="text-sm text-gray-500 mt-1">Build your own study list and inspect each market's details before running analysis.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/polymarket/analytics" className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-100 rounded-xl border border-gray-200">
                        Back to Analytics
                    </Link>
                </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Search Markets (Active + Past)</p>
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search by activity name"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                    />
                    <div className="max-h-56 overflow-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                        {filteredOptions.length === 0 ? (
                            <p className="px-3 py-2 text-xs text-gray-500">No matching markets</p>
                        ) : (
                            filteredOptions.map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => addMarketId(option.id)}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                    title={option.name}
                                >
                                    {option.name}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-900 uppercase tracking-wide">Tracked Research Markets ({trackedIds.length})</p>
                </div>

                {trackedIds.length === 0 ? (
                    <div className="p-6 text-sm text-gray-500">No markets tracked yet. Add one above to start research.</div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {trackedIds.map((id) => {
                            const detail = marketDetails[id];
                            const loading = loadingIds[id];

                            return (
                                <div key={id} className="p-4 space-y-2">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-gray-900 truncate">{detail?.name || detail?.question || 'Loading market...'}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Link
                                                href={`/polymarket/analytics/market/${encodeURIComponent(id)}`}
                                                className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-black"
                                            >
                                                Analyze This Market
                                            </Link>
                                            <button
                                                onClick={() => removeMarketId(id)}
                                                className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>

                                    {loading ? (
                                        <p className="text-xs text-gray-500">Loading market detail...</p>
                                    ) : detail ? (
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-2">
                                                <p className="text-gray-500">YES</p>
                                                <p className="font-semibold text-gray-900">{detail.yesPrice != null ? `${Math.round(detail.yesPrice * 100)}%` : 'N/A'}</p>
                                            </div>
                                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-2">
                                                <p className="text-gray-500">NO</p>
                                                <p className="font-semibold text-gray-900">{detail.noPrice != null ? `${Math.round(detail.noPrice * 100)}%` : 'N/A'}</p>
                                            </div>
                                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-2">
                                                <p className="text-gray-500">Category</p>
                                                <p className="font-semibold text-gray-900">{detail.category}</p>
                                            </div>
                                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-2">
                                                <p className="text-gray-500">Volume</p>
                                                <p className="font-semibold text-gray-900">{formatVolume(detail.volume)}</p>
                                            </div>
                                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 md:col-span-2">
                                                <p className="text-gray-500">Liquidity</p>
                                                <p className="font-semibold text-gray-900">{formatVolume(detail.liquidity)}</p>
                                            </div>
                                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 md:col-span-2">
                                                <p className="text-gray-500">End Date</p>
                                                <p className="font-semibold text-gray-900">{detail.endDate || 'N/A'}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-red-600">Market detail not found in current Polymarket feeds.</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
