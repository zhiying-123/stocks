'use client';

import { useState, useEffect } from 'react';
import type { StockQuote, StockProfile } from '../../types';

interface CompareData {
    symbol: string;
    quote: StockQuote | null;
    profile: StockProfile | null;
}

export default function StockCompare({
    currentStock,
    onClose,
    initialCompareSymbol
}: {
    currentStock: CompareData;
    onClose: () => void;
    initialCompareSymbol?: string;
}) {
    const [compareSymbol, setCompareSymbol] = useState(initialCompareSymbol || '');
    const [compareStock, setCompareStock] = useState<CompareData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Auto-load comparison if initial symbol is provided
    useEffect(() => {
        if (initialCompareSymbol) {
            const loadInitialComparison = async () => {
                setLoading(true);
                setError('');

                try {
                    const response = await fetch(`/api/stock/${initialCompareSymbol.toUpperCase()}`);
                    if (!response.ok) throw new Error('Failed to fetch stock');

                    const data = await response.json();
                    setCompareStock({
                        symbol: initialCompareSymbol.toUpperCase(),
                        quote: data.quote,
                        profile: data.profile
                    });
                } catch (err) {
                    setError('Unable to fetch stock data, please check the stock symbol');
                    setCompareStock(null);
                } finally {
                    setLoading(false);
                }
            };

            loadInitialComparison();
        }
    }, [initialCompareSymbol]);

    const handleCompare = async () => {
        if (!compareSymbol) return;

        setLoading(true);
        setError('');

        try {
            const response = await fetch(`/api/stock/${compareSymbol.toUpperCase()}`);
            if (!response.ok) throw new Error('Failed to fetch stock');

            const data = await response.json();
            setCompareStock({
                symbol: compareSymbol.toUpperCase(),
                quote: data.quote,
                profile: data.profile
            });
        } catch (err) {
            setError('Unable to fetch stock data, please check the stock symbol');
            setCompareStock(null);
        } finally {
            setLoading(false);
        }
    };

    const renderComparison = (
        label: string,
        value1: number | string | null | undefined,
        value2: number | string | null | undefined,
        format: (val: number | string) => string = (v) => String(v),
        higherIsBetter: boolean = true
    ) => {
        if (value1 == null || value2 == null) return null;

        const num1 = typeof value1 === 'string' ? parseFloat(value1) : value1;
        const num2 = typeof value2 === 'string' ? parseFloat(value2) : value2;

        const isHigher1 = num1 > num2;
        const isHigher2 = num2 > num1;
        const winner1 = higherIsBetter ? isHigher1 : !isHigher1 && num1 !== num2;
        const winner2 = higherIsBetter ? isHigher2 : !isHigher2 && num1 !== num2;

        return (
            <div className="border-b border-gray-100 py-4">
                <p className="text-xs text-gray-400 mb-3 font-medium">{label}</p>
                <div className="grid grid-cols-2 gap-4">
                    <div className={`p-3 rounded-lg ${winner1 ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50'}`}>
                        <p className={`font-bold text-lg ${winner1 ? 'text-emerald-700' : 'text-gray-900'}`}>
                            {format(value1)}
                        </p>
                        {winner1 && <span className="text-xs text-emerald-600">✓ Better</span>}
                    </div>
                    <div className={`p-3 rounded-lg ${winner2 ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50'}`}>
                        <p className={`font-bold text-lg ${winner2 ? 'text-emerald-700' : 'text-gray-900'}`}>
                            {format(value2)}
                        </p>
                        {winner2 && <span className="text-xs text-emerald-600">✓ Better</span>}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-slideUp">
                {/* Header */}
                <div className="bg-gray-900 text-white p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Stock Comparison</h2>
                            <p className="text-sm text-gray-300 mt-0.5">Compare performance and data between two stocks</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-all group"
                    >
                        <svg className="w-6 h-6 group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    {/* Dropdown Section */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select another stock to compare
                        </label>
                        <div className="flex gap-3">
                            <select
                                value={compareSymbol}
                                onChange={(e) => {
                                    setCompareSymbol(e.target.value);
                                    if (e.target.value) {
                                        // Auto-compare when selection changes
                                        setLoading(true);
                                        setError('');
                                        fetch(`/api/stock/${e.target.value}`)
                                            .then(res => res.json())
                                            .then(data => {
                                                setCompareStock({
                                                    symbol: e.target.value,
                                                    quote: data.quote,
                                                    profile: data.profile
                                                });
                                                setLoading(false);
                                            })
                                            .catch(() => {
                                                setError('Unable to fetch stock data');
                                                setCompareStock(null);
                                                setLoading(false);
                                            });
                                    }
                                }}
                                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white shadow-sm hover:border-gray-400 transition-colors"
                            >
                                <option value="">Choose a stock...</option>
                                <optgroup label="Popular Stocks" className="font-semibold">
                                    <option value="AAPL">AAPL - Apple Inc.</option>
                                    <option value="MSFT">MSFT - Microsoft Corporation</option>
                                    <option value="GOOGL">GOOGL - Alphabet Inc.</option>
                                    <option value="AMZN">AMZN - Amazon.com Inc.</option>
                                    <option value="TSLA">TSLA - Tesla Inc.</option>
                                    <option value="META">META - Meta Platforms Inc.</option>
                                    <option value="NVDA">NVDA - NVIDIA Corporation</option>
                                    <option value="BRK.B">BRK.B - Berkshire Hathaway</option>
                                    <option value="JPM">JPM - JPMorgan Chase</option>
                                    <option value="V">V - Visa Inc.</option>
                                    <option value="WMT">WMT - Walmart Inc.</option>
                                    <option value="JNJ">JNJ - Johnson & Johnson</option>
                                    <option value="PG">PG - Procter & Gamble</option>
                                    <option value="MA">MA - Mastercard Inc.</option>
                                    <option value="DIS">DIS - Walt Disney Company</option>
                                    <option value="NFLX">NFLX - Netflix Inc.</option>
                                    <option value="BAC">BAC - Bank of America</option>
                                    <option value="ADBE">ADBE - Adobe Inc.</option>
                                    <option value="CRM">CRM - Salesforce Inc.</option>
                                    <option value="ORCL">ORCL - Oracle Corporation</option>
                                </optgroup>
                            </select>
                        </div>
                        {error && (
                            <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                {error}
                            </p>
                        )}
                    </div>

                    {/* Comparison Result */}
                    {compareStock && compareStock.quote && (
                        <div className="space-y-6">
                            {/* Stock Headers */}
                            <div className="grid grid-cols-2 gap-6 mb-6">
                                <div className="text-center p-6 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all">
                                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-900 mb-3 shadow-lg">
                                        <span className="text-white font-bold text-2xl">{currentStock.symbol.charAt(0)}</span>
                                    </div>
                                    <h3 className="font-bold text-xl text-gray-900 mb-1">{currentStock.symbol}</h3>
                                    {currentStock.profile?.name && (
                                        <p className="text-xs text-gray-500 px-4">{currentStock.profile.name}</p>
                                    )}
                                    {currentStock.quote && (
                                        <div className="mt-3 pt-3 border-t border-gray-200">
                                            <p className="text-2xl font-bold text-gray-900">${currentStock.quote.c.toFixed(2)}</p>
                                            <p className={`text-sm font-semibold ${currentStock.quote.d >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {currentStock.quote.d >= 0 ? '↗' : '↘'} {currentStock.quote.dp.toFixed(2)}%
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <div className="text-center p-6 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all">
                                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-3 shadow-lg">
                                        <span className="text-white font-bold text-2xl">{compareStock.symbol.charAt(0)}</span>
                                    </div>
                                    <h3 className="font-bold text-xl text-gray-900 mb-1">{compareStock.symbol}</h3>
                                    {compareStock.profile?.name && (
                                        <p className="text-xs text-gray-500 px-4">{compareStock.profile.name}</p>
                                    )}
                                    {compareStock.quote && (
                                        <div className="mt-3 pt-3 border-t border-blue-200">
                                            <p className="text-2xl font-bold text-gray-900">${compareStock.quote.c.toFixed(2)}</p>
                                            <p className={`text-sm font-semibold ${compareStock.quote.d >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {compareStock.quote.d >= 0 ? '↗' : '↘'} {compareStock.quote.dp.toFixed(2)}%
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Price Comparison */}
                            <div className="bg-white border border-gray-200 rounded-xl p-6">
                                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <div className="w-1 h-4 bg-gray-900 rounded-full" />
                                    Price Comparison
                                </h3>

                                {renderComparison(
                                    'Current Price',
                                    currentStock.quote?.c,
                                    compareStock.quote?.c,
                                    (v) => `$${Number(v).toFixed(2)}`,
                                    true
                                )}

                                {renderComparison(
                                    'Today Change',
                                    currentStock.quote?.d,
                                    compareStock.quote?.d,
                                    (v) => {
                                        const num = Number(v);
                                        return `${num >= 0 ? '+' : ''}$${num.toFixed(2)}`;
                                    },
                                    true
                                )}

                                {renderComparison(
                                    'Change Percent (%)',
                                    currentStock.quote?.dp,
                                    compareStock.quote?.dp,
                                    (v) => {
                                        const num = Number(v);
                                        return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
                                    },
                                    true
                                )}

                                {renderComparison(
                                    'Open Price',
                                    currentStock.quote?.o,
                                    compareStock.quote?.o,
                                    (v) => `$${Number(v).toFixed(2)}`,
                                    true
                                )}

                                {renderComparison(
                                    'High Price',
                                    currentStock.quote?.h,
                                    compareStock.quote?.h,
                                    (v) => `$${Number(v).toFixed(2)}`,
                                    true
                                )}

                                {renderComparison(
                                    'Low Price',
                                    currentStock.quote?.l,
                                    compareStock.quote?.l,
                                    (v) => `$${Number(v).toFixed(2)}`,
                                    false
                                )}

                                {renderComparison(
                                    'Previous Close',
                                    currentStock.quote?.pc,
                                    compareStock.quote?.pc,
                                    (v) => `$${Number(v).toFixed(2)}`,
                                    true
                                )}
                            </div>

                            {/* Company Info Comparison */}
                            {currentStock.profile?.marketCapitalization && compareStock.profile?.marketCapitalization && (
                                <div className="bg-white border border-gray-200 rounded-xl p-6">
                                    <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <div className="w-1 h-4 bg-gray-900 rounded-full" />
                                        Company Information
                                    </h3>

                                    {renderComparison(
                                        'Market Cap',
                                        currentStock.profile?.marketCapitalization,
                                        compareStock.profile?.marketCapitalization,
                                        (v) => `$${(Number(v) / 1000).toFixed(2)}B`,
                                        true
                                    )}
                                </div>
                            )}

                            {/* Summary */}
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                                <h3 className="text-sm font-bold text-blue-900 mb-2">Comparison Summary</h3>
                                <p className="text-sm text-blue-700">
                                    {currentStock.quote && compareStock.quote && (
                                        currentStock.quote.c > compareStock.quote.c
                                            ? `${currentStock.symbol} has a higher stock price than ${compareStock.symbol} by $${(currentStock.quote.c - compareStock.quote.c).toFixed(2)}`
                                            : `${compareStock.symbol} has a higher stock price than ${currentStock.symbol} by $${(compareStock.quote.c - currentStock.quote.c).toFixed(2)}`
                                    )}
                                    {currentStock.quote && compareStock.quote && (
                                        currentStock.quote.dp > compareStock.quote.dp
                                            ? `, ${currentStock.symbol} has a better daily performance (+${Math.abs(currentStock.quote.dp - compareStock.quote.dp).toFixed(2)}%)`
                                            : compareStock.quote.dp > currentStock.quote.dp
                                                ? `, ${compareStock.symbol} has a better daily performance (+${Math.abs(compareStock.quote.dp - currentStock.quote.dp).toFixed(2)}%)`
                                                : `, both have the same daily performance`
                                    )}
                                </p>
                            </div>
                        </div>
                    )}

                    {!compareStock && !loading && (
                        <div className="text-center py-16">
                            <div className="relative inline-block">
                                <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <div className="absolute -top-1 -right-1 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                </div>
                            </div>
                            <p className="text-gray-600 text-base font-medium mb-2">Ready to Compare</p>
                            <p className="text-gray-400 text-sm max-w-xs mx-auto">Select a stock from the dropdown above to start analyzing and comparing</p>
                        </div>
                    )}

                    {loading && (
                        <div className="text-center py-16">
                            <div className="w-16 h-16 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-gray-600 font-medium">Loading comparison data...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
