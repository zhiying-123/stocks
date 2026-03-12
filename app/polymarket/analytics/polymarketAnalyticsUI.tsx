'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    Legend,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    LineChart,
    Line,
    Area,
    AreaChart,
} from 'recharts';

interface Holding {
    holding_id: number;
    market_id: string;
    outcome: string;
    quantity: number;
    avg_price: number;
    category: string | null;
    created_at: Date;
    updated_at: Date;
}

interface Transaction {
    transaction_id: number;
    market_id: string;
    outcome: string;
    transaction_type: string;
    quantity: number;
    price: number;
    total_amount: number;
    currency: string;
    category: string | null;
    transaction_date: Date;
}

// Soft color palette (pastel/light colors)
const PASTEL_COLORS = [
    '#A8DADC', // Light cyan
    '#E9C46A', // Light gold
    '#F4A261', // Light coral
    '#E76F51', // Light terracotta
    '#B8B8D1', // Light lavender
    '#C9ADA7', // Light taupe
    '#F1FAEE', // Off white
    '#DDA15E', // Light bronze
];

const OUTCOME_COLORS = {
    YES: '#93C5FD', // Light blue
    NO: '#FCA5A5', // Light red
};

export default function PolymarketAnalyticsUI({
    holdings,
    transactions,
    currency,
}: {
    holdings: Holding[];
    transactions: Transaction[];
    currency: string;
}) {
    const [selectedView, setSelectedView] = useState<'category' | 'outcome'>('category');

    // Exchange rates
    const EXCHANGE_RATES = {
        USD: 1,
        MYR: 4.50,
        SGD: 1.35,
    };
    const exchangeRate = EXCHANGE_RATES[currency as keyof typeof EXCHANGE_RATES] || 1;

    // Calculate metrics
    const totalInvestedUSD = holdings.reduce((sum, h) => sum + h.quantity * h.avg_price, 0);
    const totalCurrentUSD = holdings.reduce((sum, h) => sum + h.quantity * 0.5, 0); // Simplified: using 0.5 as current price
    const totalInvested = totalInvestedUSD * exchangeRate;
    const totalCurrent = totalCurrentUSD * exchangeRate;
    const totalGainLoss = totalCurrent - totalInvested;
    const totalGainLossPercent = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;

    // Calculate win rate (simplified)
    const completedTrades = transactions.filter(t => t.transaction_type === 'SELL').length;
    const winningTrades = transactions.filter(t => t.transaction_type === 'SELL' && t.price > 0.5).length;
    const winRate = completedTrades > 0 ? (winningTrades / completedTrades) * 100 : 0;

    // Category distribution
    const categoryData = holdings.reduce((acc: any[], holding) => {
        const category = holding.category || 'Other';
        const value = holding.quantity * holding.avg_price * exchangeRate;
        const existing = acc.find(item => item.name === category);

        if (existing) {
            existing.value += value;
        } else {
            acc.push({ name: category, value });
        }
        return acc;
    }, []);

    // Calculate percentages
    const totalValue = categoryData.reduce((sum, item) => sum + item.value, 0);
    categoryData.forEach(item => {
        item.percentage = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
    });

    // Outcome distribution (YES vs NO)
    const outcomeData = holdings.reduce((acc: any[], holding) => {
        const existing = acc.find(item => item.name === holding.outcome);
        const value = holding.quantity * holding.avg_price * exchangeRate;

        if (existing) {
            existing.value += value;
        } else {
            acc.push({ name: holding.outcome, value });
        }
        return acc;
    }, []);

    // Monthly trading volume
    const monthlyVolume = transactions.reduce((acc: any[], tx) => {
        const month = new Date(tx.transaction_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        const value = tx.total_amount * exchangeRate;
        const existing = acc.find(item => item.month === month);

        if (existing) {
            if (tx.transaction_type === 'BUY') {
                existing.bought += value;
            } else {
                existing.sold += value;
            }
        } else {
            acc.push({
                month,
                bought: tx.transaction_type === 'BUY' ? value : 0,
                sold: tx.transaction_type === 'SELL' ? value : 0,
            });
        }
        return acc;
    }, []);

    // Top markets by value
    const topMarkets = holdings
        .map(h => ({
            marketId: h.market_id.slice(0, 12) + '...',
            category: h.category || 'Other',
            value: h.quantity * h.avg_price * exchangeRate,
            outcome: h.outcome,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    if (holdings.length === 0 && transactions.length === 0) {
        return (
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Market Analytics</h1>
                        <p className="text-sm text-gray-400 mt-1">Insights and trends from your predictions</p>
                    </div>
                    <Link href="/polymarket/overview">
                        <button className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white hover:bg-gray-50 rounded-xl transition-all border border-gray-100">
                            ← Back to Overview
                        </button>
                    </Link>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                    <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-500 mb-1">No data available</p>
                    <p className="text-xs text-gray-400 mb-4">Start trading to see your analytics</p>
                    <Link
                        href="/polymarket"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors"
                    >
                        Browse Markets
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-340 mx-auto px-6 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Market Analytics</h1>
                    <p className="text-sm text-gray-400 mt-1">Comprehensive analysis of your predictions</p>
                </div>
                <Link href="/polymarket/overview">
                    <button className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white hover:bg-gray-50 rounded-xl transition-all border border-gray-100">
                        ← Back to Overview
                    </button>
                </Link>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                        </div>
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Invested</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                        {currency} {totalInvested.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </p>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`w-8 h-8 rounded-lg ${totalGainLoss >= 0 ? 'bg-emerald-50' : 'bg-red-50'} flex items-center justify-center`}>
                            <svg className={`w-4 h-4 ${totalGainLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Unrealised P/L</span>
                    </div>
                    <p className={`text-2xl font-bold ${totalGainLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {totalGainLoss >= 0 ? '+' : ''}{currency} {Math.abs(totalGainLoss).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </p>
                    <p className={`text-xs font-semibold mt-1 ${totalGainLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {totalGainLoss >= 0 ? '↑' : '↓'} {Math.abs(totalGainLossPercent).toFixed(2)}%
                    </p>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Active Positions</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{holdings.length}</p>
                    <p className="text-xs text-gray-400 mt-1">Across {new Set(holdings.map(h => h.category)).size} categories</p>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                        </div>
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Win Rate</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{winRate.toFixed(1)}%</p>
                    <p className="text-xs text-gray-400 mt-1">{winningTrades}/{completedTrades} winning trades</p>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Distribution Charts */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Portfolio Distribution</h3>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setSelectedView('category')}
                                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${selectedView === 'category'
                                    ? 'bg-gray-900 text-white'
                                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                Category
                            </button>
                            <button
                                onClick={() => setSelectedView('outcome')}
                                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${selectedView === 'outcome'
                                    ? 'bg-gray-900 text-white'
                                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                Outcome
                            </button>
                        </div>
                    </div>

                    <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                            <Pie
                                data={selectedView === 'category' ? categoryData : outcomeData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={(entry: any) => {
                                    const data = selectedView === 'category' ? categoryData : outcomeData;
                                    const total = data.reduce((sum, item) => sum + item.value, 0);
                                    const percent = total > 0 ? (entry.value / total * 100).toFixed(1) : '0.0';
                                    return `${entry.name}: ${percent}%`;
                                }}
                                outerRadius={90}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {(selectedView === 'category' ? categoryData : outcomeData).map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={selectedView === 'outcome' ? OUTCOME_COLORS[entry.name as keyof typeof OUTCOME_COLORS] : PASTEL_COLORS[index % PASTEL_COLORS.length]}
                                    />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                }}
                                formatter={(value: number | undefined) => value ? [`${currency} ${value.toFixed(2)}`, 'Value'] : ['N/A', 'Value']}
                            />
                            <Legend
                                verticalAlign="bottom"
                                height={36}
                                wrapperStyle={{ fontSize: '12px' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Monthly Volume */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-6">Monthly Trading Volume</h3>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={monthlyVolume}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                }}
                                formatter={(value: number | undefined) => value ? `${currency} ${value.toFixed(2)}` : 'N/A'}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                            <Bar dataKey="bought" fill="#93C5FD" name="Bought" radius={[8, 8, 0, 0]} />
                            <Bar dataKey="sold" fill="#FCA5A5" name="Sold" radius={[8, 8, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Top Markets */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-5 rounded-full bg-gray-900" />
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Top Markets by Value</h3>
                    </div>
                </div>

                <div className="divide-y divide-gray-50">
                    {topMarkets.length > 0 ? (
                        topMarkets.map((market, index) => (
                            <div key={index} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                                <div className="shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                                    <span className="text-sm font-bold text-gray-600">#{index + 1}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="text-sm font-semibold text-gray-900 truncate">{market.marketId}</p>
                                        {market.category && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
                                                {market.category}
                                            </span>
                                        )}
                                    </div>
                                    <span className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-full ${market.outcome === 'YES'
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                        : 'bg-red-50 text-red-700 border border-red-200'
                                        }`}>
                                        {market.outcome}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-gray-900">
                                        {currency} {market.value.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="px-6 py-12 text-center">
                            <p className="text-sm text-gray-400">No markets to display</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
