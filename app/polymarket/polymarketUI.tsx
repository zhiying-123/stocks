'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
}

// Helper to format volume
function formatVolume(vol?: number): string {
    if (!vol) return '$0';
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}K`;
    return `$${vol.toFixed(0)}`;
}

export default function PolymarketUI({ markets, currency }: PolymarketUIProps) {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [featuredIndex, setFeaturedIndex] = useState(0);

    // Navigate to market detail page
    const goToMarket = (market: Market, outcome?: 'YES' | 'NO') => {
        if (!market.conditionId) return;
        const url = `/polymarket/market/${encodeURIComponent(market.conditionId)}${outcome ? `?outcome=${outcome}` : ''}`;
        router.push(url);
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

    // Filter markets
    const filteredMarkets = markets.filter(market => {
        if (selectedCategory !== 'All' && market.category !== selectedCategory) return false;
        if (searchTerm && !market.question.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
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
                                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow flex-1">
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
                                                    className="flex-1 px-4 py-3 bg-green-50 hover:bg-green-100 text-green-700 font-semibold text-sm rounded-lg transition-all border border-green-200"
                                                >
                                                    Buy Yes · {((currentFeatured.outcomes?.[0]?.price || 0.5) * 100).toFixed(0)}¢
                                                </button>
                                                <button
                                                    onClick={() => goToMarket(currentFeatured, 'NO')}
                                                    className="flex-1 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-sm rounded-lg transition-all border border-red-200"
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
                    <div className="py-4 mb-6">
                        <div className="flex flex-wrap gap-4 items-center">
                            {/* Category Filters */}
                            <div className="flex gap-2 flex-wrap flex-1">
                                {categoryTabs.map((tab, idx) => {
                                    const isSelected = selectedCategory === tab;
                                    const colors = [
                                        { selected: 'bg-blue-100 text-blue-700 hover:bg-blue-200', unselected: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
                                        { selected: 'bg-purple-100 text-purple-700 hover:bg-purple-200', unselected: 'bg-purple-50 text-purple-600 hover:bg-purple-100' },
                                        { selected: 'bg-green-100 text-green-700 hover:bg-green-200', unselected: 'bg-green-50 text-green-600 hover:bg-green-100' },
                                        { selected: 'bg-orange-100 text-orange-700 hover:bg-orange-200', unselected: 'bg-orange-50 text-orange-600 hover:bg-orange-100' },
                                        { selected: 'bg-pink-100 text-pink-700 hover:bg-pink-200', unselected: 'bg-pink-50 text-pink-600 hover:bg-pink-100' },
                                        { selected: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200', unselected: 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100' },
                                        { selected: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200', unselected: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' },
                                    ];
                                    const colorScheme = colors[idx % colors.length];
                                    return (
                                        <button
                                            key={tab}
                                            onClick={() => setSelectedCategory(tab)}
                                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${isSelected ? colorScheme.selected : colorScheme.unselected
                                                }`}
                                        >
                                            {tab}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Search */}
                            <div className="relative w-full sm:w-64">
                                <input
                                    type="text"
                                    placeholder="Search markets..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-full border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 bg-white hover:border-gray-300 transition-all"
                                />
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                        </div>

                        {/* Results count */}
                        <div className="mt-3 text-sm text-gray-500">
                            {filteredMarkets.length} markets
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

                                return (
                                    <div
                                        key={market.id}
                                        className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group"
                                    >
                                        {/* Header */}
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                {market.image ? (
                                                    <img
                                                        src={market.image}
                                                        alt=""
                                                        className="w-8 h-8 rounded-lg object-cover"
                                                        onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                                                    />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-lg bg-linear-to-br from-blue-200 to-purple-200" />
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

                                        {/* Trade Buttons */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    goToMarket(market, 'YES');
                                                }}
                                                className="px-3 py-2 bg-green-50 hover:bg-green-500 text-green-700 hover:text-white font-semibold text-sm rounded-lg transition-all border border-green-200 hover:border-green-500"
                                            >
                                                Yes
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    goToMarket(market, 'NO');
                                                }}
                                                className="px-3 py-2 bg-red-50 hover:bg-red-500 text-red-700 hover:text-white font-semibold text-sm rounded-lg transition-all border border-red-200 hover:border-red-500"
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
        </div>
    );
}
