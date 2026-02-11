"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { Stock, SortBy, SortOrder } from "../types";

export default function StocksUI({ stocks }: { stocks: Stock[] }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<SortBy>('symbol');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

    // Filter stocks
    const filteredStocks = stocks.filter(stock => {
        if (!searchTerm) return true;
        const symbol = stock.symbol.toLowerCase();
        const name = stock.profile?.name?.toLowerCase() || '';
        const search = searchTerm.toLowerCase();
        return symbol.includes(search) || name.includes(search);
    });

    // Sort stocks
    const sortedStocks = [...filteredStocks].sort((a, b) => {
        let compareA: number | string = 0;
        let compareB: number | string = 0;

        switch (sortBy) {
            case 'symbol':
                compareA = a.symbol;
                compareB = b.symbol;
                break;
            case 'price':
                compareA = a.quote?.c || 0;
                compareB = b.quote?.c || 0;
                break;
            case 'change':
                compareA = a.quote?.d || 0;
                compareB = b.quote?.d || 0;
                break;
            case 'percent':
                compareA = a.quote?.dp || 0;
                compareB = b.quote?.dp || 0;
                break;
        }

        if (typeof compareA === 'string') {
            return sortOrder === 'asc'
                ? compareA.localeCompare(compareB as string)
                : (compareB as string).localeCompare(compareA);
        }

        const numA = compareA as number;
        const numB = compareB as number;
        return sortOrder === 'asc' ? numA - numB : numB - numA;
    });

    const toggleSort = (field: SortBy) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    };

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-1">Stock Market</h1>
                    <p className="text-sm text-gray-400">
                        Real-time stock prices · Updated every minute
                    </p>
                </div>
                <Link href="/h_stocks">
                    <button className="px-5 py-2.5 bg-white border border-gray-100 text-gray-900 font-semibold text-sm rounded-xl hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Overview
                    </button>
                </Link>
            </div>

            {/* Filters Bar */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                <div className="flex flex-wrap gap-4 items-end">
                    {/* Search Box */}
                    <div className="flex-1 min-w-75">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                            Search Stocks
                        </label>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                placeholder="Search by symbol or company name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all bg-white"
                            />
                        </div>
                    </div>

                    {/* Results Counter */}
                    <div className="w-48">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                            Results
                        </label>
                        <div className="px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-700 font-semibold">
                            {sortedStocks.length} stocks
                        </div>
                    </div>
                </div>
            </div>

            {/* Stocks Table */}
            {sortedStocks.length === 0 ? (
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">No Stocks Found</h3>
                    <p className="text-sm text-gray-400">Try adjusting your search terms</p>
                </div>
            ) : (
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    {/* Table Header */}
                    <div className="bg-gray-50 border-b border-gray-100 px-6 py-4">
                        <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            <div className="col-span-3 cursor-pointer hover:text-gray-900 transition-colors"
                                onClick={() => toggleSort('symbol')}>
                                Symbol {sortBy === 'symbol' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </div>
                            <div className="col-span-2 text-right cursor-pointer hover:text-gray-900 transition-colors"
                                onClick={() => toggleSort('price')}>
                                Price {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </div>
                            <div className="col-span-2 text-right cursor-pointer hover:text-gray-900 transition-colors"
                                onClick={() => toggleSort('change')}>
                                Change {sortBy === 'change' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </div>
                            <div className="col-span-2 text-right cursor-pointer hover:text-gray-900 transition-colors"
                                onClick={() => toggleSort('percent')}>
                                Change % {sortBy === 'percent' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </div>
                            <div className="col-span-3 text-right">
                                Actions
                            </div>
                        </div>
                    </div>

                    {/* Table Body */}
                    <div className="divide-y divide-gray-100">
                        {sortedStocks.map((stock) => {
                            const quote = stock.quote;
                            const profile = stock.profile;
                            const isPositive = (quote?.d || 0) >= 0;
                            const changeColor = isPositive ? 'text-emerald-600' : 'text-red-600';
                            const changeBg = isPositive ? 'bg-emerald-50' : 'bg-red-50';

                            return (
                                <div key={stock.symbol}
                                    className="px-6 py-4 hover:bg-gray-50 transition-colors">
                                    <div className="grid grid-cols-12 gap-4 items-center">
                                        {/* Symbol & Name */}
                                        <div className="col-span-3">
                                            <div className="font-bold text-gray-900 text-base">
                                                {stock.symbol}
                                            </div>
                                            {profile?.name && (
                                                <div className="text-xs text-gray-400 truncate">
                                                    {profile.name}
                                                </div>
                                            )}
                                        </div>

                                        {/* Current Price */}
                                        <div className="col-span-2 text-right">
                                            <div className="text-base font-bold text-gray-900">
                                                ${quote?.c.toFixed(2) || 'N/A'}
                                            </div>
                                        </div>

                                        {/* Change */}
                                        <div className="col-span-2 text-right">
                                            <div className={`text-sm font-semibold ${changeColor}`}>
                                                {isPositive ? '+' : ''}
                                                ${quote?.d.toFixed(2) || 'N/A'}
                                            </div>
                                        </div>

                                        {/* Change % */}
                                        <div className="col-span-2 text-right">
                                            <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg ${changeBg} ${changeColor} font-bold text-xs`}>
                                                <span>{isPositive ? '↑' : '↓'}</span>
                                                <span>{Math.abs(quote?.dp || 0).toFixed(2)}%</span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="col-span-3 text-right">
                                            <Link href={`/h_stocks/stocks/${stock.symbol}`}>
                                                <button className="px-4 py-2 bg-gray-900 text-white font-semibold text-sm rounded-xl hover:bg-gray-800 transition-all">
                                                    View Details
                                                </button>
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Market Status Notice */}
            <div className="text-center text-xs text-gray-400">
                <p>Data updates every 60 seconds during market hours</p>
            </div>
        </div>
    );
}
