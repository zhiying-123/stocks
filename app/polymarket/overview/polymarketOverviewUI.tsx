'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Market {
    id: string;
    question: string;
    description?: string;
    image?: string;
    category?: string;
    end_date_iso?: string;
    outcomes?: Array<{ name: string; price: number }>;
    volume?: number;
    liquidity?: number;
}

interface PolymarketOverviewUIProps {
    portfolio: {
        totalValue: number;
        totalInvested: number;
        totalGainLoss: number;
        cashBalance: number;
        holdingsCount: number;
    };
    currency: string;
    watchlistMarkets: Market[];
}

export default function PolymarketOverviewUI({
    portfolio,
    currency,
    watchlistMarkets: initialWatchlistMarkets,
}: PolymarketOverviewUIProps) {
    const router = useRouter();
    const [watchlistMarkets, setWatchlistMarkets] = useState(initialWatchlistMarkets);
    const [togglingWatchlist, setTogglingWatchlist] = useState<Set<string>>(new Set());

    const getCurrencySymbol = () => {
        switch (currency) {
            case 'USD': return '$';
            case 'SGD': return 'S$';
            case 'MYR': return 'RM';
            default: return currency;
        }
    };

    const goToMarket = (marketId: string) => {
        router.push(`/polymarket/market/${encodeURIComponent(marketId)}`);
    };

    // Remove from watchlist
    const removeFromWatchlist = async (marketId: string, e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }

        if (togglingWatchlist.has(marketId)) return;

        setTogglingWatchlist(prev => new Set(prev).add(marketId));

        try {
            const res = await fetch(`/api/polymarket/watchlist?marketId=${encodeURIComponent(marketId)}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                // Remove from local state
                setWatchlistMarkets(prev => prev.filter(market => market.id !== marketId));
            }
        } catch (error) {
            console.error('Failed to remove from watchlist:', error);
        } finally {
            setTogglingWatchlist(prev => {
                const newSet = new Set(prev);
                newSet.delete(marketId);
                return newSet;
            });
        }
    };

    const getProbabilityColor = (pct: number) => {
        if (pct >= 75) return 'text-green-600';
        if (pct >= 60) return 'text-blue-600';
        if (pct >= 40) return 'text-gray-700';
        if (pct >= 25) return 'text-orange-600';
        return 'text-red-600';
    };

    const formatVolume = (vol?: number): string => {
        if (!vol) return '$0';
        if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
        if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}K`;
        return `$${vol.toFixed(0)}`;
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Polymarket</h1>
                <p className="text-gray-600 mt-1">
                    Trade and manage your prediction market portfolio
                </p>
            </div>

            {/* Portfolio Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Total Value
                        </span>
                        <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                        {getCurrencySymbol()}{portfolio.totalValue.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Investment + Cash</p>
                </div>

                <div className={`rounded-2xl border shadow-sm p-5 ${portfolio.totalGainLoss >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Gain / Loss
                        </span>
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${portfolio.totalGainLoss >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                            <svg className={`w-4 h-4 ${portfolio.totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                    </div>
                    <p className={`text-2xl font-bold ${portfolio.totalGainLoss >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {portfolio.totalGainLoss >= 0 ? '+' : ''}{getCurrencySymbol()}{portfolio.totalGainLoss.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Polymarket positions only</p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Invested
                        </span>
                        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                        {getCurrencySymbol()}{portfolio.totalInvested.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Active positions</p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Cash Balance
                        </span>
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                        {getCurrencySymbol()}{portfolio.cashBalance.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Available funds</p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Holdings
                        </span>
                        <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                        {portfolio.holdingsCount}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Active markets</p>
                </div>
            </div>

            {/* Favorites Section */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-5 rounded-full bg-gray-900" />
                        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                            Favorites
                        </h2>
                        <span className="text-xs text-gray-400 ml-1">
                            ({watchlistMarkets.length})
                        </span>
                    </div>
                    <Link
                        href="/polymarket"
                        className="text-xs font-semibold text-gray-400 hover:text-gray-900 transition-colors"
                    >
                        + Add event
                    </Link>
                </div>

                {watchlistMarkets.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                        </div>
                        <p className="text-sm text-gray-400 mb-1">No markets in your favorites</p>
                        <p className="text-xs text-gray-300">Go to Polymarket to add markets you want to track</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {watchlistMarkets.map((market, index) => {
                            const yesPrice = market.outcomes?.[0]?.price || 0;
                            const noPrice = market.outcomes?.[1]?.price || 0;
                            const yesPct = Math.round(yesPrice * 100);
                            const noPct = Math.round(noPrice * 100);
                            const isToggling = togglingWatchlist.has(market.id);

                            return (
                                <div
                                    key={`${market.id}-${index}`}
                                    className="px-6 py-4 hover:bg-gray-50 transition-colors group"
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Image */}
                                        {market.image ? (
                                            <img
                                                src={market.image}
                                                alt=""
                                                className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0"
                                                onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-xl bg-linear-to-br from-blue-200 to-purple-200 shrink-0" />
                                        )}

                                        {/* Content */}
                                        <div
                                            className="flex-1 min-w-0 cursor-pointer"
                                            onClick={() => goToMarket(market.id)}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 font-medium rounded">
                                                    {market.category || 'Other'}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {formatVolume(market.volume)} vol
                                                </span>
                                            </div>
                                            <h4 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-1">
                                                {market.question}
                                            </h4>
                                        </div>

                                        {/* Probability */}
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className={`text-xl font-bold ${getProbabilityColor(yesPct)}`}>
                                                {yesPct}%
                                            </span>
                                            <span className="text-xs text-gray-400">YES</span>
                                        </div>

                                        {/* Trade Buttons */}
                                        <div className="flex gap-2 shrink-0">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/polymarket/market/${encodeURIComponent(market.id)}?outcome=YES`);
                                                }}
                                                className="px-4 py-2 bg-green-50 hover:bg-green-500 text-green-700 hover:text-white font-semibold text-sm rounded-lg transition-all border border-green-200 hover:border-green-500"
                                            >
                                                Yes {yesPct}¢
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/polymarket/market/${encodeURIComponent(market.id)}?outcome=NO`);
                                                }}
                                                className="px-4 py-2 bg-red-50 hover:bg-red-500 text-red-700 hover:text-white font-semibold text-sm rounded-lg transition-all border border-red-200 hover:border-red-500"
                                            >
                                                No {noPct}¢
                                            </button>
                                        </div>

                                        {/* Remove Button */}
                                        <button
                                            onClick={(e) => removeFromWatchlist(market.id, e)}
                                            disabled={isToggling}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                                            title="Remove from favorites"
                                        >
                                            <svg
                                                className={`w-5 h-5 text-yellow-500 fill-yellow-500 transition-all ${isToggling ? 'opacity-50' : ''}`}
                                                fill="currentColor"
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
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <Link
                    href="/polymarket"
                    className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md p-5 flex items-center gap-4 transition-all"
                >
                    <div className="w-11 h-11 rounded-xl bg-gray-900 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 group-hover:text-gray-700 transition-colors">Markets</h3>
                        <p className="text-xs text-gray-400">Browse & trade markets</p>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-900 group-hover:translate-x-0.5 transition-all shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </Link>

                <Link
                    href="/polymarket/my-positions"
                    className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md p-5 flex items-center gap-4 transition-all"
                >
                    <div className="w-11 h-11 rounded-xl bg-gray-900 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 group-hover:text-gray-700 transition-colors">My Positions</h3>
                        <p className="text-xs text-gray-400">View your positions</p>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-900 group-hover:translate-x-0.5 transition-all shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </Link>

                <Link
                    href="/polymarket/analytics"
                    className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md p-5 flex items-center gap-4 transition-all"
                >
                    <div className="w-11 h-11 rounded-xl bg-gray-900 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 group-hover:text-gray-700 transition-colors">Analytics</h3>
                        <p className="text-xs text-gray-400">Track performance</p>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-900 group-hover:translate-x-0.5 transition-all shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </Link>
            </div>
        </div>
    );
}
