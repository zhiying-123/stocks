'use client';

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Holding {
    holding_id: number;
    market_id: string;
    outcome: string;
    quantity: number;
    avg_price: number;
    marketQuestion: string;
    currentPrice: number;
}

export default function MyPositionsUI({ holdings, currency }: { holdings: Holding[]; currency: string }) {
    const router = useRouter();
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState<'BUY' | 'SELL'>('BUY');
    const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);
    const [quantity, setQuantity] = useState('1');
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // Exchange rates
    const EXCHANGE_RATES_FROM_USD = {
        USD: 1,
        MYR: 4.50,
        SGD: 1.35,
    };
    const exchangeRate = EXCHANGE_RATES_FROM_USD[currency as keyof typeof EXCHANGE_RATES_FROM_USD] || 1;

    // Calculate totals
    const totalInvestedUSD = holdings.reduce((sum, h) => sum + h.quantity * h.avg_price, 0);
    const totalCurrentUSD = holdings.reduce((sum, h) => sum + h.quantity * h.currentPrice, 0);

    const totalInvested = totalInvestedUSD * exchangeRate;
    const totalCurrent = totalCurrentUSD * exchangeRate;
    const totalGainLoss = totalCurrent - totalInvested;
    const totalGainPercent = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;
    const isOverallPositive = totalGainLoss >= 0;

    function openModal(type: 'BUY' | 'SELL', holding: Holding) {
        setModalType(type);
        setSelectedHolding(holding);
        setQuantity('1');
        setError('');
        setSuccess(false);
        setShowModal(true);
    }

    function closeModal() {
        setShowModal(false);
        setSelectedHolding(null);
        setQuantity('1');
        setError('');
        setSuccess(false);
    }

    async function handleTrade() {
        if (!selectedHolding) return;

        const qty = parseFloat(quantity);
        if (!qty || qty <= 0) {
            setError('Please enter a valid quantity');
            return;
        }

        if (modalType === 'SELL' && qty > selectedHolding.quantity) {
            setError(`You only have ${selectedHolding.quantity} shares`);
            return;
        }

        setProcessing(true);
        setError('');

        try {
            const endpoint = modalType === 'BUY' ? '/api/polymarket/buy' : '/api/polymarket/sell';
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    marketId: selectedHolding.market_id,
                    outcome: selectedHolding.outcome,
                    quantity: qty,
                    pricePerShare: selectedHolding.currentPrice,
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
                setError(data.error || `Failed to ${modalType.toLowerCase()} position`);
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setProcessing(false);
        }
    }

    if (holdings.length === 0) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">My Positions</h1>
                    <p className="text-sm text-gray-400 mt-1">Your prediction market holdings</p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                    <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                        </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-500 mb-1">No active positions</p>
                    <p className="text-xs text-gray-400 mb-4">Start trading to see your positions here</p>
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">My Positions</h1>
                <p className="text-sm text-gray-400 mt-1">Your prediction market holdings</p>
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

                {/* Table Header */}
                <div className="px-6 py-3 bg-gray-50/50 border-b border-gray-100 hidden md:grid grid-cols-12 gap-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <div className="col-span-3">Market</div>
                    <div className="col-span-1 text-center">Outcome</div>
                    <div className="col-span-1 text-right">Shares</div>
                    <div className="col-span-1 text-right">Avg Price</div>
                    <div className="col-span-1 text-right">Current</div>
                    <div className="col-span-2 text-right">P/L</div>
                    <div className="col-span-3 text-right">Actions</div>
                </div>

                <div className="divide-y divide-gray-50">
                    {holdings.map((h) => {
                        const investedValueUSD = h.quantity * h.avg_price;
                        const currentValueUSD = h.quantity * h.currentPrice;
                        const plUSD = currentValueUSD - investedValueUSD;

                        const investedValue = investedValueUSD * exchangeRate;
                        const currentValue = currentValueUSD * exchangeRate;
                        const pl = plUSD * exchangeRate;
                        const plPercent = investedValue > 0 ? (pl / investedValue) * 100 : 0;
                        const isPositive = pl >= 0;

                        return (
                            <div key={h.holding_id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                                {/* Desktop View */}
                                <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                                    <div className="col-span-3">
                                        <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">{h.marketQuestion}</p>
                                    </div>
                                    <div className="col-span-1 text-center">
                                        <span className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-full ${h.outcome === 'YES'
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'bg-red-50 text-red-700'
                                            }`}>
                                            {h.outcome}
                                        </span>
                                    </div>
                                    <div className="col-span-1 text-right">
                                        <p className="text-sm font-semibold text-gray-900">{h.quantity.toFixed(2)}</p>
                                    </div>
                                    <div className="col-span-1 text-right">
                                        <p className="text-sm font-medium text-gray-600">{currency} {(h.avg_price * exchangeRate).toFixed(2)}</p>
                                    </div>
                                    <div className="col-span-1 text-right">
                                        <p className="text-sm font-semibold text-gray-900">{currency} {(h.currentPrice * exchangeRate).toFixed(2)}</p>
                                    </div>
                                    <div className="col-span-2 text-right">
                                        <p className={`text-sm font-bold ${isPositive ? 'text-emerald-700' : 'text-red-700'}`}>
                                            {isPositive ? '+' : ''}{currency} {pl.toFixed(2)}
                                        </p>
                                        <p className={`text-xs ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {isPositive ? '+' : ''}{plPercent.toFixed(2)}%
                                        </p>
                                    </div>
                                    <div className="col-span-3 flex gap-2 justify-end">
                                        <button
                                            onClick={() => openModal('BUY', h)}
                                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            Buy
                                        </button>
                                        <button
                                            onClick={() => openModal('SELL', h)}
                                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                            </svg>
                                            Sell
                                        </button>
                                    </div>
                                </div>

                                {/* Mobile View */}
                                <div className="md:hidden space-y-3">
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900 mb-2">{h.marketQuestion}</p>
                                        <span className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-full ${h.outcome === 'YES'
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'bg-red-50 text-red-700'
                                            }`}>
                                            {h.outcome}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="text-gray-400 text-xs">Shares:</span>
                                            <p className="font-semibold text-gray-900">{h.quantity.toFixed(2)}</p>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 text-xs">Avg Price:</span>
                                            <p className="font-medium text-gray-600">{currency} {(h.avg_price * exchangeRate).toFixed(2)}</p>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 text-xs">Current:</span>
                                            <p className="font-semibold text-gray-900">{currency} {(h.currentPrice * exchangeRate).toFixed(2)}</p>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 text-xs">P/L:</span>
                                            <p className={`font-bold ${isPositive ? 'text-emerald-700' : 'text-red-700'}`}>
                                                {isPositive ? '+' : ''}{currency} {pl.toFixed(2)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openModal('BUY', h)}
                                            className="flex-1 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-semibold rounded-lg transition-colors border border-emerald-200"
                                        >
                                            Buy
                                        </button>
                                        <button
                                            onClick={() => openModal('SELL', h)}
                                            className="flex-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold rounded-lg transition-colors border border-red-200"
                                        >
                                            Sell
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Buy/Sell Modal */}
            {showModal && selectedHolding && (
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
                                        {modalType} {selectedHolding.outcome}
                                    </h3>
                                    <p className="text-sm text-gray-500 line-clamp-2">
                                        {selectedHolding.marketQuestion}
                                    </p>
                                </div>

                                {/* Position Info */}
                                <div className={`rounded-xl p-4 mb-6 ${modalType === 'BUY' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600">Outcome</span>
                                        <span className={`font-bold ${selectedHolding.outcome === 'YES' ? 'text-emerald-700' : 'text-red-700'}`}>
                                            {selectedHolding.outcome}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Current Price</span>
                                        <span className="font-bold text-gray-900">
                                            {currency} {(selectedHolding.currentPrice * exchangeRate).toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                {/* Quantity Input */}
                                <div className="mb-6">
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                                        Shares{modalType === 'SELL' && ` (Available: ${selectedHolding.quantity.toFixed(2)})`}
                                    </label>
                                    <input
                                        type="number"
                                        min="0.01"
                                        max={modalType === 'SELL' ? selectedHolding.quantity : undefined}
                                        step="0.01"
                                        value={quantity}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setQuantity(val);
                                        }}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                        placeholder="1"
                                    />
                                </div>

                                {/* Total Cost/Revenue */}
                                <div className={`rounded-xl p-4 mb-6 border-2 ${modalType === 'BUY' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-semibold text-gray-600">
                                            Total {modalType === 'BUY' ? 'Cost' : 'Proceeds'}
                                        </span>
                                        <span className={`text-xl font-bold ${modalType === 'BUY' ? 'text-emerald-700' : 'text-red-700'}`}>
                                            {currency} {(
                                                selectedHolding.currentPrice *
                                                parseFloat(quantity || '0') *
                                                exchangeRate
                                            ).toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                {/* Error Message */}
                                {error && (
                                    <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
                                        <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                        {error}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={closeModal}
                                        disabled={processing}
                                        className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleTrade}
                                        disabled={processing}
                                        className={`flex-1 px-4 py-3 font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${modalType === 'BUY'
                                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                            : 'bg-red-600 hover:bg-red-700 text-white'
                                            }`}
                                    >
                                        {processing ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                Processing...
                                            </span>
                                        ) : (
                                            `Confirm ${modalType === 'BUY' ? 'Purchase' : 'Sale'}`
                                        )}
                                    </button>
                                </div>

                                {/* Disclaimer */}
                                <p className="mt-4 text-xs text-center text-gray-400">
                                    By confirming, you agree to {modalType.toLowerCase()} at the current market price.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
