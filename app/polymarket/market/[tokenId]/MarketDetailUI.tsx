'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SocialPanel from './SocialPanel';
import CustomSelect from '@/app/components/CustomSelect';

type TimeRange = '1D' | '1W' | '1M' | 'ALL';

interface NormalizedPoint {
    time: Date;
    price: number;
    volume?: number;
}

interface MarketInfo {
    id: string;
    question: string;
    description?: string;
    category?: string;
    image?: string;
    volume?: number;
    yesPrice?: number;
    noPrice?: number;
    conditionId?: string;
}

interface MarketDetailUIProps {
    marketInfo: MarketInfo;
    tokenId: string;
    currency: string;
    isInWatchlist: boolean;
    userId?: number | null;
    userName?: string | null;
}

type AlertItem = {
    alert_id: number;
    outcome: 'YES' | 'NO';
    direction: 'ABOVE' | 'BELOW';
    notify_channels_list?: Array<'EMAIL' | 'DISCORD'>;
    target_price: number;
    target_price_percent: number;
    source: string;
    is_active: boolean;
};

type NotifyMode = 'BOTH' | 'EMAIL' | 'DISCORD';

function modeToChannels(mode: NotifyMode): Array<'EMAIL' | 'DISCORD'> {
    if (mode === 'EMAIL') return ['EMAIL'];
    if (mode === 'DISCORD') return ['DISCORD'];
    return ['EMAIL', 'DISCORD'];
}

export default function MarketDetailUI({ marketInfo, tokenId, currency, isInWatchlist: initialIsInWatchlist, userId, userName }: MarketDetailUIProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const outcomeParam = searchParams?.get('outcome');
    const qtyParam = searchParams?.get('qty');
    const initialQuantity = qtyParam && !isNaN(parseFloat(qtyParam)) && parseFloat(qtyParam) > 0 ? qtyParam : '10';

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rawHistory, setRawHistory] = useState<any[]>([]);
    const [timeRange, setTimeRange] = useState<TimeRange>('1W');
    const [isInWatchlist, setIsInWatchlist] = useState(initialIsInWatchlist);
    const [togglingWatchlist, setTogglingWatchlist] = useState(false);

    // Trade form state
    const [selectedOutcome, setSelectedOutcome] = useState<'YES' | 'NO'>(
        outcomeParam === 'NO' ? 'NO' : 'YES'
    );
    const [quantity, setQuantity] = useState(initialQuantity);
    const [processing, setProcessing] = useState(false);
    const [tradeError, setTradeError] = useState('');
    const [tradeSuccess, setTradeSuccess] = useState('');
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [alerts, setAlerts] = useState<AlertItem[]>([]);
    const [alertsLoading, setAlertsLoading] = useState(false);
    const [alertOutcome, setAlertOutcome] = useState<'YES' | 'NO'>(outcomeParam === 'NO' ? 'NO' : 'YES');
    const [alertDirection, setAlertDirection] = useState<'ABOVE' | 'BELOW'>('ABOVE');
    const [alertNotifyMode, setAlertNotifyMode] = useState<NotifyMode>('BOTH');
    const [alertTarget, setAlertTarget] = useState('');
    const [alertSubmitting, setAlertSubmitting] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const [alertError, setAlertError] = useState('');

    // Fetch price history
    useEffect(() => {
        if (!tokenId) return;
        let cancelled = false;

        async function loadHistory() {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/polymarket/market-details?tokenId=${encodeURIComponent(tokenId)}`, {
                    cache: 'no-store',
                });
                if (!res.ok) {
                    throw new Error('Failed to load market details');
                }
                const data = await res.json();
                console.log('[MarketDetail] API response:', JSON.stringify(data).slice(0, 500));
                console.log('[MarketDetail] priceHistory length:', Array.isArray(data.priceHistory) ? data.priceHistory.length : 'not array');
                if (data.priceHistory?.[0]) console.log('[MarketDetail] first item:', JSON.stringify(data.priceHistory[0]));
                if (!cancelled) {
                    setRawHistory(Array.isArray(data.priceHistory) ? data.priceHistory : []);
                }
            } catch (e) {
                console.error(e);
                if (!cancelled) {
                    setError('Failed to load price history');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadHistory();

        return () => {
            cancelled = true;
        };
    }, [tokenId]);

    // Normalize raw history from API into uniform structure
    const normalizedHistory: NormalizedPoint[] = useMemo(() => {
        if (!rawHistory || !Array.isArray(rawHistory)) return [];

        const points: NormalizedPoint[] = [];

        for (const item of rawHistory) {
            try {
                const tRaw = (item as any).t ?? (item as any).timestamp ?? (item as any).time ?? (Array.isArray(item) ? item[0] : undefined);
                const pRaw = (item as any).p ?? (item as any).price ?? (Array.isArray(item) ? item[1] : undefined);
                const vRaw = (item as any).size ?? (item as any).volume ?? (item as any).q ?? (Array.isArray(item) ? item[2] : undefined);

                // CLOB API returns t as Unix seconds, convert to ms
                const tNum = typeof tRaw === 'string' ? parseFloat(tRaw) : Number(tRaw);
                const time = new Date(tNum < 1e12 ? tNum * 1000 : tNum);
                const price = typeof pRaw === 'string' ? parseFloat(pRaw) : Number(pRaw);
                const volume = vRaw != null ? Number(vRaw) : undefined;

                if (!time || isNaN(time.getTime()) || isNaN(price)) continue;

                points.push({ time, price, volume: !isNaN(volume as number) ? volume : undefined });
            } catch {
                continue;
            }
        }

        points.sort((a, b) => a.time.getTime() - b.time.getTime());
        return points;
    }, [rawHistory]);

    // Filter by selected time range
    const filteredHistory = useMemo(() => {
        if (normalizedHistory.length === 0) return [];
        if (timeRange === 'ALL') return normalizedHistory;

        const now = Date.now();
        let diffMs = 0;
        if (timeRange === '1D') diffMs = 24 * 60 * 60 * 1000;
        if (timeRange === '1W') diffMs = 7 * 24 * 60 * 60 * 1000;
        if (timeRange === '1M') diffMs = 30 * 24 * 60 * 60 * 1000;

        const cutoff = now - diffMs;
        const sliced = normalizedHistory.filter(p => p.time.getTime() >= cutoff);
        return sliced.length > 0 ? sliced : normalizedHistory;
    }, [normalizedHistory, timeRange]);

    // Compute stats
    const { latestPrice, changePct, totalVolume, totalTrades } = useMemo(() => {
        if (filteredHistory.length === 0) {
            return {
                latestPrice: undefined,
                changePct: undefined,
                totalVolume: 0,
                totalTrades: 0,
            };
        }

        const first = filteredHistory[0];
        const last = filteredHistory[filteredHistory.length - 1];
        const latestPrice = last.price;
        const changePct = first.price ? ((latestPrice - first.price) / first.price) * 100 : undefined;
        const totalVolume = filteredHistory.reduce((sum, p) => sum + (p.volume || 0), 0);

        return {
            latestPrice,
            changePct,
            totalVolume,
            totalTrades: filteredHistory.length,
        };
    }, [filteredHistory]);

    // Build chart data with proper axes
    const chartData = useMemo(() => {
        if (filteredHistory.length === 0) return null;

        const prices = filteredHistory.map(p => p.price * 100); // Convert to %
        const rawMin = Math.min(...prices);
        const rawMax = Math.max(...prices);

        // Round to nice Y-axis ticks (multiples of 5% or 10%)
        const step = rawMax - rawMin > 30 ? 10 : 5;
        const yMin = Math.max(0, Math.floor(rawMin / step) * step);
        const yMax = Math.min(100, Math.ceil(rawMax / step) * step + step);
        const yTicks: number[] = [];
        for (let v = yMin; v <= yMax; v += step) yTicks.push(v);

        // Chart dimensions (inside padding)
        const W = 640;
        const H = 280;
        const padLeft = 0;
        const padRight = 50;
        const padTop = 10;
        const padBottom = 30;
        const chartW = W - padLeft - padRight;
        const chartH = H - padTop - padBottom;
        const yRange = yMax - yMin || 1;

        // Build SVG path
        const pathParts = filteredHistory.map((point, idx) => {
            const x = padLeft + (idx / Math.max(filteredHistory.length - 1, 1)) * chartW;
            const y = padTop + chartH - ((point.price * 100 - yMin) / yRange) * chartH;
            return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
        });
        const linePath = pathParts.join(' ');

        // Area fill path (line + close to bottom)
        const lastX = padLeft + chartW;
        const firstX = padLeft;
        const bottomY = padTop + chartH;
        const areaPath = linePath + ` L ${lastX.toFixed(1)} ${bottomY} L ${firstX} ${bottomY} Z`;

        // X-axis date labels
        const xLabels: { x: number; label: string }[] = [];
        const totalPoints = filteredHistory.length;
        const labelCount = Math.min(6, totalPoints);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        if (totalPoints > 1) {
            for (let i = 0; i < labelCount; i++) {
                const idx = Math.floor((i / (labelCount - 1)) * (totalPoints - 1));
                const point = filteredHistory[idx];
                const x = padLeft + (idx / Math.max(totalPoints - 1, 1)) * chartW;
                const d = point.time;
                let label: string;
                if (timeRange === '1D') {
                    label = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                } else {
                    label = `${months[d.getMonth()]} ${d.getDate()}`;
                }
                xLabels.push({ x, label });
            }
        }

        // Y-axis grid lines and labels
        const yLines = yTicks.map(v => ({
            y: padTop + chartH - ((v - yMin) / yRange) * chartH,
            label: `${v}%`,
        }));

        return { linePath, areaPath, xLabels, yLines, W, H, padLeft, padRight, padTop, padBottom, chartW, chartH, bottomY };
    }, [filteredHistory, timeRange]);

    // Format volume nicely
    const formatVol = (v?: number) => {
        if (!v) return '$0';
        if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
        if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
        return `$${v.toFixed(0)}`;
    };

    const yesPct = useMemo(() => {
        if (!marketInfo?.yesPrice) return undefined;
        return (marketInfo.yesPrice * 100).toFixed(0);
    }, [marketInfo]);

    useEffect(() => {
        const fallback = alertOutcome === 'YES' ? marketInfo.yesPrice : marketInfo.noPrice;
        if (!fallback) return;

        if (!alertTarget) {
            setAlertTarget((fallback * 100).toFixed(2));
        }
    }, [alertOutcome, marketInfo.noPrice, marketInfo.yesPrice, alertTarget]);

    async function loadAlerts() {
        setAlertsLoading(true);
        try {
            const res = await fetch(`/api/polymarket/alerts?marketId=${encodeURIComponent(tokenId)}`, {
                cache: 'no-store',
            });
            if (!res.ok) {
                throw new Error('Failed to fetch alerts');
            }
            const data = await res.json();
            setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
        } catch (err) {
            console.error('Failed to load alerts:', err);
        } finally {
            setAlertsLoading(false);
        }
    }

    useEffect(() => {
        loadAlerts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokenId]);

    // Toggle watchlist
    const toggleWatchlist = async () => {
        if (togglingWatchlist) return;

        setTogglingWatchlist(true);

        try {
            if (isInWatchlist) {
                // Remove from watchlist
                const res = await fetch(`/api/polymarket/watchlist?marketId=${encodeURIComponent(tokenId)}`, {
                    method: 'DELETE',
                });

                if (res.ok) {
                    setIsInWatchlist(false);
                    setAlertMessage('');
                }
            } else {
                // Add to watchlist
                const res = await fetch('/api/polymarket/watchlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ marketId: tokenId }),
                });

                if (res.ok) {
                    setIsInWatchlist(true);
                    setAlertError('');
                }
            }
        } catch (error) {
            console.error('Failed to toggle watchlist:', error);
        } finally {
            setTogglingWatchlist(false);
        }
    };

    async function createAlert() {
        setAlertSubmitting(true);
        setAlertError('');
        setAlertMessage('');

        try {
            const res = await fetch('/api/polymarket/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    marketId: tokenId,
                    outcome: alertOutcome,
                    direction: alertDirection,
                    notifyChannels: modeToChannels(alertNotifyMode),
                    targetPrice: Number(alertTarget),
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                setAlertError(data.error || 'Failed to create alert');
                return;
            }

            setAlertMessage('Alert created successfully');
            setAlertTarget('');
            await loadAlerts();
        } catch (err) {
            console.error('Failed to create alert:', err);
            setAlertError('Failed to create alert');
        } finally {
            setAlertSubmitting(false);
        }
    }

    async function deleteAlert(alertId: number) {
        try {
            const res = await fetch(`/api/polymarket/alerts?alertId=${alertId}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                setAlertError(data?.error || 'Failed to delete alert');
                return;
            }

            setAlerts((prev) => prev.filter((alert) => alert.alert_id !== alertId));
        } catch (err) {
            console.error('Failed to delete alert:', err);
            setAlertError('Failed to delete alert');
        }
    }

    function focusAlertTable() {
        const section = document.getElementById('price-alerts');
        section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Handle trade submission
    async function handleTrade() {
        const qty = parseFloat(quantity);
        if (!qty || qty <= 0) {
            setTradeError('Please enter a valid quantity');
            return;
        }

        setProcessing(true);
        setTradeError('');
        setTradeSuccess('');

        try {
            const pricePerShare = selectedOutcome === 'YES' ? marketInfo.yesPrice : marketInfo.noPrice;

            console.log('[Trade] Sending buy request:', {
                marketId: marketInfo.id,
                outcome: selectedOutcome,
                quantity: qty,
                pricePerShare,
            });

            if (pricePerShare == null || isNaN(pricePerShare)) {
                setTradeError('Price data not available. Please refresh the page.');
                setProcessing(false);
                return;
            }

            const res = await fetch('/api/polymarket/buy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    marketId: marketInfo.id,
                    outcome: selectedOutcome,
                    quantity: qty,
                    pricePerShare: pricePerShare,
                    category: marketInfo.category,
                }),
            });

            const data = await res.json();
            console.log('[Trade] Response:', res.status, data);

            if (res.ok) {
                setTradeSuccess(`Successfully bought ${qty} ${selectedOutcome} shares!`);
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                setTradeError(data.error || `Transaction failed (${res.status})`);
            }
        } catch (err) {
            console.error('[Trade] Error:', err);
            setTradeError('Network error. Please try again.');
        } finally {
            setProcessing(false);
        }
    }

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                <button
                    onClick={() => router.push('/polymarket')}
                    className="mb-6 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    Back to Polymarket
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Side: Market Details & Chart */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Market Header */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                            <div className="flex items-start gap-4 mb-4">
                                {marketInfo.image && (
                                    <img
                                        src={marketInfo.image}
                                        alt=""
                                        className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                                        onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                                    />
                                )}
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        {marketInfo.category && (
                                            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full border border-blue-200">
                                                {marketInfo.category}
                                            </span>
                                        )}
                                        {typeof marketInfo.volume === 'number' && (
                                            <span className="px-2.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full border border-purple-200">
                                                Volume ${marketInfo.volume.toFixed(0)}
                                            </span>
                                        )}
                                    </div>
                                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                                        {marketInfo.question}
                                    </h1>
                                    {marketInfo.description && (
                                        <p className="text-sm text-gray-600 leading-relaxed">
                                            {marketInfo.description}
                                        </p>
                                    )}
                                </div>
                                {yesPct && (
                                    <div className="text-right">
                                        <div className="text-xs text-gray-500 mb-1">YES Probability</div>
                                        <div className="text-3xl font-bold text-gray-900">{yesPct}%</div>
                                    </div>
                                )}
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Volume</div>
                                    <div className="font-semibold text-gray-900">
                                        {formatVol(marketInfo.volume)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Trades</div>
                                    <div className="font-semibold text-gray-900">{totalTrades}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Volume (chart period)</div>
                                    <div className="font-semibold text-gray-900">
                                        {totalVolume ? totalVolume.toFixed(2) : '-'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Liquidity</div>
                                    <div className="font-semibold text-gray-900">-</div>
                                </div>
                            </div>
                        </div>

                        {/* Chart Section — Polymarket Style */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                            {/* Chart Header: Probability + Change */}
                            <div className="flex items-start justify-between mb-1">
                                <div>
                                    <div className="text-sm font-medium text-blue-600 mb-1">Yes</div>
                                    <div className="flex items-baseline gap-3">
                                        <span className="text-3xl font-bold text-gray-900">
                                            {latestPrice != null ? `${(latestPrice * 100).toFixed(0)}% chance` : '-'}
                                        </span>
                                        {changePct != null && !isNaN(changePct) && (
                                            <span className={`text-sm font-semibold ${changePct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {changePct >= 0 ? '▲' : '▼'} {Math.abs(changePct).toFixed(0)}%
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {/* Time range selector */}
                                <div className="flex gap-1">
                                    {(['1D', '1W', '1M', 'ALL'] as TimeRange[]).map((range) => {
                                        const selected = timeRange === range;
                                        return (
                                            <button
                                                key={range}
                                                onClick={() => setTimeRange(range)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selected
                                                    ? 'bg-gray-900 text-white'
                                                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                                                    }`}
                                            >
                                                {range}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* SVG Chart with axes */}
                            <div className="w-full mt-4">
                                {chartData ? (
                                    <svg
                                        viewBox={`0 0 ${chartData.W} ${chartData.H}`}
                                        className="w-full"
                                        style={{ height: 280 }}
                                        preserveAspectRatio="xMidYMid meet"
                                    >
                                        {/* Horizontal grid lines + Y-axis labels */}
                                        {chartData.yLines.map((line, i) => (
                                            <g key={i}>
                                                <line
                                                    x1={chartData.padLeft}
                                                    y1={line.y}
                                                    x2={chartData.W - chartData.padRight}
                                                    y2={line.y}
                                                    stroke="#E5E7EB"
                                                    strokeWidth="1"
                                                    strokeDasharray="4 4"
                                                />
                                                <text
                                                    x={chartData.W - chartData.padRight + 8}
                                                    y={line.y + 4}
                                                    fill="#9CA3AF"
                                                    fontSize="11"
                                                    fontFamily="system-ui, sans-serif"
                                                >
                                                    {line.label}
                                                </text>
                                            </g>
                                        ))}

                                        {/* Area fill under the line */}
                                        <path
                                            d={chartData.areaPath}
                                            fill="url(#areaGrad)"
                                            opacity="0.15"
                                        />

                                        {/* Gradient definitions */}
                                        <defs>
                                            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#374151" stopOpacity="0.3" />
                                                <stop offset="100%" stopColor="#374151" stopOpacity="0" />
                                            </linearGradient>
                                        </defs>

                                        {/* Price line - clean and simple */}
                                        <path
                                            d={chartData.linePath}
                                            fill="none"
                                            stroke="#374151"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />

                                        {/* Current price dot - simple style */}
                                        {filteredHistory.length > 0 && (() => {
                                            const last = filteredHistory[filteredHistory.length - 1];
                                            const prices = filteredHistory.map(p => p.price * 100);
                                            const rawMin = Math.min(...prices);
                                            const rawMax = Math.max(...prices);
                                            const step = rawMax - rawMin > 30 ? 10 : 5;
                                            const yMin = Math.max(0, Math.floor(rawMin / step) * step);
                                            const yMax = Math.min(100, Math.ceil(rawMax / step) * step + step);
                                            const yRange = yMax - yMin || 1;
                                            const x = chartData.padLeft + chartData.chartW;
                                            const y = chartData.padTop + chartData.chartH - ((last.price * 100 - yMin) / yRange) * chartData.chartH;
                                            return (
                                                <g>
                                                    <circle cx={x} cy={y} r="4" fill="#374151" />
                                                    <circle cx={x} cy={y} r="2" fill="white" />
                                                </g>
                                            );
                                        })()}

                                        {/* X-axis date labels */}
                                        {chartData.xLabels.map((label, i) => (
                                            <text
                                                key={i}
                                                x={label.x}
                                                y={chartData.H - 5}
                                                fill="#9CA3AF"
                                                fontSize="11"
                                                fontFamily="system-ui, sans-serif"
                                                textAnchor="middle"
                                            >
                                                {label.label}
                                            </text>
                                        ))}
                                    </svg>
                                ) : (
                                    <div className="h-64 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 text-sm">
                                        {loading ? 'Loading chart data...' : 'No chart data available'}
                                    </div>
                                )}
                            </div>

                            {/* Bottom: Volume + End Date */}
                            <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                                <span className="font-medium text-gray-700">{formatVol(marketInfo.volume)} Volume</span>
                                <span>·</span>
                                <span>{totalTrades} data points</span>
                            </div>

                            {loading && !chartData && (
                                <div className="mt-3 text-xs text-gray-500">Loading chart data...</div>
                            )}
                            {error && (
                                <div className="mt-3 text-xs text-red-500">{error}</div>
                            )}
                        </div>

                        <SocialPanel
                            marketId={tokenId}
                            question={marketInfo.question}
                            currentUserId={userId ?? undefined}
                            currentUserName={userName ?? undefined}
                        />
                    </div>

                    {/* Right Side: Trade Panel */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm sticky top-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-gray-900">Trade</h2>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={focusAlertTable}
                                        className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-all"
                                        title="Set alert"
                                    >
                                        <svg className="w-5 h-5 text-gray-400 hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={toggleWatchlist}
                                        disabled={togglingWatchlist}
                                        className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-all"
                                        title={isInWatchlist ? "Remove from favorites" : "Add to favorites"}
                                    >
                                        <svg
                                            className={`w-5 h-5 transition-all ${isInWatchlist
                                                ? 'text-yellow-500 fill-yellow-500'
                                                : 'text-gray-300 hover:text-yellow-500'
                                                } ${togglingWatchlist ? 'opacity-50' : ''}`}
                                            fill={isInWatchlist ? "currentColor" : "none"}
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                            />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Outcome Selection */}
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                {['YES', 'NO'].map((outcome) => {
                                    const price = outcome === 'YES' ? marketInfo.yesPrice : marketInfo.noPrice;
                                    const isSelected = selectedOutcome === outcome;

                                    return (
                                        <button
                                            key={outcome}
                                            onClick={() => setSelectedOutcome(outcome as 'YES' | 'NO')}
                                            className={`p-4 rounded-xl border-2 transition-all ${isSelected
                                                ? 'border-gray-900 bg-gray-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <div className="text-xl font-bold text-gray-900">
                                                {outcome}
                                            </div>
                                            <div className="text-sm text-gray-500 mt-1">
                                                {price ? `${(price * 100).toFixed(0)}¢` : '-'} / share
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Quantity */}
                            <div className="mb-6">
                                <label className="text-sm font-medium text-gray-700 mb-3 block">
                                    Shares
                                </label>
                                <div className="flex gap-2 flex-wrap mb-2">
                                    {['5', '10', '25', '50', '100'].map((amt) => (
                                        <button
                                            key={amt}
                                            onClick={() => setQuantity(amt)}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${quantity === amt
                                                ? 'bg-gray-900 text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                        >
                                            {amt}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="number"
                                    min="1"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    placeholder="Enter quantity"
                                />
                            </div>

                            {/* Cost Summary */}
                            <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-600">Price per share</span>
                                    <span className="font-medium text-gray-900">
                                        {((selectedOutcome === 'YES' ? marketInfo.yesPrice : marketInfo.noPrice) || 0.5) * 100}¢
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-600">Shares</span>
                                    <span className="font-medium text-gray-900">{quantity || 0}</span>
                                </div>
                                <div className="border-t border-gray-200 pt-3 mt-3">
                                    <div className="flex justify-between mb-2">
                                        <span className="font-bold text-gray-900">Total Cost</span>
                                        <span className="font-bold text-gray-900">
                                            ${(((selectedOutcome === 'YES' ? marketInfo.yesPrice : marketInfo.noPrice) || 0.5) * (parseFloat(quantity) || 0)).toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-xs text-gray-500">If {selectedOutcome} wins:</span>
                                        <span className="text-xs font-semibold text-green-600">
                                            +${((1 - ((selectedOutcome === 'YES' ? marketInfo.yesPrice : marketInfo.noPrice) || 0.5)) * (parseFloat(quantity) || 0)).toFixed(2)} profit
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Error */}
                            {tradeError && (
                                <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm border border-red-100">
                                    {tradeError}
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                onClick={() => {
                                    const qty = parseFloat(quantity);
                                    if (!qty || qty <= 0) {
                                        setTradeError('Please enter a valid quantity');
                                        return;
                                    }
                                    setTradeError('');
                                    setShowConfirmModal(true);
                                }}
                                disabled={processing}
                                className="w-full py-3 bg-gray-900 hover:bg-black text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {processing ? 'Processing...' : `Buy ${selectedOutcome}`}
                            </button>

                            <div id="price-alerts" className="mt-6 pt-5 border-t border-gray-200 scroll-mt-24">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold text-gray-900">Price Alerts</h3>
                                </div>

                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-2 space-y-2.5">
                                    <div className="grid grid-cols-2 gap-2">
                                        <label className="block">
                                            <span className="block text-[11px] font-semibold text-gray-600 mb-1">Outcome</span>
                                            <CustomSelect
                                                value={alertOutcome}
                                                onChange={(nextValue) => setAlertOutcome(nextValue)}
                                                disabled={alertSubmitting}
                                                options={[
                                                    { value: 'YES', label: 'YES' },
                                                    { value: 'NO', label: 'NO' },
                                                ]}
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="block text-[11px] font-semibold text-gray-600 mb-1">Direction</span>
                                            <CustomSelect
                                                value={alertDirection}
                                                onChange={(nextValue) => setAlertDirection(nextValue)}
                                                disabled={alertSubmitting}
                                                options={[
                                                    { value: 'ABOVE', label: 'ABOVE' },
                                                    { value: 'BELOW', label: 'BELOW' },
                                                ]}
                                            />
                                        </label>
                                    </div>
                                    <label className="block">
                                        <span className="block text-[11px] font-semibold text-gray-600 mb-1">Notify Via</span>
                                        <CustomSelect
                                            value={alertNotifyMode}
                                            onChange={(nextValue) => setAlertNotifyMode(nextValue as NotifyMode)}
                                            disabled={alertSubmitting}
                                            options={[
                                                { value: 'BOTH', label: 'Email + Discord' },
                                                { value: 'EMAIL', label: 'Email Only' },
                                                { value: 'DISCORD', label: 'Discord Only' },
                                            ]}
                                        />
                                    </label>
                                    <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                                        <label className="block">
                                            <span className="block text-[11px] font-semibold text-gray-600 mb-1">Target Price (%)</span>
                                            <input
                                                type="number"
                                                min="0.01"
                                                max="99.99"
                                                step="0.01"
                                                inputMode="decimal"
                                                value={alertTarget}
                                                onChange={(e) => setAlertTarget(e.target.value)}
                                                disabled={alertSubmitting}
                                                placeholder="e.g. 57.25"
                                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-semibold text-gray-800 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-100"
                                            />
                                        </label>
                                        <button
                                            onClick={createAlert}
                                            disabled={alertSubmitting}
                                            className="h-10.5 px-4 bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded-lg disabled:opacity-50"
                                        >
                                            {alertSubmitting ? 'Saving...' : 'Set Alert'}
                                        </button>
                                    </div>
                                </div>

                                {alertError && (
                                    <p className="text-xs text-red-600 mb-2">{alertError}</p>
                                )}
                                {alertMessage && (
                                    <p className="text-xs text-emerald-600 mb-2">{alertMessage}</p>
                                )}

                                <div className="overflow-auto border border-gray-200 rounded-xl max-h-52 bg-white shadow-xs">
                                    {alertsLoading ? (
                                        <p className="text-xs text-gray-500 px-3 py-3">Loading alerts...</p>
                                    ) : alerts.filter((alert) => alert.is_active).length === 0 ? (
                                        <p className="text-xs text-gray-500 px-3 py-3">No active alerts for this market.</p>
                                    ) : (
                                        <table className="min-w-full text-xs">
                                            <thead className="bg-gray-100 text-gray-700 sticky top-0 border-b border-gray-200">
                                                <tr>
                                                    <th className="text-left px-2.5 py-2 font-semibold">Outcome</th>
                                                    <th className="text-left px-2.5 py-2 font-semibold">Direction</th>
                                                    <th className="text-left px-2.5 py-2 font-semibold">Target</th>
                                                    <th className="text-right px-2.5 py-2 font-semibold">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {alerts
                                                    .filter((alert) => alert.is_active)
                                                    .map((alert) => (
                                                        <tr key={alert.alert_id} className="hover:bg-blue-50/40 transition-colors">
                                                            <td className="px-2.5 py-2 text-gray-800 font-semibold">{alert.outcome}</td>
                                                            <td className="px-2.5 py-2 text-gray-700">
                                                                <span className="px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-700">
                                                                    {alert.direction}
                                                                </span>
                                                            </td>
                                                            <td className="px-2.5 py-2 text-gray-800 font-medium">{alert.target_price_percent.toFixed(2)}%</td>
                                                            <td className="px-2.5 py-2 text-right">
                                                                <button
                                                                    onClick={() => deleteAlert(alert.alert_id)}
                                                                    className="px-2 py-1 rounded-md text-red-600 hover:text-red-700 hover:bg-red-50 font-medium transition-colors"
                                                                >
                                                                    Remove
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Success Modal */}
            {tradeSuccess && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-sm w-full p-8 text-center shadow-2xl">
                        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Purchase Successful!</h3>
                        <p className="text-sm text-gray-500">{tradeSuccess}</p>
                        <p className="text-xs text-gray-400 mt-4">Refreshing page...</p>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900">Confirm Order</h3>
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="mb-6">
                            <p className="text-sm text-gray-600 mb-4">Please review your order details:</p>

                            <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Market</span>
                                    <span className="font-medium text-gray-900 text-right max-w-50 truncate">
                                        {marketInfo.question}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Position</span>
                                    <span className={`font-bold ${selectedOutcome === 'YES' ? 'text-green-600' : 'text-red-600'}`}>
                                        {selectedOutcome}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Shares</span>
                                    <span className="font-medium text-gray-900">{quantity}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Price per share</span>
                                    <span className="font-medium text-gray-900">
                                        {((selectedOutcome === 'YES' ? marketInfo.yesPrice : marketInfo.noPrice) || 0.5) * 100}¢
                                    </span>
                                </div>
                                <div className="border-t border-gray-200 pt-3 mt-3">
                                    <div className="flex justify-between">
                                        <span className="font-bold text-gray-900">Total Cost</span>
                                        <span className="font-bold text-gray-900">
                                            ${(((selectedOutcome === 'YES' ? marketInfo.yesPrice : marketInfo.noPrice) || 0.5) * (parseFloat(quantity) || 0)).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <div className="flex gap-2">
                                    <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <p className="text-xs text-amber-700">
                                        By confirming, you agree to purchase these shares. This action cannot be undone. Make sure you have sufficient balance.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowConfirmModal(false);
                                    handleTrade();
                                }}
                                disabled={processing}
                                className="flex-1 py-3 bg-gray-900 hover:bg-black text-white font-bold rounded-xl transition-all disabled:opacity-50"
                            >
                                {processing ? 'Processing...' : 'Confirm Purchase'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
