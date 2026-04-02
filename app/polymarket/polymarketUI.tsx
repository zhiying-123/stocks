'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import CustomSelect from '@/app/components/CustomSelect';

interface Market {
    id: string;
    question: string;
    description?: string;
    end_date_iso?: string;
    image?: string;
    outcomes?: Array<{
        name: string;
        price: number;
    }>;
    volume?: number;
    liquidity?: number;
    category?: string;
    tags?: string[];
    conditionId?: string;
}

interface PolymarketUIProps {
    markets: Market[];
    currency: string;
    watchlist: string[];
}

type MarketAlert = {
    alert_id: number;
    outcome: 'YES' | 'NO';
    direction: 'ABOVE' | 'BELOW';
    notify_channels_list?: Array<'EMAIL' | 'DISCORD'>;
    target_price_percent: number;
    auto_buy_enabled?: boolean;
    auto_buy_quantity?: number | null;
    auto_buy_budget?: number | null;
    auto_buy_retry_max?: number;
    auto_buy_retry_count?: number;
    auto_buy_cooldown_m?: number;
    auto_buy_next_retry_at?: string | null;
    auto_buy_last_error?: string | null;
    tp_target_percent?: number | null;
    sl_target_percent?: number | null;
    is_active: boolean;
};

// Helper to format volume
function formatVolume(vol?: number): string {
    if (!vol) return '$0';
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}K`;
    return `$${vol.toFixed(0)}`;
}

export default function PolymarketUI({ markets, currency, watchlist: initialWatchlist }: PolymarketUIProps) {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [featuredIndex, setFeaturedIndex] = useState(0);
    const [watchlist, setWatchlist] = useState<string[]>(initialWatchlist);
    const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
    const [togglingWatchlist, setTogglingWatchlist] = useState<Set<string>>(new Set());
    const [showAlertModal, setShowAlertModal] = useState(false);
    const [alertMarket, setAlertMarket] = useState<Market | null>(null);
    const [alertRows, setAlertRows] = useState<MarketAlert[]>([]);
    const [alertsLoading, setAlertsLoading] = useState(false);
    const [alertOutcome, setAlertOutcome] = useState<'YES' | 'NO'>('YES');
    const [alertDirection, setAlertDirection] = useState<'ABOVE' | 'BELOW'>('ABOVE');
    const [alertNotifyChannels, setAlertNotifyChannels] = useState<Array<'EMAIL' | 'DISCORD'>>(['EMAIL', 'DISCORD']);
    const [alertTarget, setAlertTarget] = useState('');
    const [alertAutoBuyEnabled, setAlertAutoBuyEnabled] = useState(false);
    const [alertAutoBuyQuantity, setAlertAutoBuyQuantity] = useState('10');
    const [alertAutoBuyBudget, setAlertAutoBuyBudget] = useState('');
    const [alertAutoBuyRetryMax, setAlertAutoBuyRetryMax] = useState('3');
    const [alertAutoBuyCooldown, setAlertAutoBuyCooldown] = useState('5');
    const [alertTpTargetPercent, setAlertTpTargetPercent] = useState('');
    const [alertSlTargetPercent, setAlertSlTargetPercent] = useState('');
    const [alertError, setAlertError] = useState('');
    const [alertMessage, setAlertMessage] = useState('');
    const [alertSubmitting, setAlertSubmitting] = useState(false);
    const [alertCheckingNow, setAlertCheckingNow] = useState(false);

    // Sorting state
    const [sortBy, setSortBy] = useState('default');

    // Advanced filters state
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [probabilityRange, setProbabilityRange] = useState<[number, number]>([0, 100]);
    const [volumeMin, setVolumeMin] = useState<number>(0);
    const [endDateFilter, setEndDateFilter] = useState<'all' | '7days' | '30days' | '90days'>('all');

    // Ref for dropdown
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowAdvancedFilters(false);
            }
        }

        if (showAdvancedFilters) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [showAdvancedFilters]);

    // Toggle watchlist
    const toggleWatchlist = async (marketId: string, e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }

        // Prevent double-clicking
        if (togglingWatchlist.has(marketId)) return;

        setTogglingWatchlist(prev => new Set(prev).add(marketId));

        try {
            const isInWatchlist = watchlist.includes(marketId);

            if (isInWatchlist) {
                // Remove from watchlist
                const res = await fetch(`/api/polymarket/watchlist?marketId=${encodeURIComponent(marketId)}`, {
                    method: 'DELETE',
                });

                if (res.ok) {
                    setWatchlist(prev => prev.filter(id => id !== marketId));
                }
            } else {
                // Add to watchlist
                const res = await fetch('/api/polymarket/watchlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ marketId }),
                });

                if (res.ok) {
                    setWatchlist(prev => [...prev, marketId]);
                }
            }
        } catch (error) {
            console.error('Failed to toggle watchlist:', error);
        } finally {
            setTogglingWatchlist(prev => {
                const newSet = new Set(prev);
                newSet.delete(marketId);
                return newSet;
            });
        }
    };

    // Navigate to market detail page
    const goToMarket = (market: Market, outcome?: 'YES' | 'NO') => {
        if (!market.conditionId) return;
        const url = `/polymarket/market/${encodeURIComponent(market.conditionId)}${outcome ? `?outcome=${outcome}` : ''}`;
        router.push(url);
    };

    const loadAlertsForMarket = async (marketId: string) => {
        setAlertsLoading(true);
        try {
            const res = await fetch(`/api/polymarket/alerts?marketId=${encodeURIComponent(marketId)}`, {
                cache: 'no-store',
            });
            if (!res.ok) throw new Error('Failed to load alerts');
            const data = await res.json();
            setAlertRows(Array.isArray(data.alerts) ? data.alerts : []);
        } catch (error) {
            console.error('Failed to load market alerts:', error);
            setAlertError('Failed to load alerts');
            setAlertRows([]);
        } finally {
            setAlertsLoading(false);
        }
    };

    const openAlertModal = async (market: Market, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!market.conditionId) return;

        setAlertMarket(market);
        setShowAlertModal(true);
        setAlertError('');
        setAlertMessage('');
        setAlertOutcome('YES');
        setAlertDirection('ABOVE');
        setAlertNotifyChannels(['EMAIL', 'DISCORD']);
        setAlertAutoBuyEnabled(false);
        setAlertAutoBuyQuantity('10');
        setAlertAutoBuyBudget('');
        setAlertAutoBuyRetryMax('3');
        setAlertAutoBuyCooldown('5');
        setAlertTpTargetPercent('');
        setAlertSlTargetPercent('');
        const yesPrice = market.outcomes?.find((o) => o.name === 'YES')?.price;
        setAlertTarget(yesPrice ? (yesPrice * 100).toFixed(2) : '');
        await loadAlertsForMarket(market.conditionId);
    };

    const toggleAlertNotifyChannel = (channel: 'EMAIL' | 'DISCORD') => {
        setAlertNotifyChannels((prev) => {
            if (prev.includes(channel)) {
                return prev.filter((item) => item !== channel);
            }
            return [...prev, channel];
        });
    };

    const createAlertForMarket = async () => {
        if (!alertMarket?.conditionId) return;

        setAlertError('');
        setAlertMessage('');
        const targetValue = Number(alertTarget);

        if (!Number.isFinite(targetValue) || targetValue <= 0 || targetValue >= 100) {
            setAlertError('Target % must be between 0 and 100');
            return;
        }

        if (alertNotifyChannels.length === 0) {
            setAlertError('Please select at least one notification method');
            return;
        }

        if (alertAutoBuyEnabled) {
            const autoBuyQty = Number(alertAutoBuyQuantity);
            if (!Number.isFinite(autoBuyQty) || autoBuyQty <= 0) {
                setAlertError('Auto buy quantity must be a positive number');
                return;
            }

            const autoBuyBudget = alertAutoBuyBudget ? Number(alertAutoBuyBudget) : null;
            if (autoBuyBudget != null && (!Number.isFinite(autoBuyBudget) || autoBuyBudget <= 0)) {
                setAlertError('Auto buy budget must be a positive number');
                return;
            }

            const retryMax = Number(alertAutoBuyRetryMax || '0');
            if (!Number.isFinite(retryMax) || retryMax < 0 || retryMax > 20) {
                setAlertError('Retry max must be between 0 and 20');
                return;
            }

            const cooldown = Number(alertAutoBuyCooldown || '5');
            if (!Number.isFinite(cooldown) || cooldown < 1 || cooldown > 1440) {
                setAlertError('Cooldown must be between 1 and 1440 minutes');
                return;
            }

            const tpPercent = alertTpTargetPercent ? Number(alertTpTargetPercent) : null;
            const slPercent = alertSlTargetPercent ? Number(alertSlTargetPercent) : null;
            if (tpPercent != null && (!Number.isFinite(tpPercent) || tpPercent <= 0 || tpPercent >= 100)) {
                setAlertError('TP target must be between 0 and 100');
                return;
            }
            if (slPercent != null && (!Number.isFinite(slPercent) || slPercent <= 0 || slPercent >= 100)) {
                setAlertError('SL target must be between 0 and 100');
                return;
            }
        }

        setAlertSubmitting(true);
        try {
            const res = await fetch('/api/polymarket/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    marketId: alertMarket.conditionId,
                    outcome: alertOutcome,
                    direction: alertDirection,
                    notifyChannels: alertNotifyChannels,
                    targetPrice: targetValue,
                    autoBuyEnabled: alertAutoBuyEnabled,
                    autoBuyQuantity: alertAutoBuyEnabled ? Number(alertAutoBuyQuantity) : null,
                    autoBuyBudget: alertAutoBuyEnabled && alertAutoBuyBudget ? Number(alertAutoBuyBudget) : null,
                    autoBuyRetryMax: alertAutoBuyEnabled ? Number(alertAutoBuyRetryMax || 0) : 0,
                    autoBuyCooldownMinutes: alertAutoBuyEnabled ? Number(alertAutoBuyCooldown || 5) : 5,
                    tpTargetPercent: alertAutoBuyEnabled && alertTpTargetPercent ? Number(alertTpTargetPercent) : null,
                    slTargetPercent: alertAutoBuyEnabled && alertSlTargetPercent ? Number(alertSlTargetPercent) : null,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                setAlertError(data.error || 'Failed to create alert');
                return;
            }

            setAlertMessage('Alert created successfully');
            await loadAlertsForMarket(alertMarket.conditionId);
        } catch (error) {
            console.error('Failed to create market alert:', error);
            setAlertError('Failed to create alert');
        } finally {
            setAlertSubmitting(false);
        }
    };

    const deleteAlertForMarket = async (alertId: number) => {
        try {
            const res = await fetch(`/api/polymarket/alerts?alertId=${alertId}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                setAlertError(data?.error || 'Failed to delete alert');
                return;
            }

            setAlertRows((prev) => prev.filter((row) => row.alert_id !== alertId));
        } catch (error) {
            console.error('Failed to delete market alert:', error);
            setAlertError('Failed to delete alert');
        }
    };

    const checkAlertsNowForMarket = async () => {
        if (!alertMarket?.conditionId) return;

        setAlertError('');
        setAlertMessage('');
        setAlertCheckingNow(true);

        try {
            const res = await fetch(`/api/polymarket/alerts/check?manual=1&marketId=${encodeURIComponent(alertMarket.conditionId)}`, {
                method: 'GET',
                cache: 'no-store',
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                setAlertError(data?.error || 'Failed to run alert check');
                return;
            }

            const checked = Number(data?.checked || 0);
            const triggered = Number(data?.triggered || 0);
            const autoBuyExecuted = Number(data?.autoBuyExecuted || 0);
            setAlertMessage(`Checked ${checked} alert(s), triggered ${triggered}, auto-buy executed ${autoBuyExecuted}.`);
            await loadAlertsForMarket(alertMarket.conditionId);
        } catch (error) {
            console.error('Failed to run immediate alert check:', error);
            setAlertError('Failed to run alert check');
        } finally {
            setAlertCheckingNow(false);
        }
    };

    // Category tabs
    const categoryTabs = ['All', 'Politics', 'Sports', 'Crypto', 'Finance', 'Tech', 'Culture'];

    // Featured markets (top 5 by volume) - will rotate
    const featuredMarkets = [...markets]
        .sort((a, b) => (b.volume || 0) - (a.volume || 0))
        .slice(0, 5);

    // Auto-rotate featured market every 6.5 seconds
    useEffect(() => {
        if (featuredMarkets.length <= 1) return;
        const interval = setInterval(() => {
            setFeaturedIndex((prev) => (prev + 1) % featuredMarkets.length);
        }, 6500);
        return () => clearInterval(interval);
    }, [featuredMarkets.length]);

    // Trending markets (sidebar) - Sorted by volume (highest trading activity)
    const trendingMarkets = [...markets]
        .sort((a, b) => (b.volume || 0) - (a.volume || 0))
        .slice(0, 6);

    // Get pastel color for trending items
    const getTrendingColor = (idx: number) => {
        const colors = [
            { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
            { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
            { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
            { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
            { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' },
            { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' },
        ];
        return colors[idx % colors.length];
    };

    // Get color based on probability
    const getProbabilityColor = (pct: number) => {
        if (pct >= 75) return 'text-green-600';
        if (pct >= 60) return 'text-blue-600';
        if (pct >= 40) return 'text-gray-700';
        if (pct >= 25) return 'text-orange-600';
        return 'text-red-600';
    };

    // Filter and sort markets
    const filteredMarkets = markets.filter(market => {
        // Category filter
        if (selectedCategory !== 'All' && market.category !== selectedCategory) return false;

        // Search filter
        if (searchTerm && !market.question.toLowerCase().includes(searchTerm.toLowerCase())) return false;

        // Watchlist filter
        if (showWatchlistOnly) {
            if (!market.conditionId) return false;
            if (!watchlist.includes(market.conditionId)) return false;
        }

        // Probability range filter
        const yesPrice = market.outcomes?.find(o => o.name === 'YES')?.price || 0.5;
        const probability = yesPrice * 100;
        if (probability < probabilityRange[0] || probability > probabilityRange[1]) return false;

        // Volume filter
        if ((market.volume || 0) < volumeMin) return false;

        // End date filter
        if (endDateFilter !== 'all' && market.end_date_iso) {
            const endDate = new Date(market.end_date_iso);
            const now = new Date();
            const daysDiff = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

            if (endDateFilter === '7days' && daysDiff > 7) return false;
            if (endDateFilter === '30days' && daysDiff > 30) return false;
            if (endDateFilter === '90days' && daysDiff > 90) return false;
        }

        return true;
    }).sort((a, b) => {
        // Apply sorting
        switch (sortBy) {
            case 'volume-high':
                return (b.volume || 0) - (a.volume || 0);
            case 'volume-low':
                return (a.volume || 0) - (b.volume || 0);
            case 'liquidity-high':
                return (b.liquidity || 0) - (a.liquidity || 0);
            case 'liquidity-low':
                return (a.liquidity || 0) - (b.liquidity || 0);
            case 'end-date-soon':
                if (!a.end_date_iso) return 1;
                if (!b.end_date_iso) return -1;
                return new Date(a.end_date_iso).getTime() - new Date(b.end_date_iso).getTime();
            case 'end-date-late':
                if (!a.end_date_iso) return 1;
                if (!b.end_date_iso) return -1;
                return new Date(b.end_date_iso).getTime() - new Date(a.end_date_iso).getTime();
            case 'probability-high':
                const aProbability = (a.outcomes?.find(o => o.name === 'YES')?.price || 0.5) * 100;
                const bProbability = (b.outcomes?.find(o => o.name === 'YES')?.price || 0.5) * 100;
                return bProbability - aProbability;
            case 'probability-low':
                const aProbabilityLow = (a.outcomes?.find(o => o.name === 'YES')?.price || 0.5) * 100;
                const bProbabilityLow = (b.outcomes?.find(o => o.name === 'YES')?.price || 0.5) * 100;
                return aProbabilityLow - bProbabilityLow;
            default:
                return 0; // Default order
        }
    });

    const currentFeatured = featuredMarkets[featuredIndex];

    return (
        <div className="min-h-screen bg-white">
            {/* Header */}
            <div className="max-w-340 mx-auto px-6 py-3">
                <h1 className="text-2xl font-bold text-gray-900">Polymarket</h1>
                <p className="text-gray-600 mt-1 text-sm">
                    Trade on real-world events and prediction markets
                </p>
            </div>

            <div className="max-w-340 mx-auto px-6 pb-4">
                {/* Featured + Trending Section */}
                <div className="grid grid-cols-12 gap-6 mb-8">
                    {/* Featured Market Carousel - Left side */}
                    <div className="col-span-12 lg:col-span-7 flex flex-col">
                        {currentFeatured && (
                            <>
                                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow flex-1 relative">
                                    {/* Favorite Button - Top Right */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const marketId = currentFeatured.conditionId;
                                            if (marketId) toggleWatchlist(marketId, e);
                                        }}
                                        disabled={!currentFeatured.conditionId || togglingWatchlist.has(currentFeatured.conditionId || '')}
                                        className="absolute top-4 right-4 w-9 h-9 rounded-2xl flex items-center justify-center hover:bg-gray-100 transition-all z-10"
                                        title={currentFeatured.conditionId && watchlist.includes(currentFeatured.conditionId) ? "Remove from favorites" : "Add to favorites"}
                                    >
                                        <svg
                                            className={`w-5 h-5 transition-all ${currentFeatured.conditionId && watchlist.includes(currentFeatured.conditionId)
                                                ? 'text-yellow-500 fill-yellow-500'
                                                : 'text-gray-300 hover:text-yellow-500'
                                                } ${currentFeatured.conditionId && togglingWatchlist.has(currentFeatured.conditionId) ? 'opacity-50' : ''
                                                }`}
                                            fill={currentFeatured.conditionId && watchlist.includes(currentFeatured.conditionId) ? "currentColor" : "none"}
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
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const marketId = currentFeatured.conditionId;
                                            if (!marketId) return;
                                            openAlertModal(currentFeatured, e);
                                        }}
                                        disabled={!currentFeatured.conditionId}
                                        className="absolute top-4 right-14 w-9 h-9 rounded-2xl flex items-center justify-center hover:bg-gray-100 transition-all z-10"
                                        title="Set alert"
                                    >
                                        <svg className="w-5 h-5 text-gray-400 hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                        </svg>
                                    </button>

                                    <div className="flex items-start gap-5">
                                        {/* Image */}
                                        {currentFeatured.image && (
                                            <img
                                                src={currentFeatured.image}
                                                alt=""
                                                className="w-20 h-20 rounded-xl object-cover border border-gray-200"
                                                onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                                            />
                                        )}
                                        <div className="flex-1">
                                            {/* Tags */}
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="px-2.5 py-0.5 bg-gray-900 text-white text-xs font-semibold rounded-full">
                                                    Featured
                                                </span>
                                                <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                                                    {currentFeatured.category || 'Market'}
                                                </span>
                                            </div>

                                            {/* Question */}
                                            <h2 className="text-xl font-bold text-gray-900 mb-2 leading-tight">
                                                {currentFeatured.question}
                                            </h2>

                                            {/* Description */}
                                            {currentFeatured.description && (
                                                <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                                                    {currentFeatured.description}
                                                </p>
                                            )}

                                            {/* Market Stats */}
                                            <div className="grid grid-cols-3 gap-4 mb-4 py-3 border-y border-gray-100">
                                                <div>
                                                    <div className="text-xs text-gray-400 mb-0.5">Volume</div>
                                                    <div className="text-sm font-bold text-gray-900">{formatVolume(currentFeatured.volume)}</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-gray-400 mb-0.5">Liquidity</div>
                                                    <div className="text-sm font-bold text-gray-900">{formatVolume(currentFeatured.liquidity)}</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-gray-400 mb-0.5">End Date</div>
                                                    <div className="text-sm font-bold text-gray-900">
                                                        {currentFeatured.end_date_iso
                                                            ? new Date(currentFeatured.end_date_iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                            : '-'
                                                        }
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Outcomes */}
                                            <div className="space-y-3 mb-4">
                                                {currentFeatured.outcomes?.map((outcome) => {
                                                    const pct = (outcome.price * 100).toFixed(0);
                                                    const isYes = outcome.name === 'YES';
                                                    return (
                                                        <div key={outcome.name} className="flex items-center gap-3">
                                                            <div className="w-12 text-sm font-semibold text-gray-600">{outcome.name}</div>
                                                            <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-500 ${isYes ? 'bg-gray-700' : 'bg-gray-400'}`}
                                                                    style={{ width: `${pct}%` }}
                                                                />
                                                            </div>
                                                            <div className="w-14 text-right text-lg font-bold text-gray-900">{pct}%</div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Trade Buttons */}
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => goToMarket(currentFeatured, 'YES')}
                                                    className="flex-1 px-4 py-3 bg-green-50 hover:bg-green-100 text-green-700 font-semibold text-sm rounded-2xl transition-all border border-green-200"
                                                >
                                                    Buy Yes · {((currentFeatured.outcomes?.[0]?.price || 0.5) * 100).toFixed(0)}¢
                                                </button>
                                                <button
                                                    onClick={() => goToMarket(currentFeatured, 'NO')}
                                                    className="flex-1 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-sm rounded-2xl transition-all border border-red-200"
                                                >
                                                    Buy No · {((currentFeatured.outcomes?.[1]?.price || 0.5) * 100).toFixed(0)}¢
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Navigation: Progress Dots (Left) + Buttons (Right) */}
                                <div className="mt-4 flex items-center justify-between">
                                    {/* Progress Bar - Left */}
                                    <div className="flex gap-2">
                                        {featuredMarkets.map((_, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setFeaturedIndex(idx)}
                                                className={`h-2 rounded-full transition-all ${idx === featuredIndex
                                                    ? 'bg-linear-to-r from-gray-400 to-gray-500 w-8'
                                                    : 'bg-gray-300 hover:bg-gray-400 w-2'
                                                    }`}
                                            />
                                        ))}
                                    </div>

                                    {/* Prev/Next Buttons - Right */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setFeaturedIndex((prev) => (prev - 1 + featuredMarkets.length) % featuredMarkets.length)}
                                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium text-sm rounded-2xl transition-all"
                                        >
                                            ← Prev
                                        </button>
                                        <button
                                            onClick={() => setFeaturedIndex((prev) => (prev + 1) % featuredMarkets.length)}
                                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium text-sm rounded-2xl transition-all"
                                        >
                                            Next →
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Trending Topics - Right sidebar */}
                    <div className="col-span-12 lg:col-span-5 flex flex-col">
                        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 flex-1">
                            <div className="mb-4">
                                <h3 className="text-lg font-bold text-gray-900">Trending</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Sorted by trading volume</p>
                            </div>
                            <div className="space-y-3">
                                {trendingMarkets.map((market, idx) => {
                                    const pct = ((market.outcomes?.[0]?.price || 0.5) * 100).toFixed(0);
                                    const pctNum = parseInt(pct);
                                    const colorScheme = getTrendingColor(idx);
                                    const pctColor = getProbabilityColor(pctNum);
                                    return (
                                        <div
                                            key={market.id}
                                            onClick={() => goToMarket(market)}
                                            className={`flex items-start gap-2.5 p-2.5 -mx-2.5 rounded-lg hover:bg-white cursor-pointer transition-all border ${colorScheme.border} border-opacity-0 hover:border-opacity-100`}
                                        >
                                            <div className={`w-5 h-5 rounded-full ${colorScheme.bg} ${colorScheme.text} flex items-center justify-center text-xs font-bold shrink-0`}>
                                                {idx + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs text-gray-900 line-clamp-2 leading-snug font-medium mb-1">
                                                    {market.question}
                                                </p>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${colorScheme.bg} ${colorScheme.text}`}>
                                                    {formatVolume(market.volume)}
                                                </span>
                                            </div>
                                            <span className={`text-sm font-bold ${pctColor} shrink-0`}>{pct}%</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* All Markets Section */}
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">All Markets</h2>

                    {/* Filters */}
                    <div className="py-4 mb-6 space-y-4">
                        {/* Category Filters - Top Row */}
                        <div className="flex gap-2 flex-wrap">
                            {categoryTabs.map((tab, idx) => {
                                const isSelected = selectedCategory === tab;
                                const palette = [
                                    { sel: 'bg-gray-900 text-white border-gray-900', unsel: 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:bg-gray-50' },
                                    { sel: 'bg-blue-100 text-blue-700 border-blue-300', unsel: 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600' },
                                    { sel: 'bg-violet-100 text-violet-700 border-violet-300', unsel: 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600' },
                                    { sel: 'bg-amber-100 text-amber-700 border-amber-300', unsel: 'bg-white text-gray-600 border-gray-200 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600' },
                                    { sel: 'bg-emerald-100 text-emerald-700 border-emerald-300', unsel: 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600' },
                                    { sel: 'bg-rose-100 text-rose-700 border-rose-300', unsel: 'bg-white text-gray-600 border-gray-200 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600' },
                                    { sel: 'bg-cyan-100 text-cyan-700 border-cyan-300', unsel: 'bg-white text-gray-600 border-gray-200 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-600' },
                                ];
                                const scheme = palette[idx % palette.length];
                                return (
                                    <button
                                        key={tab}
                                        onClick={() => setSelectedCategory(tab)}
                                        className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all border ${isSelected
                                            ? `${scheme.sel} shadow-sm scale-105`
                                            : scheme.unsel
                                            }`}
                                    >
                                        {tab}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Control Bar - Bottom Row */}
                        <div className="flex flex-wrap gap-3 items-center">
                            {/* Search */}
                            <div className="relative flex-1 min-w-50">
                                <input
                                    type="text"
                                    placeholder="Search markets..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-11 pr-4 py-2.5 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white hover:border-gray-300 transition-all"
                                />
                                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>

                            {/* Sort By - Custom Dropdown */}
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                                    className={`px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all flex items-center gap-2 border ${showAdvancedFilters || sortBy !== 'default' || probabilityRange[0] > 0 || probabilityRange[1] < 100 || volumeMin > 0 || endDateFilter !== 'all'
                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                                        }`}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                                    </svg>
                                    {sortBy === 'default' ? 'Sort' : sortBy.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                    <svg className={`w-4 h-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {/* Dropdown Menu */}
                                {showAdvancedFilters && (
                                    <div className="absolute top-full mt-2 right-0 w-80 bg-white rounded-2xl border border-gray-200 shadow-2xl z-50 animate-fadeIn overflow-hidden">
                                        <div className="p-3">
                                            {/* Sort Options */}
                                            <div className="mb-3">
                                                <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2 px-2">Sort By</div>
                                                <div className="space-y-0.5">
                                                    {[
                                                        { value: 'default', label: 'Default Order', icon: '⚡', active: 'bg-gray-100 text-gray-800' },
                                                        { value: 'volume-high', label: 'Volume: High to Low', icon: '📈', active: 'bg-blue-100 text-blue-700' },
                                                        { value: 'volume-low', label: 'Volume: Low to High', icon: '📉', active: 'bg-blue-100 text-blue-700' },
                                                        { value: 'liquidity-high', label: 'Liquidity: High to Low', icon: '💰', active: 'bg-emerald-100 text-emerald-700' },
                                                        { value: 'liquidity-low', label: 'Liquidity: Low to High', icon: '💸', active: 'bg-emerald-100 text-emerald-700' },
                                                        { value: 'end-date-soon', label: 'Ending Soon', icon: '⏰', active: 'bg-amber-100 text-amber-700' },
                                                        { value: 'end-date-late', label: 'Ending Later', icon: '📅', active: 'bg-amber-100 text-amber-700' },
                                                        { value: 'probability-high', label: 'Probability: High → Low', icon: '🔥', active: 'bg-rose-100 text-rose-700' },
                                                        { value: 'probability-low', label: 'Probability: Low → High', icon: '❄️', active: 'bg-cyan-100 text-cyan-700' },
                                                    ].map((option) => (
                                                        <button
                                                            key={option.value}
                                                            onClick={() => setSortBy(option.value)}
                                                            className={`w-full px-3 py-2 rounded-xl text-left text-sm font-medium transition-all flex items-center gap-3 ${sortBy === option.value
                                                                ? option.active
                                                                : 'text-gray-600 hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            <span className="text-base w-5 text-center">{option.icon}</span>
                                                            <span className="flex-1">{option.label}</span>
                                                            {sortBy === option.value && (
                                                                <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Advanced Filters */}
                                            <div className="border-t border-gray-100 pt-3 space-y-4">
                                                <div className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-2 px-2">Filters</div>

                                                {/* Probability Range */}
                                                <div className="px-2 py-2.5 rounded-xl bg-violet-50">
                                                    <label className="block text-xs font-bold text-violet-700 mb-2">
                                                        🎯 Probability: <span className="text-violet-900">{probabilityRange[0]}% – {probabilityRange[1]}%</span>
                                                    </label>
                                                    <div className="space-y-1.5">
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max="100"
                                                            value={probabilityRange[0]}
                                                            onChange={(e) => setProbabilityRange([parseInt(e.target.value), probabilityRange[1]])}
                                                            className="w-full accent-violet-500"
                                                        />
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max="100"
                                                            value={probabilityRange[1]}
                                                            onChange={(e) => setProbabilityRange([probabilityRange[0], parseInt(e.target.value)])}
                                                            className="w-full accent-violet-500"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Minimum Volume */}
                                                <div className="px-2">
                                                    <label className="block text-xs font-bold text-blue-600 mb-2">
                                                        📊 Min Volume
                                                    </label>
                                                    <div className="flex gap-1.5">
                                                        {[
                                                            { value: 0, label: 'All', sel: 'bg-gray-200 text-gray-700' },
                                                            { value: 1000, label: '$1K+', sel: 'bg-blue-100 text-blue-700' },
                                                            { value: 10000, label: '$10K+', sel: 'bg-cyan-100 text-cyan-700' },
                                                            { value: 100000, label: '$100K+', sel: 'bg-teal-100 text-teal-700' },
                                                        ].map((opt) => (
                                                            <button
                                                                key={opt.value}
                                                                onClick={() => setVolumeMin(opt.value)}
                                                                className={`flex-1 px-2 py-1.5 rounded-xl text-xs font-semibold transition-all ${volumeMin === opt.value
                                                                    ? opt.sel
                                                                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                                                    }`}
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* End Date Filter */}
                                                <div className="px-2">
                                                    <label className="block text-xs font-bold text-amber-600 mb-2">
                                                        📅 Ends Within
                                                    </label>
                                                    <div className="grid grid-cols-2 gap-1.5">
                                                        <button
                                                            onClick={() => setEndDateFilter('all')}
                                                            className={`px-2 py-1.5 rounded-xl text-xs font-semibold transition-all ${endDateFilter === 'all'
                                                                ? 'bg-gray-200 text-gray-700'
                                                                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                                                }`}
                                                        >
                                                            Any Time
                                                        </button>
                                                        <button
                                                            onClick={() => setEndDateFilter('7days')}
                                                            className={`px-2 py-1.5 rounded-xl text-xs font-semibold transition-all ${endDateFilter === '7days'
                                                                ? 'bg-rose-100 text-rose-700'
                                                                : 'bg-gray-50 text-gray-500 hover:bg-rose-50 hover:text-rose-600'
                                                                }`}
                                                        >
                                                            7 Days
                                                        </button>
                                                        <button
                                                            onClick={() => setEndDateFilter('30days')}
                                                            className={`px-2 py-1.5 rounded-xl text-xs font-semibold transition-all ${endDateFilter === '30days'
                                                                ? 'bg-amber-100 text-amber-700'
                                                                : 'bg-gray-50 text-gray-500 hover:bg-amber-50 hover:text-amber-600'
                                                                }`}
                                                        >
                                                            30 Days
                                                        </button>
                                                        <button
                                                            onClick={() => setEndDateFilter('90days')}
                                                            className={`px-2 py-1.5 rounded-xl text-xs font-semibold transition-all ${endDateFilter === '90days'
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : 'bg-gray-50 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600'
                                                                }`}
                                                        >
                                                            90 Days
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Reset Button */}
                                                <div className="px-2 pt-1 pb-1">
                                                    <button
                                                        onClick={() => {
                                                            setProbabilityRange([0, 100]);
                                                            setVolumeMin(0);
                                                            setEndDateFilter('all');
                                                            setSortBy('default');
                                                        }}
                                                        className="w-full px-3 py-2 bg-gray-900 hover:bg-gray-700 text-white font-semibold text-xs rounded-full transition-all"
                                                    >
                                                        Reset All Filters
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Watchlist Toggle */}
                            <button
                                onClick={() => setShowWatchlistOnly(!showWatchlistOnly)}
                                className={`px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all flex items-center gap-2 ${showWatchlistOnly
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <svg className="w-4 h-4" fill={showWatchlistOnly ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                </svg>
                                {showWatchlistOnly ? `Favorites (${watchlist.length})` : 'Favorites'}
                            </button>

                            {/* Results count */}
                            <div className="text-sm font-medium text-gray-500">
                                {filteredMarkets.length} {filteredMarkets.length === 1 ? 'market' : 'markets'}
                            </div>
                        </div>
                    </div>

                    {/* Markets Grid */}
                    {filteredMarkets.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">No Markets Found</h3>
                            <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredMarkets.map((market) => {
                                const yesPrice = market.outcomes?.find(o => o.name === 'YES')?.price || 0.5;
                                const noPrice = market.outcomes?.find(o => o.name === 'NO')?.price || 0.5;
                                const yesPct = (yesPrice * 100).toFixed(0);
                                const yesPctNum = parseInt(yesPct);
                                const pctColor = getProbabilityColor(yesPctNum);
                                const marketId = market.conditionId;
                                const inWatchlist = marketId ? watchlist.includes(marketId) : false;
                                const isToggling = marketId ? togglingWatchlist.has(marketId) : false;

                                return (
                                    <div
                                        key={market.id}
                                        className="bg-white rounded-3xl border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all group relative"
                                    >
                                        {/* Watchlist Button - Top Right */}
                                        <button
                                            onClick={(e) => marketId && toggleWatchlist(marketId, e)}
                                            disabled={isToggling || !marketId}
                                            className="absolute top-3 right-3 w-8 h-8 rounded-2xl flex items-center justify-center hover:bg-gray-100 transition-all z-10"
                                            title={inWatchlist ? "Remove from favorites" : "Add to favorites"}
                                        >
                                            <svg
                                                className={`w-5 h-5 transition-all ${inWatchlist ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300 hover:text-yellow-500'
                                                    } ${isToggling ? 'opacity-50' : ''}`}
                                                fill={inWatchlist ? "currentColor" : "none"}
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
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!marketId) return;
                                                openAlertModal(market, e);
                                            }}
                                            disabled={!marketId}
                                            className="absolute top-3 right-11 w-8 h-8 rounded-2xl flex items-center justify-center hover:bg-gray-100 transition-all z-10"
                                            title="Set alert"
                                        >
                                            <svg className="w-4.5 h-4.5 text-gray-400 hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                            </svg>
                                        </button>

                                        {/* Header */}
                                        <div
                                            onClick={() => goToMarket(market)}
                                            className="cursor-pointer"
                                        >
                                            <div className="flex items-start justify-between mb-3 pr-16">
                                                <div className="flex items-center gap-2">
                                                    {market.image ? (
                                                        <img
                                                            src={market.image}
                                                            alt=""
                                                            className="w-8 h-8 rounded-xl object-cover"
                                                            onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-xl bg-linear-to-br from-blue-200 to-purple-200" />
                                                    )}
                                                    <span className="text-xs text-gray-500">{market.category}</span>
                                                </div>
                                                <span className={`text-lg font-bold ${pctColor}`}>{yesPct}%</span>
                                            </div>

                                            {/* Question */}
                                            <h4 className="text-sm font-semibold text-gray-900 leading-tight mb-3 line-clamp-2 min-h-10">
                                                {market.question}
                                            </h4>

                                            {/* Volume */}
                                            <div className="text-xs text-gray-400 mb-3">
                                                {formatVolume(market.volume)} volume
                                            </div>
                                        </div>

                                        {/* Trade Buttons */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    goToMarket(market, 'YES');
                                                }}
                                                className="px-3 py-2 bg-green-50 hover:bg-green-500 text-green-700 hover:text-white font-semibold text-sm rounded-2xl transition-all border border-green-200 hover:border-green-500"
                                            >
                                                Yes
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    goToMarket(market, 'NO');
                                                }}
                                                className="px-3 py-2 bg-red-50 hover:bg-red-500 text-red-700 hover:text-white font-semibold text-sm rounded-2xl transition-all border border-red-200 hover:border-red-500"
                                            >
                                                No
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {showAlertModal && alertMarket && (
                <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200">
                        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/80 rounded-t-2xl">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Set Alerts</h3>
                                <p className="text-xs text-gray-500 truncate max-w-lg">{alertMarket.question}</p>
                            </div>
                            <button
                                onClick={() => setShowAlertModal(false)}
                                className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-5 space-y-3">
                            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3.5 space-y-2.5">
                                <div className="grid grid-cols-2 gap-2">
                                    <label className="block">
                                        <span className="block text-[11px] font-semibold text-gray-600 mb-1">Outcome</span>
                                        <CustomSelect
                                            value={alertOutcome}
                                            onChange={(nextValue) => setAlertOutcome(nextValue)}
                                            size="compact"
                                            tone="soft"
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
                                            size="compact"
                                            tone="soft"
                                            options={[
                                                { value: 'ABOVE', label: 'ABOVE' },
                                                { value: 'BELOW', label: 'BELOW' },
                                            ]}
                                        />
                                    </label>
                                </div>
                                <div className="rounded-xl border border-gray-200 bg-white p-3">
                                    <span className="block text-[11px] font-semibold text-gray-600 mb-2">Notify Via</span>
                                    <div className="flex flex-wrap gap-3">
                                        <label className="inline-flex items-center gap-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                                            <input
                                                type="checkbox"
                                                checked={alertNotifyChannels.includes('EMAIL')}
                                                onChange={() => toggleAlertNotifyChannel('EMAIL')}
                                                disabled={alertSubmitting}
                                                className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-300"
                                            />
                                            Email
                                        </label>
                                        <label className="inline-flex items-center gap-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                                            <input
                                                type="checkbox"
                                                checked={alertNotifyChannels.includes('DISCORD')}
                                                onChange={() => toggleAlertNotifyChannel('DISCORD')}
                                                disabled={alertSubmitting}
                                                className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-300"
                                            />
                                            Discord
                                        </label>
                                    </div>
                                </div>
                                <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
                                    <label className="block">
                                        <span className="block text-[11px] font-semibold text-gray-600 mb-1">Target Probability (%)</span>
                                        <input
                                            type="number"
                                            min="0.01"
                                            max="99.99"
                                            step="0.01"
                                            inputMode="decimal"
                                            value={alertTarget}
                                            onChange={(e) => setAlertTarget(e.target.value)}
                                            placeholder="e.g. 57.25"
                                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
                                        />
                                    </label>
                                    <button
                                        onClick={createAlertForMarket}
                                        disabled={alertSubmitting || alertCheckingNow}
                                        className="h-8 px-3 rounded-xl border border-gray-200 bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold disabled:opacity-50"
                                    >
                                        {alertSubmitting ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                        onClick={checkAlertsNowForMarket}
                                        disabled={alertSubmitting || alertCheckingNow}
                                        className="h-8 px-3 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold disabled:opacity-50"
                                    >
                                        {alertCheckingNow ? 'Checking...' : 'Check Now'}
                                    </button>
                                </div>
                                <div className="grid grid-cols-[auto_1fr] items-center gap-2 pt-1">
                                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 select-none">
                                        <input
                                            type="checkbox"
                                            checked={alertAutoBuyEnabled}
                                            onChange={(e) => setAlertAutoBuyEnabled(e.target.checked)}
                                            disabled={alertSubmitting}
                                            className="w-4 h-4 rounded border-gray-300"
                                        />
                                        Enable Auto Buy
                                    </label>
                                    <input
                                        type="number"
                                        min="0.1"
                                        step="0.1"
                                        inputMode="decimal"
                                        value={alertAutoBuyQuantity}
                                        onChange={(e) => setAlertAutoBuyQuantity(e.target.value)}
                                        disabled={alertSubmitting || !alertAutoBuyEnabled}
                                        placeholder="Auto buy quantity"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-100"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        inputMode="decimal"
                                        value={alertAutoBuyBudget}
                                        onChange={(e) => setAlertAutoBuyBudget(e.target.value)}
                                        disabled={alertSubmitting || !alertAutoBuyEnabled}
                                        placeholder="Budget cap"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-100"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            max="20"
                                            step="1"
                                            inputMode="numeric"
                                            value={alertAutoBuyRetryMax}
                                            onChange={(e) => setAlertAutoBuyRetryMax(e.target.value)}
                                            disabled={alertSubmitting || !alertAutoBuyEnabled}
                                            placeholder="Retry"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-100"
                                        />
                                        <input
                                            type="number"
                                            min="1"
                                            max="1440"
                                            step="1"
                                            inputMode="numeric"
                                            value={alertAutoBuyCooldown}
                                            onChange={(e) => setAlertAutoBuyCooldown(e.target.value)}
                                            disabled={alertSubmitting || !alertAutoBuyEnabled}
                                            placeholder="Cooldown m"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-100"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="number"
                                        min="0.01"
                                        max="99.99"
                                        step="0.01"
                                        inputMode="decimal"
                                        value={alertTpTargetPercent}
                                        onChange={(e) => setAlertTpTargetPercent(e.target.value)}
                                        disabled={alertSubmitting || !alertAutoBuyEnabled}
                                        placeholder="TP %"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-100"
                                    />
                                    <input
                                        type="number"
                                        min="0.01"
                                        max="99.99"
                                        step="0.01"
                                        inputMode="decimal"
                                        value={alertSlTargetPercent}
                                        onChange={(e) => setAlertSlTargetPercent(e.target.value)}
                                        disabled={alertSubmitting || !alertAutoBuyEnabled}
                                        placeholder="SL %"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-100"
                                    />
                                </div>
                            </div>

                            {alertError && <p className="text-xs text-red-600">{alertError}</p>}
                            {alertMessage && <p className="text-xs text-emerald-600">{alertMessage}</p>}

                            <div className="overflow-auto border border-gray-200 rounded-2xl max-h-72 bg-white shadow-xs">
                                {alertsLoading ? (
                                    <p className="text-sm text-gray-500 px-3 py-3">Loading alerts...</p>
                                ) : alertRows.filter((row) => row.is_active).length === 0 ? (
                                    <p className="text-sm text-gray-500 px-3 py-3">No active alerts for this market.</p>
                                ) : (
                                    <table className="min-w-full text-xs">
                                        <thead className="bg-gray-100 text-gray-700 sticky top-0 border-b border-gray-200">
                                            <tr>
                                                <th className="text-left px-3 py-2 font-semibold">Outcome</th>
                                                <th className="text-left px-3 py-2 font-semibold">Direction</th>
                                                <th className="text-left px-3 py-2 font-semibold">Target</th>
                                                <th className="text-left px-3 py-2 font-semibold">Auto Buy</th>
                                                <th className="text-right px-3 py-2 font-semibold">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {alertRows
                                                .filter((row) => row.is_active)
                                                .map((row) => (
                                                    <tr key={row.alert_id} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-3 py-2 text-gray-800 font-semibold">{row.outcome}</td>
                                                        <td className="px-3 py-2 text-gray-700">
                                                            <span className="px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-700">
                                                                {row.direction}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-gray-800 font-medium">{row.target_price_percent.toFixed(2)}%</td>
                                                        <td className="px-3 py-2 text-gray-700 font-medium">
                                                            {row.auto_buy_enabled ? `${Number(row.auto_buy_quantity || 0).toFixed(2)} shares` : '-'}
                                                        </td>
                                                        <td className="px-3 py-2 text-right">
                                                            <button
                                                                onClick={() => deleteAlertForMarket(row.alert_id)}
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
            )}
        </div>
    );
}
