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
} from 'recharts';

interface Holding {
    symbol: string;
    companyName: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
    totalCost: number;
    currentValue: number;
    gainLoss: number;
    gainLossPercent: number;
    industry: string;
}

interface Metrics {
    totalInvested: number;
    totalCurrentValue: number;
    totalGainLoss: number;
    totalGainLossPercent: number;
    totalPortfolioValue: number;
    holdingsCount: number;
}

interface IndustryData {
    industry: string;
    value: number;
    percentage: number;
}

interface PerformanceData {
    date: string;
    bought: number;
    sold: number;
    net: number;
}

const COLORS = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ef4444', // red
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
];

export default function PortfolioAnalytics({
    holdings,
    currency,
    cashBalance,
    metrics,
    industryDistribution,
    performanceData,
}: {
    holdings: Holding[];
    currency: string;
    cashBalance: number;
    metrics: Metrics;
    industryDistribution: IndustryData[];
    performanceData: PerformanceData[];
}) {
    const [selectedView, setSelectedView] = useState<'holdings' | 'industry'>('holdings');

    // Prepare data for holdings pie chart
    const holdingsPieData = holdings.map(h => ({
        name: h.symbol,
        value: h.currentValue,
        percentage: (h.currentValue / metrics.totalCurrentValue) * 100,
    }));

    // Add cash to pie chart
    if (cashBalance > 0) {
        holdingsPieData.push({
            name: 'Cash',
            value: cashBalance,
            percentage: (cashBalance / metrics.totalPortfolioValue) * 100,
        });
    }

    // Calculate risk metrics
    const volatility = holdings.length > 0
        ? Math.sqrt(holdings.reduce((sum, h) => sum + Math.pow(h.gainLossPercent, 2), 0) / holdings.length)
        : 0;

    const largestHolding = holdings.length > 0
        ? Math.max(...holdings.map(h => (h.currentValue / metrics.totalCurrentValue) * 100))
        : 0;

    const diversificationScore = holdings.length > 0
        ? Math.min(100, (holdings.length / 10) * 100)
        : 0;

    const getRiskLevel = () => {
        if (volatility > 30 || largestHolding > 50) return { level: 'High', color: 'red' };
        if (volatility > 15 || largestHolding > 30) return { level: 'Medium', color: 'amber' };
        return { level: 'Low', color: 'emerald' };
    };

    const risk = getRiskLevel();

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Portfolio Analytics</h1>
                    <p className="text-sm text-gray-500 mt-1">Comprehensive analysis of your investments</p>
                </div>
                <Link href="/h_stocks">
                    <button className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white hover:bg-gray-50 rounded-xl transition-all border border-gray-200">
                        ← Back to Overview
                    </button>
                </Link>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                        </div>
                        <span className="text-xs font-semibold text-gray-400 uppercase">Total Value</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                        {currency} {metrics.totalPortfolioValue.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </p>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                        <span className="text-xs font-semibold text-gray-400 uppercase">Total Gain/Loss</span>
                    </div>
                    <p className={`text-2xl font-bold ${metrics.totalGainLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {metrics.totalGainLoss >= 0 ? '+' : ''}{currency} {Math.abs(metrics.totalGainLoss).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </p>
                    <p className={`text-xs font-semibold mt-1 ${metrics.totalGainLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {metrics.totalGainLoss >= 0 ? '↑' : '↓'} {Math.abs(metrics.totalGainLossPercent).toFixed(2)}%
                    </p>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <span className="text-xs font-semibold text-gray-400 uppercase">Holdings</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{metrics.holdingsCount}</p>
                    <p className="text-xs text-gray-400 mt-1">Different stocks</p>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`w-8 h-8 rounded-lg bg-${risk.color}-50 flex items-center justify-center`}>
                            <svg className={`w-4 h-4 text-${risk.color}-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <span className="text-xs font-semibold text-gray-400 uppercase">Risk Level</span>
                    </div>
                    <p className={`text-2xl font-bold text-${risk.color}-600`}>{risk.level}</p>
                    <p className="text-xs text-gray-400 mt-1">Volatility: {volatility.toFixed(1)}%</p>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Portfolio Distribution */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-5 rounded-full bg-gray-900" />
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Portfolio Distribution</h3>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setSelectedView('holdings')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${selectedView === 'holdings'
                                        ? 'bg-gray-900 text-white'
                                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                Holdings
                            </button>
                            <button
                                onClick={() => setSelectedView('industry')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${selectedView === 'industry'
                                        ? 'bg-gray-900 text-white'
                                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                Industry
                            </button>
                        </div>
                    </div>

                    {holdings.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={selectedView === 'holdings' ? holdingsPieData : industryDistribution.map(i => ({ name: i.industry, value: i.value, percentage: i.percentage }))}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={(entry: any) => `${entry.percentage.toFixed(1)}%`}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {(selectedView === 'holdings' ? holdingsPieData : industryDistribution).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload[0]) {
                                            return (
                                                <div className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm shadow-xl">
                                                    <p className="font-semibold">{payload[0].name}</p>
                                                    <p>{currency} {Number(payload[0].value).toLocaleString('en-MY', { minimumFractionDigits: 2 })}</p>
                                                    <p className="text-gray-300 text-xs">{payload[0].payload.percentage.toFixed(2)}%</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="py-12 text-center text-gray-400 text-sm">
                            No holdings data available
                        </div>
                    )}
                </div>

                {/* Risk Analysis */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-1.5 h-5 rounded-full bg-gray-900" />
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Risk Analysis</h3>
                    </div>

                    <div className="space-y-5">
                        {/* Portfolio Volatility */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-gray-700">Portfolio Volatility</span>
                                <span className="text-sm font-bold text-gray-900">{volatility.toFixed(2)}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${volatility > 30 ? 'bg-red-500' : volatility > 15 ? 'bg-amber-500' : 'bg-emerald-500'
                                        }`}
                                    style={{ width: `${Math.min(volatility * 2, 100)}%` }}
                                />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                                {volatility > 30 ? 'High risk portfolio' : volatility > 15 ? 'Moderate risk' : 'Low risk portfolio'}
                            </p>
                        </div>

                        {/* Concentration Risk */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-gray-700">Largest Holding</span>
                                <span className="text-sm font-bold text-gray-900">{largestHolding.toFixed(2)}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${largestHolding > 50 ? 'bg-red-500' : largestHolding > 30 ? 'bg-amber-500' : 'bg-emerald-500'
                                        }`}
                                    style={{ width: `${largestHolding}%` }}
                                />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                                {largestHolding > 50 ? 'High concentration risk' : largestHolding > 30 ? 'Moderate concentration' : 'Well diversified'}
                            </p>
                        </div>

                        {/* Diversification Score */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-gray-700">Diversification Score</span>
                                <span className="text-sm font-bold text-gray-900">{diversificationScore.toFixed(0)}/100</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all bg-blue-500"
                                    style={{ width: `${diversificationScore}%` }}
                                />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                                Based on number of holdings ({metrics.holdingsCount} stocks)
                            </p>
                        </div>

                        {/* Recommendations */}
                        <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                            <p className="text-xs font-semibold text-blue-900 mb-2">💡 Recommendations</p>
                            <ul className="text-xs text-blue-800 space-y-1">
                                {largestHolding > 40 && (
                                    <li>• Consider reducing concentration in your largest holding</li>
                                )}
                                {metrics.holdingsCount < 5 && (
                                    <li>• Add more stocks to improve diversification</li>
                                )}
                                {industryDistribution.length > 0 && industryDistribution[0].percentage > 60 && (
                                    <li>• Diversify across different industries</li>
                                )}
                                {volatility < 10 && (
                                    <li>• Your portfolio has low volatility - good for stability</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Transaction Activity */}
            {performanceData.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-1.5 h-5 rounded-full bg-gray-900" />
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Transaction Activity</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={performanceData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                            <XAxis
                                dataKey="date"
                                tick={{ fill: '#9ca3af', fontSize: 11 }}
                                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            />
                            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="bg-gray-900 text-white p-3 rounded-lg text-sm shadow-xl">
                                                <p className="font-semibold mb-2">
                                                    {new Date(payload[0].payload.date).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })}
                                                </p>
                                                <p className="text-emerald-400">Buy: {currency} {payload[0].payload.bought.toFixed(2)}</p>
                                                <p className="text-red-400">Sell: {currency} {payload[0].payload.sold.toFixed(2)}</p>
                                                <p className="text-gray-300 text-xs mt-1">Net: {currency} {payload[0].payload.net.toFixed(2)}</p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar dataKey="bought" fill="#10b981" name="Buy" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="sold" fill="#ef4444" name="Sell" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Holdings Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                    <div className="w-1.5 h-5 rounded-full bg-gray-900" />
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Holdings Performance</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50">
                                <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Stock</th>
                                <th className="text-right py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Quantity</th>
                                <th className="text-right py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Avg Price</th>
                                <th className="text-right py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Current</th>
                                <th className="text-right py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Value</th>
                                <th className="text-right py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Gain/Loss</th>
                                <th className="text-right py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Return</th>
                            </tr>
                        </thead>
                        <tbody>
                            {holdings.map((holding) => (
                                <tr key={holding.symbol} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                    <td className="py-4 px-6">
                                        <div>
                                            <p className="font-semibold text-gray-900 text-sm">{holding.symbol}</p>
                                            <p className="text-xs text-gray-400">{holding.companyName}</p>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6 text-right text-sm font-medium text-gray-900">
                                        {holding.quantity}
                                    </td>
                                    <td className="py-4 px-6 text-right text-sm text-gray-600">
                                        ${holding.avgPrice.toFixed(2)}
                                    </td>
                                    <td className="py-4 px-6 text-right text-sm font-semibold text-gray-900">
                                        ${holding.currentPrice.toFixed(2)}
                                    </td>
                                    <td className="py-4 px-6 text-right text-sm font-bold text-gray-900">
                                        {currency} {holding.currentValue.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className={`py-4 px-6 text-right text-sm font-bold ${holding.gainLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {holding.gainLoss >= 0 ? '+' : ''}{currency} {Math.abs(holding.gainLoss).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${holding.gainLossPercent >= 0
                                                ? 'bg-emerald-50 text-emerald-700'
                                                : 'bg-red-50 text-red-700'
                                            }`}>
                                            {holding.gainLossPercent >= 0 ? '↑' : '↓'}
                                            {Math.abs(holding.gainLossPercent).toFixed(2)}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
