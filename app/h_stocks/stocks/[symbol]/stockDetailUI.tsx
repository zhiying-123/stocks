"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import StockCompare from "./StockCompare";
import {
    ComposedChart,
    Area,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from "recharts";
import type { StockQuote, StockProfile, CandleData, ChartDataPoint, TimeRange } from "../../types";

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { payload: ChartDataPoint }[]; label?: string }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const isUp = data.change >= 0;
        return (
            <div className="bg-gray-900 text-white p-4 rounded-lg shadow-xl border border-gray-700 min-w-50">
                <p className="text-gray-400 text-sm mb-2">{data.fullDate}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                        <span className="text-gray-400">Open:</span>
                        <span className="ml-2 font-semibold">${data.open.toFixed(2)}</span>
                    </div>
                    <div>
                        <span className="text-gray-400">Close:</span>
                        <span className="ml-2 font-semibold">${data.close.toFixed(2)}</span>
                    </div>
                    <div>
                        <span className="text-gray-400">High:</span>
                        <span className="ml-2 font-semibold text-emerald-400">${data.high.toFixed(2)}</span>
                    </div>
                    <div>
                        <span className="text-gray-400">Low:</span>
                        <span className="ml-2 font-semibold text-red-400">${data.low.toFixed(2)}</span>
                    </div>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-700">
                    <span className={`font-bold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{data.change.toFixed(2)}%
                    </span>
                </div>
                {data.volume > 0 && (
                    <div className="mt-1 text-gray-400 text-xs">
                        Vol: {(data.volume / 1000000).toFixed(2)}M
                    </div>
                )}
            </div>
        );
    }
    return null;
};

export default function StockDetailUI({
    symbol,
    quote,
    profile,
    dailyCandles,
    monthlyCandles,
    isLoggedIn
}: {
    symbol: string;
    quote: StockQuote;
    profile: StockProfile | null;
    dailyCandles: CandleData | null;
    monthlyCandles: CandleData | null;
    isLoggedIn: boolean;
}) {
    const [timeRange, setTimeRange] = useState<TimeRange>('1M');
    const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
    const [addingToWatchlist, setAddingToWatchlist] = useState(false);
    const [isInWatchlist, setIsInWatchlist] = useState(false);
    const [compareSymbol, setCompareSymbol] = useState('');
    const [showCompare, setShowCompare] = useState(false);
    const [showBuyModal, setShowBuyModal] = useState(false);
    const [buyQuantity, setBuyQuantity] = useState('1');
    const [buying, setBuying] = useState(false);
    const [buyError, setBuyError] = useState('');
    const [buySuccess, setBuySuccess] = useState(false);
    const [showMA7, setShowMA7] = useState(false);
    const [showMA20, setShowMA20] = useState(false);
    const [showMA30, setShowMA30] = useState(false);
    const [showMA60, setShowMA60] = useState(false);
    
    // Alert states
    const [showAlertModal, setShowAlertModal] = useState(false);
    const [alertType, setAlertType] = useState<'TARGET_PRICE' | 'PERCENTAGE_CHANGE'>('TARGET_PRICE');
    const [alertCondition, setAlertCondition] = useState<'ABOVE' | 'BELOW'>('ABOVE');
    const [targetPrice, setTargetPrice] = useState('');
    const [percentageChange, setPercentageChange] = useState('');
    const [creatingAlert, setCreatingAlert] = useState(false);
    const [alertError, setAlertError] = useState('');
    const [alertSuccess, setAlertSuccess] = useState(false);

    const isPositive = quote.d >= 0;
    const changeColor = isPositive ? 'text-emerald-600' : 'text-red-600';

    // Check if stock is in watchlist on mount
    useEffect(() => {
        async function checkWatchlist() {
            if (!isLoggedIn) return;

            try {
                const res = await fetch('/api/watchlist');
                if (res.ok) {
                    const data = await res.json();
                    const isInList = data.watchlist?.some((item: any) => item.symbol === symbol);
                    setIsInWatchlist(isInList);
                }
            } catch (error) {
                console.error('Failed to check watchlist:', error);
            }
        }

        checkWatchlist();
    }, [symbol, isLoggedIn]);

    // Handle watchlist
    async function handleWatchlist() {
        // Redirect to login if not logged in
        if (!isLoggedIn) {
            window.location.href = '/login';
            return;
        }

        setAddingToWatchlist(true);
        try {
            const method = isInWatchlist ? 'DELETE' : 'POST';
            const res = await fetch('/api/watchlist', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol }),
            });
            if (res.ok) {
                setIsInWatchlist(!isInWatchlist);
            }
        } catch (error) {
            console.error('Failed to update watchlist:', error);
        } finally {
            setAddingToWatchlist(false);
        }
    }

    // Handle buy stock
    async function handleBuyStock() {
        if (!isLoggedIn) {
            window.location.href = '/login';
            return;
        }

        const quantity = parseInt(buyQuantity);
        if (!quantity || quantity <= 0) {
            setBuyError('Please enter a valid quantity');
            return;
        }

        setBuying(true);
        setBuyError('');

        try {
            const res = await fetch('/api/stocks/buy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol: symbol,
                    quantity: quantity,
                    pricePerShare: quote.c,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setBuySuccess(true);
                setTimeout(() => {
                    setShowBuyModal(false);
                    setBuySuccess(false);
                    setBuyQuantity('1');
                    // Refresh page to show updated holdings
                    window.location.reload();
                }, 2000);
            } else {
                setBuyError(data.error || 'Failed to buy stock');
            }
        } catch (error) {
            console.error('Failed to buy stock:', error);
            setBuyError('Network error, please try again');
        } finally {
            setBuying(false);
        }
    }

    // Handle create alert
    async function handleCreateAlert() {
        if (!isLoggedIn) {
            window.location.href = '/login';
            return;
        }

        setCreatingAlert(true);
        setAlertError('');

        try {
            const payload: any = {
                symbol: symbol,
                alertType: alertType,
                condition: alertCondition,
            };

            if (alertType === 'TARGET_PRICE') {
                const price = parseFloat(targetPrice);
                if (!price || price <= 0) {
                    setAlertError('Please enter a valid target price');
                    setCreatingAlert(false);
                    return;
                }
                payload.targetPrice = price;
            } else {
                const percent = parseFloat(percentageChange);
                if (!percent || percent <= 0) {
                    setAlertError('Please enter a valid percentage');
                    setCreatingAlert(false);
                    return;
                }
                payload.percentageChange = percent;
            }

            const res = await fetch('/api/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (res.ok) {
                setAlertSuccess(true);
                setTimeout(() => {
                    setShowAlertModal(false);
                    setAlertSuccess(false);
                    setTargetPrice('');
                    setPercentageChange('');
                }, 2000);
            } else {
                setAlertError(data.error || 'Failed to create alert');
            }
        } catch (error) {
            console.error('Failed to create alert:', error);
            setAlertError('Network error, please try again');
        } finally {
            setCreatingAlert(false);
        }
    }

    // Get candle data based on time range
    const getFilteredData = useMemo(() => {
        const sourceData = ['1W', '1M'].includes(timeRange) ? dailyCandles : monthlyCandles;
        if (!sourceData || sourceData.s !== 'ok') return [];

        const now = Date.now() / 1000;
        const ranges: Record<TimeRange, number> = {
            '1W': 7 * 24 * 60 * 60,
            '1M': 30 * 24 * 60 * 60,
            '3M': 90 * 24 * 60 * 60,
            '6M': 180 * 24 * 60 * 60,
            '1Y': 365 * 24 * 60 * 60,
        };

        const cutoff = now - ranges[timeRange];

        return sourceData.c
            .map((close, index) => {
                const timestamp = sourceData.t[index];
                if (timestamp < cutoff) return null;

                const prevClose = index > 0 ? sourceData.c[index - 1] : close;
                const change = ((close - prevClose) / prevClose) * 100;

                return {
                    date: new Date(timestamp * 1000).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                    }),
                    fullDate: new Date(timestamp * 1000).toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                    }),
                    close,
                    open: sourceData.o[index],
                    high: sourceData.h[index],
                    low: sourceData.l[index],
                    volume: sourceData.v?.[index] || 0,
                    change,
                    isUp: close >= sourceData.o[index],
                };
            })
            .filter((d): d is ChartDataPoint => d !== null);
    }, [timeRange, dailyCandles, monthlyCandles]);

    // Calculate moving average data for chart
    const chartDataWithMA = useMemo(() => {
        if (getFilteredData.length === 0) return [];

        return getFilteredData.map((dataPoint, index) => {
            const closes = getFilteredData.slice(0, index + 1).map(d => d.close);

            // Calculate MA for each period
            const calcMA = (n: number) => {
                const actualN = Math.min(n, closes.length);
                if (actualN === 0) return null;
                const slice = closes.slice(-actualN);
                return slice.reduce((a, b) => a + b, 0) / actualN;
            };

            return {
                ...dataPoint,
                ma7: closes.length >= 7 ? calcMA(7) : null,
                ma20: closes.length >= 20 ? calcMA(20) : null,
                ma30: closes.length >= 30 ? calcMA(30) : null,
                ma60: closes.length >= 60 ? calcMA(60) : null,
            };
        });
    }, [getFilteredData]);

    // Calculate statistics
    const stats = useMemo(() => {
        if (getFilteredData.length === 0) return null;

        const closes = getFilteredData.map(d => d.close);
        const highs = getFilteredData.map(d => d.high);
        const lows = getFilteredData.map(d => d.low);
        const volumes = getFilteredData.map(d => d.volume);

        const firstClose = closes[0];
        const lastClose = closes[closes.length - 1];
        const periodChange = ((lastClose - firstClose) / firstClose) * 100;

        // Calculate moving averages - use available data up to N days
        const calcMA = (n: number) => {
            const actualN = Math.min(n, closes.length);
            if (actualN === 0) return null as number | null;
            const slice = closes.slice(-actualN);
            return slice.reduce((a, b) => a + b, 0) / actualN;
        };

        const ma7 = calcMA(7);
        const ma20 = calcMA(20);
        const ma30 = calcMA(30);
        const ma60 = calcMA(60);

        return {
            high: Math.max(...highs),
            low: Math.min(...lows),
            avg: closes.reduce((a, b) => a + b, 0) / closes.length,
            periodChange,
            periodChangePositive: periodChange >= 0,
            avgVolume: volumes.reduce((a, b) => a + b, 0) / volumes.length,
            volatility: ((Math.max(...highs) - Math.min(...lows)) / Math.min(...lows)) * 100,
            ma7,
            ma20,
            ma30,
            ma60,
            dataPoints: closes.length,
        };
    }, [getFilteredData]);

    // Calculate Y axis domain
    const yDomain = useMemo(() => {
        if (getFilteredData.length === 0) return [0, 100];
        const lows = getFilteredData.map(d => d.low);
        const highs = getFilteredData.map(d => d.high);
        const min = Math.min(...lows);
        const max = Math.max(...highs);
        const padding = (max - min) * 0.05;
        return [min - padding, max + padding];
    }, [getFilteredData]);

    const timeRanges: { key: TimeRange; label: string }[] = [
        { key: '1W', label: '1 Week' },
        { key: '1M', label: '1 Month' },
        { key: '3M', label: '3 Months' },
        { key: '6M', label: '6 Months' },
        { key: '1Y', label: '1 Year' },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <Link href="/h_stocks/stocks">
                    <button className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white hover:bg-gray-50 rounded-xl transition-all border border-gray-100 font-medium shadow-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Stocks
                    </button>
                </Link>

                <div className="flex items-center gap-3">
                    {/* Buy Stock Button */}
                    <button
                        onClick={() => {
                            if (!isLoggedIn) {
                                window.location.href = '/login';
                            } else {
                                setShowBuyModal(true);
                            }
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all shadow-sm bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        {!isLoggedIn ? 'Login to Buy' : 'Buy Stock'}
                    </button>

                    {/* Add to Watchlist */}
                    <button
                        onClick={handleWatchlist}
                        disabled={addingToWatchlist}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all shadow-sm ${!isLoggedIn
                            ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                            : isInWatchlist
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'
                            } disabled:opacity-50`}
                    >
                        <svg className="w-4 h-4" fill={isInWatchlist ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        {!isLoggedIn ? 'Login to Watch' : isInWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
                    </button>

                    {/* Set Price Alert */}
                    <button
                        onClick={() => {
                            if (!isLoggedIn) {
                                window.location.href = '/login';
                            } else {
                                setShowAlertModal(true);
                            }
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all shadow-sm bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        {!isLoggedIn ? 'Login for Alerts' : 'Set Alert'}
                    </button>
                </div>
            </div>

            {/* Stock Info Header */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8">
                <div className="flex items-center justify-between flex-wrap gap-6">
                    <div className="flex items-center gap-6">
                        <div className="w-14 h-14 rounded-xl bg-gray-900 flex items-center justify-center shrink-0">
                            <span className="text-xl font-bold text-white">{symbol.charAt(0)}</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-1">{symbol}</h1>
                            {profile?.name && (
                                <p className="text-sm text-gray-400">{profile.name}</p>
                            )}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-bold text-gray-900 mb-1">
                            ${quote.c.toFixed(2)}
                        </div>
                        <div className={`inline-flex items-center gap-1 text-sm font-semibold ${changeColor}`}>
                            <span>{isPositive ? '↑' : '↓'}</span>
                            <span>{isPositive ? '+' : ''}{quote.d.toFixed(2)} ({isPositive ? '+' : ''}{quote.dp.toFixed(2)}%)</span>
                        </div>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-6 mt-8 pt-8 border-t border-gray-100">
                    <div>
                        <p className="text-xs text-gray-400 mb-1">Open</p>
                        <p className="font-bold text-gray-900">${quote.o.toFixed(2)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 mb-1">High</p>
                        <p className="font-bold text-emerald-600">${quote.h.toFixed(2)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 mb-1">Low</p>
                        <p className="font-bold text-red-600">${quote.l.toFixed(2)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 mb-1">Prev Close</p>
                        <p className="font-bold text-gray-900">${quote.pc.toFixed(2)}</p>
                    </div>
                    {profile?.marketCapitalization && (
                        <div>
                            <p className="text-xs text-gray-400 mb-1">Market Cap</p>
                            <p className="font-bold text-gray-900">
                                ${(profile.marketCapitalization / 1000).toFixed(2)}B
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Chart Section */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                    {/* Time Range Selector */}
                    <div className="flex gap-2">
                        {timeRanges.map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setTimeRange(key)}
                                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${timeRange === key
                                    ? 'bg-gray-900 text-white'
                                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-100'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* View Toggle */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setViewMode('chart')}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${viewMode === 'chart'
                                ? 'bg-gray-900 text-white'
                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-100'
                                }`}
                        >
                            Chart
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${viewMode === 'table'
                                ? 'bg-gray-900 text-white'
                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-100'
                                }`}
                        >
                            Table
                        </button>
                    </div>
                </div>

                {/* Moving Averages Toggle */}
                <div className="mb-6 pb-6 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Moving Averages:</p>
                    <div className="flex gap-3 flex-wrap">
                        <button
                            onClick={() => setShowMA7(!showMA7)}
                            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all border-2 ${showMA7
                                    ? 'bg-blue-500 text-white border-blue-500'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                                }`}
                        >
                            <span className="flex items-center gap-2">
                                {showMA7 && (
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                                MA 7
                            </span>
                        </button>
                        <button
                            onClick={() => setShowMA20(!showMA20)}
                            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all border-2 ${showMA20
                                    ? 'bg-purple-500 text-white border-purple-500'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                                }`}
                        >
                            <span className="flex items-center gap-2">
                                {showMA20 && (
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                                MA 20
                            </span>
                        </button>
                        <button
                            onClick={() => setShowMA30(!showMA30)}
                            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all border-2 ${showMA30
                                    ? 'bg-orange-500 text-white border-orange-500'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
                                }`}
                        >
                            <span className="flex items-center gap-2">
                                {showMA30 && (
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                                MA 30
                            </span>
                        </button>
                        <button
                            onClick={() => setShowMA60(!showMA60)}
                            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all border-2 ${showMA60
                                    ? 'bg-pink-500 text-white border-pink-500'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-pink-300'
                                }`}
                        >
                            <span className="flex items-center gap-2">
                                {showMA60 && (
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                                MA 60
                            </span>
                        </button>
                    </div>
                </div>

                {/* Main Content - Chart or Table */}
                {getFilteredData.length > 0 ? (
                    viewMode === 'chart' ? (
                        <div className="space-y-8">
                            {/* Price Chart */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <div className="w-1 h-4 bg-gray-900 rounded-full" />
                                    Price Trend
                                </h3>
                                <ResponsiveContainer width="100%" height={400}>
                                    <ComposedChart data={chartDataWithMA} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                        <defs>
                                            <linearGradient id="colorGreen" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorRed" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fill: '#9ca3af', fontSize: 11 }}
                                            tickLine={false}
                                            axisLine={{ stroke: '#e5e7eb' }}
                                            interval="preserveStartEnd"
                                            minTickGap={50}
                                        />
                                        <YAxis
                                            domain={yDomain}
                                            tick={{ fill: '#9ca3af', fontSize: 11 }}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(value: number) => `$${value.toFixed(0)}`}
                                            width={60}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        {stats && (
                                            <ReferenceLine
                                                y={stats.avg}
                                                stroke="#6b7280"
                                                strokeDasharray="5 5"
                                                strokeWidth={1}
                                            />
                                        )}
                                        <Area
                                            type="monotone"
                                            dataKey="close"
                                            stroke={stats?.periodChangePositive ? "#10b981" : "#ef4444"}
                                            strokeWidth={2}
                                            fill={stats?.periodChangePositive ? "url(#colorGreen)" : "url(#colorRed)"}
                                        />
                                        {showMA7 && (
                                            <Line
                                                type="monotone"
                                                dataKey="ma7"
                                                stroke="#3b82f6"
                                                strokeWidth={2}
                                                dot={false}
                                                connectNulls
                                                name="MA 7"
                                            />
                                        )}
                                        {showMA20 && (
                                            <Line
                                                type="monotone"
                                                dataKey="ma20"
                                                stroke="#a855f7"
                                                strokeWidth={2}
                                                dot={false}
                                                connectNulls
                                                name="MA 20"
                                            />
                                        )}
                                        {showMA30 && (
                                            <Line
                                                type="monotone"
                                                dataKey="ma30"
                                                stroke="#f97316"
                                                strokeWidth={2}
                                                dot={false}
                                                connectNulls
                                                name="MA 30"
                                            />
                                        )}
                                        {showMA60 && (
                                            <Line
                                                type="monotone"
                                                dataKey="ma60"
                                                stroke="#ec4899"
                                                strokeWidth={2}
                                                dot={false}
                                                connectNulls
                                                name="MA 60"
                                            />
                                        )}
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Volume Chart */}
                            {getFilteredData.some(d => d.volume > 0) && (
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                        <div className="w-1 h-4 bg-gray-900 rounded-full" />
                                        Trading Volume
                                    </h3>
                                    <ResponsiveContainer width="100%" height={150}>
                                        <ComposedChart data={getFilteredData} margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                                            <XAxis dataKey="date" hide />
                                            <YAxis hide />
                                            <Tooltip
                                                content={({ active, payload }: { active?: boolean; payload?: readonly any[] }) => {
                                                    if (active && payload?.[0]) {
                                                        return (
                                                            <div className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm border border-gray-700 shadow-md">
                                                                Volume: {((payload[0].value as number) / 1000000).toFixed(2)}M
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Bar
                                                dataKey="volume"
                                                fill="#9ca3af"
                                                opacity={0.6}
                                                radius={[2, 2, 0, 0]}
                                            />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Table View */
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100">
                                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-xs">Date</th>
                                        <th className="text-right py-3 px-4 text-gray-400 font-medium text-xs">Open</th>
                                        <th className="text-right py-3 px-4 text-gray-400 font-medium text-xs">High</th>
                                        <th className="text-right py-3 px-4 text-gray-400 font-medium text-xs">Low</th>
                                        <th className="text-right py-3 px-4 text-gray-400 font-medium text-xs">Close</th>
                                        <th className="text-right py-3 px-4 text-gray-400 font-medium text-xs">Change</th>
                                        <th className="text-right py-3 px-4 text-gray-400 font-medium text-xs">Volume</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...getFilteredData].reverse().map((row, index) => (
                                        <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                            <td className="py-3 px-4 text-gray-900 font-medium">{row.fullDate}</td>
                                            <td className="text-right py-3 px-4 text-gray-600">${row.open.toFixed(2)}</td>
                                            <td className="text-right py-3 px-4 text-emerald-600">${row.high.toFixed(2)}</td>
                                            <td className="text-right py-3 px-4 text-red-600">${row.low.toFixed(2)}</td>
                                            <td className="text-right py-3 px-4 text-gray-900 font-semibold">${row.close.toFixed(2)}</td>
                                            <td className={`text-right py-3 px-4 font-medium ${row.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {row.change >= 0 ? '+' : ''}{row.change.toFixed(2)}%
                                            </td>
                                            <td className="text-right py-3 px-4 text-gray-600">
                                                {row.volume > 0 ? `${(row.volume / 1000000).toFixed(2)}M` : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : (
                    <div className="py-12 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 00 2-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <p className="text-sm text-gray-400">No chart data available for this period</p>
                    </div>
                )}
            </div>

            {/* Statistics Panel */}
            {stats && (
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-1.5 h-5 rounded-full bg-gray-900" />
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Period Statistics</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div>
                            <p className="text-xs text-gray-400 mb-1">Period High</p>
                            <p className="text-lg font-bold text-emerald-600">${stats.high.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 mb-1">Period Low</p>
                            <p className="text-lg font-bold text-red-600">${stats.low.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 mb-1">Average</p>
                            <p className="text-lg font-bold text-gray-900">${stats.avg.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 mb-1">Period Change</p>
                            <p className={`text-lg font-bold ${stats.periodChangePositive ? 'text-emerald-600' : 'text-red-600'}`}>
                                {stats.periodChangePositive ? '+' : ''}{stats.periodChange.toFixed(2)}%
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 mb-1">Avg Volume</p>
                            <p className="text-lg font-bold text-gray-900">
                                {(stats.avgVolume / 1000000).toFixed(2)}M
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 mb-1">Volatility</p>
                            <p className="text-lg font-bold text-gray-900">
                                {stats.volatility.toFixed(2)}%
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 mb-1">Data Points</p>
                            <p className="text-lg font-bold text-gray-900">{stats.dataPoints}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Technical Indicators */}
            {stats && (
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-1.5 h-5 rounded-full bg-gray-900" />
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Moving Averages</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex items-center justify-between p-5 bg-gray-50 rounded-xl border border-gray-100">
                            <div>
                                <p className="text-xs text-gray-400 mb-1">MA (7 days)</p>
                                <p className="text-xl font-bold text-gray-900">{stats.ma7 != null ? `$${stats.ma7.toFixed(2)}` : 'N/A'}</p>
                            </div>
                            <div className={`px-3 py-1.5 rounded-lg text-sm font-bold ${stats.ma7 != null ? (quote.c > stats.ma7 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600') : 'bg-gray-100 text-gray-500'}`}>
                                {stats.ma7 != null ? (quote.c > stats.ma7 ? 'Above' : 'Below') : 'N/A'}
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-5 bg-gray-50 rounded-xl border border-gray-100">
                            <div>
                                <p className="text-xs text-gray-400 mb-1">MA (20 days)</p>
                                <p className="text-xl font-bold text-gray-900">{stats.ma20 != null ? `$${stats.ma20.toFixed(2)}` : 'N/A'}</p>
                            </div>
                            <div className={`px-3 py-1.5 rounded-lg text-sm font-bold ${stats.ma20 != null ? (quote.c > stats.ma20 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600') : 'bg-gray-100 text-gray-500'}`}>
                                {stats.ma20 != null ? (quote.c > stats.ma20 ? 'Above' : 'Below') : 'N/A'}
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-5 bg-gray-50 rounded-xl border border-gray-100">
                            <div>
                                <p className="text-xs text-gray-400 mb-1">MA (30 days)</p>
                                <p className="text-xl font-bold text-gray-900">{stats.ma30 != null ? `$${stats.ma30.toFixed(2)}` : 'N/A'}</p>
                            </div>
                            <div className={`px-3 py-1.5 rounded-lg text-sm font-bold ${stats.ma30 != null ? (quote.c > stats.ma30 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600') : 'bg-gray-100 text-gray-500'}`}>
                                {stats.ma30 != null ? (quote.c > stats.ma30 ? 'Above' : 'Below') : 'N/A'}
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-5 bg-gray-50 rounded-xl border border-gray-100">
                            <div>
                                <p className="text-xs text-gray-400 mb-1">MA (60 days)</p>
                                <p className="text-xl font-bold text-gray-900">{stats.ma60 != null ? `$${stats.ma60.toFixed(2)}` : 'N/A'}</p>
                            </div>
                            <div className={`px-3 py-1.5 rounded-lg text-sm font-bold ${stats.ma60 != null ? (quote.c > stats.ma60 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600') : 'bg-gray-100 text-gray-500'}`}>
                                {stats.ma60 != null ? (quote.c > stats.ma60 ? 'Above' : 'Below') : 'N/A'}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Technical Analysis Summary */}
            {stats && (
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-1.5 h-5 rounded-full bg-gray-900" />
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Technical Analysis</h3>
                    </div>

                    {/* Trading Signal */}
                    <div className="mb-6 p-5 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div>
                                <p className="text-xs text-gray-400 mb-2">Trading Signal (based on MA)</p>
                                <div className="flex items-center gap-3">
                                    {(stats.ma7 != null && stats.ma20 != null && stats.ma30 != null) ? (
                                        quote.c > stats.ma7 && quote.c > stats.ma20 && quote.c > stats.ma30 ? (
                                            <>
                                                <div className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg font-bold text-sm">
                                                    🟢 Strong Buy Signal
                                                </div>
                                                <span className="text-xs text-gray-500">Price above all major MAs</span>
                                            </>
                                        ) : quote.c < stats.ma7 && quote.c < stats.ma20 && quote.c < stats.ma30 ? (
                                            <>
                                                <div className="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-bold text-sm">
                                                    🔴 Strong Sell Signal
                                                </div>
                                                <span className="text-xs text-gray-500">Price below all major MAs</span>
                                            </>
                                        ) : quote.c > stats.ma7 && quote.c > stats.ma20 ? (
                                            <>
                                                <div className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg font-bold text-sm">
                                                    🟢 Buy Signal
                                                </div>
                                                <span className="text-xs text-gray-500">Short-term positive</span>
                                            </>
                                        ) : (
                                            <>
                                                <div className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold text-sm">
                                                    🟡 Hold / Neutral
                                                </div>
                                                <span className="text-xs text-gray-500">Mixed signals</span>
                                            </>
                                        )
                                    ) : (
                                        <>
                                            <div className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold text-sm">ℹ️ Insufficient data</div>
                                            <span className="text-xs text-gray-500">Need at least 30 data points to compute MA signals</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-400 mb-1">Volatility Index</p>
                                <p className={`text-lg font-bold ${stats.volatility > 10 ? 'text-red-600' :
                                    stats.volatility > 5 ? 'text-orange-600' :
                                        'text-emerald-600'
                                    }`}>
                                    {stats.volatility > 10 ? 'High' : stats.volatility > 5 ? 'Medium' : 'Low'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Key Insights */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center shrink-0 mt-0.5">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-bold text-gray-900 mb-1">Price Trend</h4>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        {stats.periodChangePositive
                                            ? `Up ${Math.abs(stats.periodChange).toFixed(2)}% in the last ${timeRange}`
                                            : `Down ${Math.abs(stats.periodChange).toFixed(2)}% in the last ${timeRange}`}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center shrink-0 mt-0.5">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-bold text-gray-900 mb-1">Trading Volume</h4>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        {stats.avgVolume > 0
                                            ? `Average ${(stats.avgVolume / 1000000).toFixed(2)}M shares per day`
                                            : 'Volume data not available'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center shrink-0 mt-0.5">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-bold text-gray-900 mb-1">Support & Resistance</h4>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        Support: ${stats.low.toFixed(2)} · Resistance: ${stats.high.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center shrink-0 mt-0.5">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-bold text-gray-900 mb-1">Data Coverage</h4>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        {stats.dataPoints} trading periods analyzed
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Compare */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-1.5 h-5 rounded-full bg-gray-900" />
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Stock Comparison</h3>
                </div>
                <p className="text-sm text-gray-600 mb-6">Compare this stock with another to analyze performance and data</p>

                <div className="space-y-5">
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <select
                                value={compareSymbol}
                                onChange={(e) => setCompareSymbol(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white shadow-sm hover:border-gray-400 transition-all cursor-pointer appearance-none"
                                style={{
                                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                                    backgroundPosition: 'right 0.5rem center',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundSize: '1.5em 1.5em'
                                }}
                            >
                                <option value="">Select a stock to compare...</option>
                                <optgroup label="━━━━━ Popular Stocks ━━━━━" className="text-xs">
                                    {[
                                        { symbol: 'AAPL', name: 'Apple Inc.' },
                                        { symbol: 'MSFT', name: 'Microsoft Corporation' },
                                        { symbol: 'GOOGL', name: 'Alphabet Inc.' },
                                        { symbol: 'AMZN', name: 'Amazon.com Inc.' },
                                        { symbol: 'TSLA', name: 'Tesla Inc.' },
                                        { symbol: 'NVDA', name: 'NVIDIA Corporation' },
                                        { symbol: 'META', name: 'Meta Platforms Inc.' },
                                        { symbol: 'NFLX', name: 'Netflix Inc.' },
                                        { symbol: 'JPM', name: 'JPMorgan Chase' },
                                        { symbol: 'V', name: 'Visa Inc.' },
                                        { symbol: 'JNJ', name: 'Johnson & Johnson' },
                                        { symbol: 'WMT', name: 'Walmart Inc.' },
                                        { symbol: 'PG', name: 'Procter & Gamble' },
                                        { symbol: 'MA', name: 'Mastercard Inc.' },
                                        { symbol: 'DIS', name: 'Walt Disney' },
                                        { symbol: 'PYPL', name: 'PayPal' },
                                        { symbol: 'INTC', name: 'Intel Corporation' },
                                        { symbol: 'VZ', name: 'Verizon' },
                                        { symbol: 'CSCO', name: 'Cisco Systems' },
                                        { symbol: 'PFE', name: 'Pfizer Inc.' }
                                    ].filter(s => s.symbol !== symbol).map((stock) => (
                                        <option key={stock.symbol} value={stock.symbol}>
                                            {stock.symbol} - {stock.name}
                                        </option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>
                        <button
                            onClick={() => {
                                if (compareSymbol) {
                                    setShowCompare(true);
                                } else {
                                    alert('Please select a stock to compare');
                                }
                            }}
                            disabled={!compareSymbol}
                            className="px-8 py-3.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-sm"
                        >
                            <span className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                                Compare
                            </span>
                        </button>
                    </div>

                    <div className="pt-4 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Quick Compare:</p>
                        <div className="flex gap-2 flex-wrap">
                            {['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA'].filter(s => s !== symbol).map((stock) => (
                                <button
                                    key={stock}
                                    onClick={() => {
                                        setCompareSymbol(stock);
                                        setShowCompare(true);
                                    }}
                                    className="px-4 py-2.5 bg-gray-800 text-white text-xs font-semibold rounded-lg transition-all shadow-sm hover:shadow-md"
                                >
                                    {stock}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Buy Stock Modal */}
            {showBuyModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in duration-200">
                        {/* Close button */}
                        <button
                            onClick={() => {
                                setShowBuyModal(false);
                                setBuyError('');
                                setBuyQuantity('1');
                            }}
                            className="absolute top-4 right-4 p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {buySuccess ? (
                            /* Success Screen */
                            <div className="text-center py-6">
                                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Purchase Successful!</h3>
                                <p className="text-sm text-gray-500">Your order has been placed. Redirecting...</p>
                            </div>
                        ) : (
                            /* Buy Form */
                            <>
                                <div className="mb-6">
                                    <h3 className="text-xl font-bold text-gray-900 mb-1">Buy {symbol}</h3>
                                    <p className="text-sm text-gray-500">Purchase shares at current market price</p>
                                </div>

                                {/* Stock Info */}
                                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm text-gray-600">Current Price</span>
                                        <span className="text-lg font-bold text-gray-900">${quote.c.toFixed(2)} USD</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-500">Market Status</span>
                                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                            Live Price
                                        </span>
                                    </div>
                                </div>

                                {/* Quantity Input */}
                                <div className="mb-6">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Quantity (Number of Shares)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={buyQuantity}
                                        onChange={(e) => {
                                            setBuyQuantity(e.target.value);
                                            setBuyError('');
                                        }}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                        placeholder="1"
                                    />
                                    <div className="flex justify-between mt-2">
                                        <span className="text-xs text-gray-500">Min: 1 share</span>
                                        <span className="text-xs text-gray-500">Market order</span>
                                    </div>
                                </div>

                                {/* Total Cost */}
                                <div className="bg-emerald-50 rounded-xl p-4 mb-6 border border-emerald-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-semibold text-emerald-900">Total Cost (USD)</span>
                                        <span className="text-2xl font-bold text-emerald-900">
                                            ${((parseFloat(buyQuantity) || 0) * quote.c).toFixed(2)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-emerald-700">
                                        Exchange rate will be applied based on your wallet currency
                                    </p>
                                </div>

                                {/* Error Message */}
                                {buyError && (
                                    <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
                                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {buyError}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            setShowBuyModal(false);
                                            setBuyError('');
                                            setBuyQuantity('1');
                                        }}
                                        className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleBuyStock}
                                        disabled={buying || !buyQuantity || parseFloat(buyQuantity) <= 0}
                                        className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                                    >
                                        {buying ? (
                                            <>
                                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                </svg>
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                Confirm Purchase
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Disclaimer */}
                                <p className="mt-4 text-xs text-center text-gray-400">
                                    By confirming, you agree to purchase at the current market price.
                                </p>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Price Alert Modal */}
            {showAlertModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in duration-200">
                        {/* Close button */}
                        <button
                            onClick={() => {
                                setShowAlertModal(false);
                                setAlertError('');
                                setTargetPrice('');
                                setPercentageChange('');
                            }}
                            className="absolute top-4 right-4 p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {alertSuccess ? (
                            /* Success Screen */
                            <div className="text-center py-6">
                                <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Alert Created!</h3>
                                <p className="text-sm text-gray-500">You'll be notified when the condition is met.</p>
                            </div>
                        ) : (
                            /* Alert Form */
                            <>
                                <div className="mb-6">
                                    <h3 className="text-xl font-bold text-gray-900 mb-1">Set Price Alert for {symbol}</h3>
                                    <p className="text-sm text-gray-500">Get notified when your price target is reached</p>
                                </div>

                                {/* Current Price */}
                                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Current Price</span>
                                        <span className="text-lg font-bold text-gray-900">${quote.c.toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* Alert Type */}
                                <div className="mb-6">
                                    <label className="block text-sm font-semibold text-gray-700 mb-3">Alert Type</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => {
                                                setAlertType('TARGET_PRICE');
                                                setAlertError('');
                                            }}
                                            className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                                                alertType === 'TARGET_PRICE'
                                                    ? 'bg-orange-600 text-white shadow-md'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                        >
                                            Target Price
                                        </button>
                                        <button
                                            onClick={() => {
                                                setAlertType('PERCENTAGE_CHANGE');
                                                setAlertError('');
                                            }}
                                            className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                                                alertType === 'PERCENTAGE_CHANGE'
                                                    ? 'bg-orange-600 text-white shadow-md'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                        >
                                            % Change
                                        </button>
                                    </div>
                                </div>

                                {/* Condition */}
                                <div className="mb-6">
                                    <label className="block text-sm font-semibold text-gray-700 mb-3">Condition</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => {
                                                setAlertCondition('ABOVE');
                                                setAlertError('');
                                            }}
                                            className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                                                alertCondition === 'ABOVE'
                                                    ? 'bg-green-600 text-white shadow-md'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                        >
                                            ↑ Above / Rise
                                        </button>
                                        <button
                                            onClick={() => {
                                                setAlertCondition('BELOW');
                                                setAlertError('');
                                            }}
                                            className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                                                alertCondition === 'BELOW'
                                                    ? 'bg-red-600 text-white shadow-md'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                        >
                                            ↓ Below / Drop
                                        </button>
                                    </div>
                                </div>

                                {/* Value Input */}
                                {alertType === 'TARGET_PRICE' ? (
                                    <div className="mb-6">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Target Price ($)
                                        </label>
                                        <input
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            value={targetPrice}
                                            onChange={(e) => {
                                                setTargetPrice(e.target.value);
                                                setAlertError('');
                                            }}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                            placeholder="Enter target price"
                                        />
                                        <p className="mt-2 text-xs text-gray-500">
                                            Alert will trigger when price {alertCondition === 'ABOVE' ? 'rises above' : 'falls below'} this value
                                        </p>
                                    </div>
                                ) : (
                                    <div className="mb-6">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Percentage Change (%)
                                        </label>
                                        <input
                                            type="number"
                                            min="0.1"
                                            step="0.1"
                                            value={percentageChange}
                                            onChange={(e) => {
                                                setPercentageChange(e.target.value);
                                                setAlertError('');
                                            }}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                            placeholder="Enter percentage"
                                        />
                                        <p className="mt-2 text-xs text-gray-500">
                                            Alert will trigger when price {alertCondition === 'ABOVE' ? 'increases' : 'decreases'} by this percentage
                                        </p>
                                    </div>
                                )}

                                {/* Error Message */}
                                {alertError && (
                                    <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
                                        <p className="text-sm text-red-600 font-medium">{alertError}</p>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            setShowAlertModal(false);
                                            setAlertError('');
                                            setTargetPrice('');
                                            setPercentageChange('');
                                        }}
                                        disabled={creatingAlert}
                                        className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleCreateAlert}
                                        disabled={creatingAlert || (alertType === 'TARGET_PRICE' ? !targetPrice : !percentageChange)}
                                        className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                                    >
                                        {creatingAlert ? (
                                            <>
                                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                </svg>
                                                Creating...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                                </svg>
                                                Create Alert
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Info */}
                                <p className="mt-4 text-xs text-center text-gray-400">
                                    You'll receive an email notification when the alert is triggered.
                                </p>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Compare Modal */}
            {showCompare && (
                <StockCompare
                    currentStock={{
                        symbol,
                        quote,
                        profile
                    }}
                    initialCompareSymbol={compareSymbol}
                    onClose={() => {
                        setShowCompare(false);
                        setCompareSymbol('');
                    }}
                />
            )}

            {/* Footer Notice */}
            <div className="text-center text-xs text-gray-400">
                <p>Data powered by Finnhub & Yahoo Finance · Updates every 5 minutes</p>
            </div>
        </div>
    );
}
