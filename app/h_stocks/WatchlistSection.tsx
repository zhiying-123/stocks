'use client';

import Link from "next/link";
import { useState } from "react";
import type { WatchlistItem } from "./types";

export default function WatchlistSection({ items }: { items: WatchlistItem[] }) {
    const [removing, setRemoving] = useState<string | null>(null);

    async function handleRemove(symbol: string) {
        setRemoving(symbol);
        try {
            await fetch('/api/watchlist', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol }),
            });
            window.location.reload();
        } catch {
            setRemoving(null);
        }
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-5 rounded-full bg-gray-900" />
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Watchlist</h3>
                    <span className="text-xs text-gray-400 ml-1">({items.length})</span>
                </div>
                <Link
                    href="/h_stocks/stocks"
                    className="text-xs font-semibold text-gray-400 hover:text-gray-900 transition-colors"
                >
                    + Add stocks
                </Link>
            </div>

            {items.length === 0 ? (
                <div className="px-6 py-10 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <p className="text-sm text-gray-400 mb-1">No stocks in your watchlist</p>
                    <p className="text-xs text-gray-300">Go to Stock Market to add stocks you want to track</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-100">
                    {items.map((item) => {
                        const isPositive = (item.change ?? 0) >= 0;
                        return (
                            <div key={item.symbol} className="px-6 py-5 hover:bg-gray-50/50 transition-colors">
                                <div className="flex items-start justify-between gap-4 mb-3">
                                    <Link
                                        href={`/h_stocks/stocks/${item.symbol}`}
                                        className="flex items-center gap-3 min-w-0 flex-1"
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center shrink-0">
                                            <span className="text-sm font-bold text-white">{item.symbol.charAt(0)}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-base font-bold text-gray-900">{item.symbol}</p>
                                            {item.companyName && (
                                                <p className="text-xs text-gray-400 truncate">{item.companyName}</p>
                                            )}
                                        </div>
                                    </Link>
                                    <div className="text-right shrink-0">
                                        <p className="text-xl font-bold text-gray-900">
                                            {item.price != null ? `$${item.price.toFixed(2)}` : '—'}
                                        </p>
                                        {item.change != null && item.changePercent != null && (
                                            <p className={`text-sm font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {isPositive ? '+' : ''}{item.change.toFixed(2)} ({isPositive ? '+' : ''}{item.changePercent.toFixed(2)}%)
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleRemove(item.symbol)}
                                        disabled={removing === item.symbol}
                                        className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all shrink-0 disabled:opacity-50"
                                        title="Remove from watchlist"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Quick Stats Grid */}
                                <div className="grid grid-cols-4 gap-3 pt-3 border-t border-gray-100">
                                    {item.open != null && (
                                        <div>
                                            <p className="text-xs text-gray-400 mb-0.5">Open</p>
                                            <p className="text-sm font-semibold text-gray-900">${item.open.toFixed(2)}</p>
                                        </div>
                                    )}
                                    {item.high != null && (
                                        <div>
                                            <p className="text-xs text-gray-400 mb-0.5">High</p>
                                            <p className="text-sm font-semibold text-emerald-600">${item.high.toFixed(2)}</p>
                                        </div>
                                    )}
                                    {item.low != null && (
                                        <div>
                                            <p className="text-xs text-gray-400 mb-0.5">Low</p>
                                            <p className="text-sm font-semibold text-red-600">${item.low.toFixed(2)}</p>
                                        </div>
                                    )}
                                    {item.previousClose != null && (
                                        <div>
                                            <p className="text-xs text-gray-400 mb-0.5">Prev Close</p>
                                            <p className="text-sm font-semibold text-gray-900">${item.previousClose.toFixed(2)}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Additional Stats */}
                                {(item.volume != null || item.marketCap != null) && (
                                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50">
                                        {item.volume != null && (
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                </svg>
                                                <span className="text-xs text-gray-500">Vol: {(item.volume / 1000000).toFixed(2)}M</span>
                                            </div>
                                        )}
                                        {item.marketCap != null && (
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <span className="text-xs text-gray-500">Cap: ${(item.marketCap / 1000).toFixed(2)}B</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
