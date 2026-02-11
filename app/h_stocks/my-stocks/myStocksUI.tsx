'use client';

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Holding {
    symbol: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number | null;
    change: number | null;
    changePercent: number | null;
}

export default function MyStocksUI({ holdings, currency }: { holdings: Holding[]; currency: string }) {
    const router = useRouter();
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState<'BUY' | 'SELL'>('BUY');
    const [selectedStock, setSelectedStock] = useState<Holding | null>(null);
    const [quantity, setQuantity] = useState('1');
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // Exchange rates (stock prices in USD, need to convert to wallet currency)
    const EXCHANGE_RATES_FROM_USD = {
        USD: 1,
        MYR: 4.50,  // 1 USD = 4.50 MYR
        SGD: 1.35,  // 1 USD = 1.35 SGD
    };

    // Convert USD to wallet currency
    const exchangeRate = EXCHANGE_RATES_FROM_USD[currency as keyof typeof EXCHANGE_RATES_FROM_USD] || 1;

    // Calculate totals in wallet currency
    const totalInvestedUSD = holdings.reduce((sum, h) => sum + h.quantity * h.avgPrice, 0);
    const totalCurrentUSD = holdings.reduce((sum, h) => sum + h.quantity * (h.currentPrice ?? h.avgPrice), 0);

    const totalInvested = totalInvestedUSD * exchangeRate;
    const totalCurrent = totalCurrentUSD * exchangeRate;
    const totalGainLoss = totalCurrent - totalInvested;
    const totalGainPercent = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;
    const isOverallPositive = totalGainLoss >= 0;

    function openModal(type: 'BUY' | 'SELL', stock: Holding) {
        setModalType(type);
        setSelectedStock(stock);
        setQuantity('1');
        setError('');
        setSuccess(false);
        setShowModal(true);
    }

    function closeModal() {
        setShowModal(false);
        setSelectedStock(null);
        setQuantity('1');
        setError('');
        setSuccess(false);
    }

    async function handleTrade() {
        if (!selectedStock) return;

        const qty = parseInt(quantity);
        if (!qty || qty <= 0) {
            setError('Please enter a valid quantity');
            return;
        }

        if (modalType === 'SELL' && qty > selectedStock.quantity) {
            setError(`You only have ${selectedStock.quantity} shares`);
            return;
        }

        setProcessing(true);
        setError('');

        try {
            const endpoint = modalType === 'BUY' ? '/api/stocks/buy' : '/api/stocks/sell';
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol: selectedStock.symbol,
                    quantity: qty,
                    pricePerShare: selectedStock.currentPrice ?? selectedStock.avgPrice,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => {
                    closeModal();
                    router.refresh();
                }, 1500);
            } else {
                setError(data.error || `Failed to ${modalType.toLowerCase()} stock`);
            }
        } catch (error) {
            console.error('Trade error:', error);
            setError('Network error, please try again');
        } finally {
            setProcessing(false);
        }
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">My Stocks</h1>
                <p className="text-sm text-gray-400 mt-1">Your current stock holdings</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Invested</span>
                    <p className="text-2xl font-bold text-gray-900 mt-2">
                        {currency} {totalInvested.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Current Value</span>
                    <p className="text-2xl font-bold text-gray-900 mt-2">
                        {currency} {totalCurrent.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Unrealised P/L</span>
                    <p className={`text-2xl font-bold mt-2 ${isOverallPositive ? 'text-emerald-700' : 'text-red-700'}`}>
                        {isOverallPositive ? '+' : ''}{currency} {totalGainLoss.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </p>
                    <div className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${isOverallPositive ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'}`}>
                        <span>{isOverallPositive ? '↑' : '↓'}</span>
                        <span>{isOverallPositive ? '+' : ''}{totalGainPercent.toFixed(2)}%</span>
                    </div>
                </div>
            </div>

            {/* Holdings List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-5 rounded-full bg-gray-900" />
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Holdings</h3>
                        <span className="text-xs text-gray-400 ml-1">({holdings.length})</span>
                    </div>
                </div>

                {holdings.length === 0 ? (
                    <div className="px-6 py-14 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                            </svg>
                        </div>
                        <p className="text-sm font-medium text-gray-500 mb-1">No stocks yet</p>
                        <p className="text-xs text-gray-400 mb-4">Start by buying stocks from the market</p>
                        <Link
                            href="/h_stocks/stocks"
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors"
                        >
                            Browse Stock Market
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* Table Header */}
                        <div className="px-6 py-3 bg-gray-50/50 border-b border-gray-100 hidden md:grid grid-cols-12 gap-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            <div className="col-span-2">Stock</div>
                            <div className="col-span-1 text-right">Qty</div>
                            <div className="col-span-2 text-right">Avg Price</div>
                            <div className="col-span-2 text-right">Current</div>
                            <div className="col-span-2 text-right">P/L</div>
                            <div className="col-span-3 text-right">Actions</div>
                        </div>

                        <div className="divide-y divide-gray-50">
                            {holdings.map((h) => {
                                // Calculate in USD first, then convert to wallet currency
                                const investedValueUSD = h.quantity * h.avgPrice;
                                const currentValueUSD = h.quantity * (h.currentPrice ?? h.avgPrice);
                                const plUSD = currentValueUSD - investedValueUSD;

                                // Convert to wallet currency
                                const investedValue = investedValueUSD * exchangeRate;
                                const currentValue = currentValueUSD * exchangeRate;
                                const pl = plUSD * exchangeRate;
                                const plPercent = investedValue > 0 ? (pl / investedValue) * 100 : 0;
                                const isPositive = pl >= 0;

                                return (
                                    <div
                                        key={h.symbol}
                                        className="px-6 py-4 hover:bg-gray-50/50 transition-colors"
                                    >
                                        {/* Desktop */}
                                        <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                                            <div className="col-span-2 flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                                    <span className="text-xs font-bold text-gray-700">{h.symbol.slice(0, 2)}</span>
                                                </div>
                                                <Link href={`/h_stocks/stocks/${h.symbol}`} className="font-semibold text-gray-900 text-sm hover:text-gray-600">
                                                    {h.symbol}
                                                </Link>
                                            </div>
                                            <div className="col-span-1 text-right">
                                                <span className="text-sm font-medium text-gray-900">{h.quantity}</span>
                                            </div>
                                            <div className="col-span-2 text-right">
                                                <span className="text-sm text-gray-600">${h.avgPrice.toFixed(2)}</span>
                                            </div>
                                            <div className="col-span-2 text-right">
                                                <span className="text-sm font-semibold text-gray-900">
                                                    {h.currentPrice != null ? `$${h.currentPrice.toFixed(2)}` : '—'}
                                                </span>
                                            </div>
                                            <div className="col-span-2 text-right">
                                                <p className={`text-sm font-bold ${isPositive ? 'text-emerald-700' : 'text-red-700'}`}>
                                                    {isPositive ? '+' : ''}{currency} {pl.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                                                </p>
                                                <p className={`text-xs ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {isPositive ? '+' : ''}{plPercent.toFixed(2)}%
                                                </p>
                                            </div>
                                            <div className="col-span-3 flex items-center justify-end gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openModal('BUY', h);
                                                    }}
                                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                    </svg>
                                                    Buy
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openModal('SELL', h);
                                                    }}
                                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-1"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                                    </svg>
                                                    Sell
                                                </button>
                                            </div>
                                        </div>

                                        {/* Mobile */}
                                        <div className="md:hidden">
                                            <div className="flex items-center gap-4 mb-3">
                                                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                                    <span className="text-xs font-bold text-gray-700">{h.symbol.slice(0, 2)}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <Link href={`/h_stocks/stocks/${h.symbol}`} className="text-sm font-semibold text-gray-900 hover:text-gray-600">
                                                        {h.symbol}
                                                    </Link>
                                                    <p className="text-xs text-gray-400">{h.quantity} shares @ ${h.avgPrice.toFixed(2)}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`text-sm font-bold ${isPositive ? 'text-emerald-700' : 'text-red-700'}`}>
                                                        {isPositive ? '+' : ''}{currency} {pl.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                                                    </p>
                                                    <p className={`text-xs ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {isPositive ? '+' : ''}{plPercent.toFixed(2)}%
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => openModal('BUY', h)}
                                                    className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                    </svg>
                                                    Buy More
                                                </button>
                                                <button
                                                    onClick={() => openModal('SELL', h)}
                                                    className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center justify-center gap-1"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                                    </svg>
                                                    Sell
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Buy/Sell Modal */}
            {showModal && selectedStock && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative">
                        {/* Close Button */}
                        <button
                            onClick={closeModal}
                            disabled={processing}
                            className="absolute top-4 right-4 p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {success ? (
                            /* Success Screen */
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">
                                    {modalType === 'BUY' ? 'Purchase' : 'Sale'} Successful!
                                </h3>
                                <p className="text-sm text-gray-500">Updating your portfolio...</p>
                            </div>
                        ) : (
                            /* Trade Form */
                            <div className="p-6">
                                <div className="mb-6">
                                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                                        {modalType === 'BUY' ? 'Buy' : 'Sell'} {selectedStock.symbol}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        {modalType === 'BUY'
                                            ? 'Purchase additional shares at current market price'
                                            : `You own ${selectedStock.quantity} shares`
                                        }
                                    </p>
                                </div>

                                {/* Stock Info */}
                                <div className={`rounded-xl p-4 mb-6 ${modalType === 'BUY' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm text-gray-600">Current Price</span>
                                        <span className="text-lg font-bold text-gray-900">
                                            ${(selectedStock.currentPrice ?? selectedStock.avgPrice).toFixed(2)} USD
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-500">Market Status</span>
                                        <span className={`flex items-center gap-1 font-medium ${modalType === 'BUY' ? 'text-emerald-600' : 'text-red-600'}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${modalType === 'BUY' ? 'bg-emerald-600' : 'bg-red-600'}`} />
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
                                        max={modalType === 'SELL' ? selectedStock.quantity : undefined}
                                        step="1"
                                        value={quantity}
                                        onChange={(e) => {
                                            setQuantity(e.target.value);
                                            setError('');
                                        }}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                        placeholder="1"
                                    />
                                    <div className="flex justify-between mt-2">
                                        <span className="text-xs text-gray-500">
                                            {modalType === 'SELL' ? `Max: ${selectedStock.quantity} shares` : 'Min: 1 share'}
                                        </span>
                                        <span className="text-xs text-gray-500">Market order</span>
                                    </div>
                                </div>

                                {/* Total Cost/Revenue */}
                                <div className={`rounded-xl p-4 mb-6 border-2 ${modalType === 'BUY' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-sm font-semibold ${modalType === 'BUY' ? 'text-emerald-900' : 'text-red-900'}`}>
                                            {modalType === 'BUY' ? 'Total Cost' : 'Total Revenue'} (USD)
                                        </span>
                                        <span className={`text-2xl font-bold ${modalType === 'BUY' ? 'text-emerald-900' : 'text-red-900'}`}>
                                            ${((parseFloat(quantity) || 0) * (selectedStock.currentPrice ?? selectedStock.avgPrice)).toFixed(2)}
                                        </span>
                                    </div>
                                    <p className={`text-xs ${modalType === 'BUY' ? 'text-emerald-700' : 'text-red-700'}`}>
                                        {modalType === 'BUY'
                                            ? 'Will be deducted from your wallet (exchange rate applied)'
                                            : 'Will be added to your wallet (exchange rate applied)'
                                        }
                                    </p>
                                </div>

                                {/* Error Message */}
                                {error && (
                                    <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
                                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {error}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={closeModal}
                                        disabled={processing}
                                        className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleTrade}
                                        disabled={processing || !quantity || parseFloat(quantity) <= 0}
                                        className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${modalType === 'BUY'
                                            ? 'bg-emerald-600 hover:bg-emerald-700'
                                            : 'bg-red-600 hover:bg-red-700'
                                            }`}
                                    >
                                        {processing ? (
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
                                                Confirm {modalType === 'BUY' ? 'Purchase' : 'Sale'}
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Disclaimer */}
                                <p className="mt-4 text-xs text-center text-gray-400">
                                    By confirming, you agree to {modalType === 'BUY' ? 'purchase' : 'sell'} at the current market price.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
