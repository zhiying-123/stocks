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

    function openModal(holding: Holding) {
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

    async function handleSell() {
        if (!selectedHolding) return;

        const qty = parseFloat(quantity);
        if (!qty || qty <= 0) {
            setError('Please enter a valid quantity');
            return;
        }

        if (qty > selectedHolding.quantity) {
            setError(`You only have ${selectedHolding.quantity} shares`);
            return;
        }

        setProcessing(true);
        setError('');

        try {
            const res = await fetch('/api/polymarket/sell', {
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
                setError(data.error || 'Transaction failed');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setProcessing(false);
        }
    }

    if (holdings.length === 0) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-1">My Positions</h1>
                        <p className="text-sm text-gray-400">
                            Track your prediction market investments
                        </p>
                    </div>
                    <Link href="/polymarket">
                        <button className="px-5 py-2.5 bg-white border border-gray-100 text-gray-900 font-semibold text-sm rounded-xl hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Markets
                        </button>
                    </Link>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                    <div className="text-5xl mb-4">📋</div>
                    <p className="text-lg font-semibold text-gray-900">No Active Positions</p>
                    <p className="text-sm text-gray-600 mt-2 mb-6">
                        Start trading to see your positions here
                    </p>
                    <Link href="/polymarket">
                        <button className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all">
                            Browse Markets
                        </button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-1">My Positions</h1>
                    <p className="text-sm text-gray-400">
                        Track your prediction market investments
                    </p>
                </div>
                <Link href="/polymarket">
                    <button className="px-5 py-2.5 bg-white border border-gray-100 text-gray-900 font-semibold text-sm rounded-xl hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Markets
                    </button>
                </Link>
            </div>

            {/* Portfolio Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Total Invested
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                        {currency} {totalInvested.toFixed(2)}
                    </div>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Current Value
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                        {currency} {totalCurrent.toFixed(2)}
                    </div>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Total Return
                    </div>
                    <div className={`text-2xl font-bold ${isOverallPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {isOverallPositive ? '+' : ''}{currency} {totalGainLoss.toFixed(2)}
                        <span className="text-sm ml-2">
                            ({isOverallPositive ? '+' : ''}{totalGainPercent.toFixed(2)}%)
                        </span>
                    </div>
                </div>
            </div>

            {/* Holdings Table */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Market
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Outcome
                                </th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Shares
                                </th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Avg Price
                                </th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Current Price
                                </th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Value
                                </th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    P/L
                                </th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {holdings.map((holding) => {
                                const investedUSD = holding.quantity * holding.avg_price;
                                const currentValueUSD = holding.quantity * holding.currentPrice;
                                const gainLossUSD = currentValueUSD - investedUSD;
                                const gainPercent = investedUSD > 0 ? (gainLossUSD / investedUSD) * 100 : 0;
                                const isPositive = gainLossUSD >= 0;

                                return (
                                    <tr key={holding.holding_id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900 max-w-md truncate">
                                                {holding.marketQuestion}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                ID: {holding.market_id.slice(0, 8)}...
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${holding.outcome === 'YES'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                }`}>
                                                {holding.outcome}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-gray-900">
                                            {holding.quantity.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-900">
                                            ${holding.avg_price.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-900">
                                            ${holding.currentPrice.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-gray-900">
                                            {currency} {(currentValueUSD * exchangeRate).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className={`font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                                {isPositive ? '+' : ''}{currency} {(gainLossUSD * exchangeRate).toFixed(2)}
                                            </div>
                                            <div className={`text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                                {isPositive ? '+' : ''}{gainPercent.toFixed(2)}%
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => openModal(holding)}
                                                className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors"
                                            >
                                                Sell
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Sell Modal */}
            {showModal && selectedHolding && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
                        <div className="flex justify-between items-start mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Sell Position</h2>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="mb-6">
                            <p className="text-sm text-gray-600 mb-2">{selectedHolding.marketQuestion}</p>
                            <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${selectedHolding.outcome === 'YES'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                {selectedHolding.outcome}
                            </span>
                        </div>

                        <div className="mb-6">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                                Number of Shares (Available: {selectedHolding.quantity.toFixed(2)})
                            </label>
                            <input
                                type="number"
                                min="0.01"
                                max={selectedHolding.quantity}
                                step="0.01"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                        </div>

                        <div className="bg-gray-50 rounded-xl p-4 mb-6">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-600">Price per share</span>
                                <span className="font-semibold">${selectedHolding.currentPrice.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-600">Shares</span>
                                <span className="font-semibold">{quantity || 0}</span>
                            </div>
                            <div className="border-t border-gray-200 my-2"></div>
                            <div className="flex justify-between">
                                <span className="font-bold text-gray-900">Total Proceeds</span>
                                <span className="font-bold text-green-600">
                                    {currency} {(
                                        selectedHolding.currentPrice *
                                        parseFloat(quantity || '0') *
                                        exchangeRate
                                    ).toFixed(2)}
                                </span>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-4 text-sm">
                                Sale successful! Redirecting...
                            </div>
                        )}

                        <button
                            onClick={handleSell}
                            disabled={processing}
                            className="w-full py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            {processing ? 'Processing...' : 'Sell Position'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
