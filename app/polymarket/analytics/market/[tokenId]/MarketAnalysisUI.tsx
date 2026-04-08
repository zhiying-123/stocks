'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type TimeRange = '1W' | '1M' | '3M' | 'ALL';

type HistoryPoint = {
    t?: number | string;
    p?: number | string;
    time?: number | string;
    price?: number | string;
    timestamp?: number | string;
};

type AnalysisPayload = {
    marketInfo?: {
        question?: string;
        name?: string;
        category?: string;
        endDate?: string;
        yesPrice?: number | null;
        noPrice?: number | null;
        volume?: number;
        liquidity?: number;
    };
    priceHistory?: HistoryPoint[];
};

type TickPoint = {
    y: number;
    label: string;
};

type DateTick = {
    x: number;
    label: string;
};

function formatMoney(value: number | undefined) {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0) return '$0';
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
}

function normalizePoint(item: HistoryPoint) {
    const tRaw = item.t ?? item.timestamp ?? item.time;
    const pRaw = item.p ?? item.price;

    const tNum = typeof tRaw === 'string' ? Number.parseFloat(tRaw) : Number(tRaw);
    const pNum = typeof pRaw === 'string' ? Number.parseFloat(pRaw) : Number(pRaw);

    if (!Number.isFinite(tNum) || !Number.isFinite(pNum)) return null;

    const ms = tNum < 1e12 ? tNum * 1000 : tNum;
    const time = new Date(ms);
    if (Number.isNaN(time.getTime())) return null;

    return { time, price: pNum };
}

export default function MarketAnalysisUI({ tokenId }: { tokenId: string }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
    const [payload, setPayload] = useState<AnalysisPayload | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError('');
            try {
                const res = await fetch(`/api/polymarket/market-details?tokenId=${encodeURIComponent(tokenId)}`, {
                    cache: 'no-store',
                });
                if (!res.ok) {
                    throw new Error('Failed to load market analysis data');
                }
                const data = (await res.json()) as AnalysisPayload;
                if (!cancelled) {
                    setPayload(data);
                }
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : 'Failed to load market analysis data');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void load();
        return () => {
            cancelled = true;
        };
    }, [tokenId]);

    const normalizedHistory = useMemo(() => {
        const raw = Array.isArray(payload?.priceHistory) ? payload?.priceHistory : [];
        const points = raw
            .map((item) => normalizePoint(item))
            .filter((item): item is { time: Date; price: number } => item !== null)
            .sort((a, b) => a.time.getTime() - b.time.getTime());

        return points;
    }, [payload?.priceHistory]);

    const filteredHistory = useMemo(() => {
        if (normalizedHistory.length === 0) return [];
        if (timeRange === 'ALL') return normalizedHistory;

        const now = Date.now();
        const lookbackMs =
            timeRange === '1W' ? 7 * 24 * 60 * 60 * 1000 :
            timeRange === '1M' ? 30 * 24 * 60 * 60 * 1000 :
            90 * 24 * 60 * 60 * 1000;

        const cutoff = now - lookbackMs;
        const sliced = normalizedHistory.filter((item) => item.time.getTime() >= cutoff);
        return sliced.length > 0 ? sliced : normalizedHistory;
    }, [normalizedHistory, timeRange]);

    const stats = useMemo(() => {
        if (filteredHistory.length === 0) {
            return {
                first: null,
                last: null,
                low: null,
                high: null,
                changePct: null,
            };
        }

        const prices = filteredHistory.map((item) => item.price);
        const first = prices[0];
        const last = prices[prices.length - 1];
        const low = Math.min(...prices);
        const high = Math.max(...prices);
        const changePct = first > 0 ? ((last - first) / first) * 100 : 0;

        return { first, last, low, high, changePct };
    }, [filteredHistory]);

    const chartGeometry = useMemo(() => {
        if (filteredHistory.length < 2) {
            return {
                chartPath: '',
                yTicks: [] as TickPoint[],
                xTicks: [] as DateTick[],
                min: 0,
                max: 1,
            };
        }

        const width = 900;
        const height = 260;
        const padX = 10;
        const padY = 12;

        const prices = filteredHistory.map((item) => item.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const range = max - min || 1;

        const parts = filteredHistory.map((item, idx) => {
            const x = padX + (idx / Math.max(1, filteredHistory.length - 1)) * (width - padX * 2);
            const y = height - padY - ((item.price - min) / range) * (height - padY * 2);
            return `${idx === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
        });

        const chartPath = parts.join(' ');

        const yTickValues = [0, 0.25, 0.5, 0.75, 1].map((ratio) => min + (max - min) * ratio);
        const yTicks = yTickValues.map((value) => {
            const y = height - padY - ((value - min) / range) * (height - padY * 2);
            return {
                y,
                label: `${(value * 100).toFixed(2)}%`,
            };
        });

        const xTicks: DateTick[] = [];
        const tickCount = Math.min(6, filteredHistory.length);
        for (let i = 0; i < tickCount; i++) {
            const idx = Math.floor((i / Math.max(1, tickCount - 1)) * (filteredHistory.length - 1));
            const x = padX + (idx / Math.max(1, filteredHistory.length - 1)) * (width - padX * 2);
            const d = filteredHistory[idx].time;
            const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            xTicks.push({ x, label });
        }

        return {
            chartPath,
            yTicks,
            xTicks,
            min,
            max,
        };
    }, [filteredHistory]);

    const historyRows = useMemo(() => {
        const rows: Array<{ at: string; pricePct: string; deltaPct: string }> = [];
        const recent = filteredHistory.slice(-80).reverse();
        for (let i = 0; i < recent.length; i++) {
            const point = recent[i];
            const prev = recent[i + 1];
            const delta = prev ? point.price - prev.price : 0;
            rows.push({
                at: point.time.toLocaleString('en-GB', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                }),
                pricePct: `${(point.price * 100).toFixed(4)}%`,
                deltaPct: `${delta > 0 ? '+' : ''}${(delta * 100).toFixed(4)}%`,
            });
        }
        return rows;
    }, [filteredHistory]);

    const marketName = payload?.marketInfo?.name || payload?.marketInfo?.question || tokenId;
    const endedAt = payload?.marketInfo?.endDate || '';
    const isPast = endedAt ? new Date(endedAt).getTime() < Date.now() : false;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-6xl px-5 py-6 space-y-6">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Market Analysis</h1>
                        <p className="text-sm text-gray-600 mt-1">{marketName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href="/polymarket/analytics/research" className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-100">
                            Back to Research
                        </Link>
                    </div>
                </div>

                {isPast && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        This market is a past/closed event. Analysis below uses historical data.
                    </div>
                )}

                {loading ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading analysis...</div>
                ) : error ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="rounded-xl border border-gray-200 bg-white p-3">
                                <p className="text-xs text-gray-500">YES</p>
                                <p className="text-lg font-semibold text-gray-900">{payload?.marketInfo?.yesPrice != null ? `${Math.round(payload.marketInfo.yesPrice * 100)}%` : 'N/A'}</p>
                            </div>
                            <div className="rounded-xl border border-gray-200 bg-white p-3">
                                <p className="text-xs text-gray-500">NO</p>
                                <p className="text-lg font-semibold text-gray-900">{payload?.marketInfo?.noPrice != null ? `${Math.round(payload.marketInfo.noPrice * 100)}%` : 'N/A'}</p>
                            </div>
                            <div className="rounded-xl border border-gray-200 bg-white p-3">
                                <p className="text-xs text-gray-500">Volume</p>
                                <p className="text-lg font-semibold text-gray-900">{formatMoney(payload?.marketInfo?.volume)}</p>
                            </div>
                            <div className="rounded-xl border border-gray-200 bg-white p-3">
                                <p className="text-xs text-gray-500">Liquidity</p>
                                <p className="text-lg font-semibold text-gray-900">{formatMoney(payload?.marketInfo?.liquidity)}</p>
                            </div>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-gray-900">Historical Price Analysis</p>
                                <div className="flex items-center gap-2">
                                    {(['1W', '1M', '3M', 'ALL'] as TimeRange[]).map((item) => (
                                        <button
                                            key={item}
                                            onClick={() => setTimeRange(item)}
                                            className={`px-3 py-1.5 rounded-md text-xs font-semibold border ${timeRange === item ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                                        >
                                            {item}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {filteredHistory.length < 2 ? (
                                <p className="text-sm text-gray-500">Not enough price points for chart analysis.</p>
                            ) : (
                                <div className="space-y-3">
                                    <div className="w-full overflow-x-auto">
                                        <svg viewBox="0 0 900 260" className="w-full min-w-180 h-70" role="img" aria-label="Price history chart">
                                            <rect x="0" y="0" width="900" height="260" fill="#f8fafc" rx="10" />

                                            {chartGeometry.yTicks.map((tick, idx) => (
                                                <g key={`y-${idx}`}>
                                                    <line x1="10" y1={tick.y} x2="890" y2={tick.y} stroke="#e5e7eb" strokeWidth="1" />
                                                    <text x="880" y={tick.y - 4} textAnchor="end" fontSize="11" fill="#64748b">{tick.label}</text>
                                                </g>
                                            ))}

                                            <path d={chartGeometry.chartPath} fill="none" stroke="#0f172a" strokeWidth="2" />

                                            {chartGeometry.xTicks.map((tick, idx) => (
                                                <text key={`x-${idx}`} x={tick.x} y="252" textAnchor="middle" fontSize="11" fill="#64748b">{tick.label}</text>
                                            ))}
                                        </svg>
                                    </div>

                                    <p className="text-xs text-gray-500">Price is shown as implied probability (%). X-axis shows calendar date, Y-axis shows price percentage.</p>

                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-2">
                                            <p className="text-gray-500">Data Points</p>
                                            <p className="font-semibold text-gray-900">{filteredHistory.length}</p>
                                        </div>
                                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-2">
                                            <p className="text-gray-500">First</p>
                                            <p className="font-semibold text-gray-900">{stats.first != null ? `${(stats.first * 100).toFixed(2)}%` : 'N/A'}</p>
                                        </div>
                                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-2">
                                            <p className="text-gray-500">Last</p>
                                            <p className="font-semibold text-gray-900">{stats.last != null ? `${(stats.last * 100).toFixed(2)}%` : 'N/A'}</p>
                                        </div>
                                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-2">
                                            <p className="text-gray-500">Range</p>
                                            <p className="font-semibold text-gray-900">{stats.low != null && stats.high != null ? `${(stats.low * 100).toFixed(2)}% - ${(stats.high * 100).toFixed(2)}%` : 'N/A'}</p>
                                        </div>
                                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-2">
                                            <p className="text-gray-500">Change</p>
                                            <p className={`font-semibold ${stats.changePct != null && stats.changePct >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                                {stats.changePct != null ? `${stats.changePct >= 0 ? '+' : ''}${stats.changePct.toFixed(2)}%` : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-gray-900">Price History (Latest 80 Points)</p>
                                <p className="text-xs text-gray-500">{filteredHistory.length} points in selected range</p>
                            </div>

                            {historyRows.length === 0 ? (
                                <p className="text-sm text-gray-500">No history records available.</p>
                            ) : (
                                <div className="max-h-80 overflow-auto rounded-lg border border-gray-200">
                                    <table className="min-w-full text-xs">
                                        <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="text-left px-3 py-2 font-semibold text-gray-700">Datetime</th>
                                                <th className="text-left px-3 py-2 font-semibold text-gray-700">Price</th>
                                                <th className="text-left px-3 py-2 font-semibold text-gray-700">Change vs Prev</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {historyRows.map((row, idx) => (
                                                <tr key={`${row.at}-${idx}`} className="border-b border-gray-100 last:border-b-0">
                                                    <td className="px-3 py-2 text-gray-700">{row.at}</td>
                                                    <td className="px-3 py-2 font-semibold text-gray-900">{row.pricePct}</td>
                                                    <td className={`px-3 py-2 font-semibold ${row.deltaPct.startsWith('+') ? 'text-emerald-700' : row.deltaPct.startsWith('-') ? 'text-red-700' : 'text-gray-700'}`}>
                                                        {row.deltaPct}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
