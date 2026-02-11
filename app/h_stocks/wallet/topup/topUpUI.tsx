'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const PRESET_AMOUNTS = [50, 100, 200, 500, 1000, 2000];

export default function TopUpUI({
    currentBalance,
    currency,
}: {
    currentBalance: number;
    currency: string;
}) {
    const router = useRouter();
    const [customAmount, setCustomAmount] = useState('');
    const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState<{ amount: number; newBalance: number } | null>(null);
    const [error, setError] = useState('');

    const topUpAmount = selectedPreset ?? (customAmount ? parseFloat(customAmount) : 0);

    // Ensure currentBalance is a number
    const balanceNum = typeof currentBalance === 'number' ? currentBalance : Number(currentBalance);
    const progressPercent = (balanceNum / 999999999.99) * 100;

    console.log("[TOP-UP UI] currentBalance:", currentBalance, "Type:", typeof currentBalance);
    console.log("[TOP-UP UI] balanceNum:", balanceNum, "Type:", typeof balanceNum);
    console.log("[TOP-UP UI] Progress calculation:", balanceNum, "/", 999999999.99, "=", progressPercent, "%");
    console.log("[TOP-UP UI] selectedPreset:", selectedPreset, "customAmount:", customAmount);
    console.log("[TOP-UP UI] topUpAmount:", topUpAmount, "Type:", typeof topUpAmount);
    console.log("[TOP-UP UI] New Balance calculation:", balanceNum, "+", topUpAmount, "=", (balanceNum + topUpAmount));

    async function handleTopUp() {
        if (!topUpAmount || topUpAmount <= 0) return;
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/wallet/topup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: topUpAmount }),
            });
            const data = await res.json();
            console.log("[TOP-UP UI] API response:", data);
            if (res.ok) {
                console.log("[TOP-UP UI] Top-up successful. Amount:", topUpAmount, "New Balance:", data.newBalance);
                setSuccess({ amount: topUpAmount, newBalance: data.newBalance });
            } else {
                setError(data.error || 'Top-up failed');
            }
        } catch {
            setError('Network error, please try again');
        } finally {
            setLoading(false);
        }
    }

    // Success screen
    if (success) {
        return (
            <div className="max-w-lg mx-auto space-y-6">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
                        <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">Top Up Successful!</h2>
                    <p className="text-sm text-gray-400 mb-6">Your wallet has been credited</p>

                    <div className="bg-gray-50 rounded-xl p-5 mb-6 space-y-3">
                        <div className="flex justify-between">
                            <span className="text-xs text-gray-400">Amount Added</span>
                            <span className="text-sm font-bold text-emerald-600">
                                + {currency} {success.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="border-t border-gray-200" />
                        <div className="flex justify-between">
                            <span className="text-xs text-gray-400">New Balance</span>
                            <span className="text-sm font-bold text-gray-900">
                                {currency} {success.newBalance.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                setSuccess(null);
                                setSelectedPreset(null);
                                setCustomAmount('');
                            }}
                            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                            Top Up Again
                        </button>
                        <Link
                            href="/h_stocks/wallet"
                            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 transition-colors text-center"
                        >
                            Back to Wallet
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Link
                    href="/h_stocks/wallet"
                    className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors"
                >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </Link>
                <div>
                    <h1 className="text-lg font-bold text-gray-900">Top Up Wallet</h1>
                    <p className="text-xs text-gray-400">Add funds to your investment wallet</p>
                </div>
            </div>

            {/* Current Balance Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Current Balance</p>
                        <p className="text-2xl font-bold text-gray-900">
                            {currency} {balanceNum.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-gray-900 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                        </svg>
                    </div>
                </div>
                {/* Balance limit indicator */}
                <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Balance Limit</span>
                        <span className="font-semibold text-gray-500">{currency} 999,999,999.99</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all ${balanceNum >= 999999999.99 ? 'bg-red-500' :
                                balanceNum >= 800000000 ? 'bg-orange-500' :
                                    'bg-emerald-500'
                                }`}
                            style={{
                                width: `${Math.max(Math.min(progressPercent, 100), balanceNum > 0 ? 0.5 : 0)}%`,
                                minWidth: balanceNum > 0 ? '3px' : '0'
                            }}
                        />
                    </div>
                    <p className="text-xs text-gray-300">
                        {balanceNum >= 999999999.99
                            ? 'Maximum balance reached'
                            : progressPercent >= 0.1
                                ? `${progressPercent.toFixed(1)}% of maximum`
                                : progressPercent >= 0.01
                                    ? `${progressPercent.toFixed(2)}% of maximum`
                                    : `${progressPercent.toFixed(4)}% of maximum`
                        }
                    </p>
                </div>
            </div>

            {/* Amount Selection */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                    <div className="w-1.5 h-5 rounded-full bg-emerald-500" />
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Select Amount</h3>
                </div>

                <div className="p-6 space-y-6">
                    {/* Preset Amounts */}
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Select</p>
                        <div className="grid grid-cols-3 gap-3">
                            {PRESET_AMOUNTS.map((amt) => (
                                <button
                                    key={amt}
                                    onClick={() => {
                                        setSelectedPreset(selectedPreset === amt ? null : amt);
                                        setCustomAmount('');
                                        setError('');
                                    }}
                                    className={`py-4 px-4 rounded-xl text-sm font-semibold transition-all cursor-pointer ${selectedPreset === amt
                                        ? 'bg-gray-900 text-white shadow-lg scale-[1.02]'
                                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-100'
                                        }`}
                                >
                                    {currency} {amt.toLocaleString()}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-gray-100" />
                        <span className="text-xs text-gray-300 font-medium">OR</span>
                        <div className="flex-1 h-px bg-gray-100" />
                    </div>

                    {/* Custom Amount */}
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Enter Custom Amount</p>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-gray-400">{currency}</span>
                            <input
                                type="number"
                                min="1"
                                max="5000"
                                step="0.01"
                                placeholder="0.00"
                                value={customAmount}
                                onChange={(e) => {
                                    setCustomAmount(e.target.value);
                                    setSelectedPreset(null);
                                    setError('');
                                }}
                                className="w-full pl-14 pr-4 py-4 rounded-xl border border-gray-200 text-lg font-bold text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                            />
                        </div>
                        <p className="text-xs text-gray-300 mt-2">Min {currency} 1.00 · Max {currency} 5,000.00</p>
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="rounded-xl px-5 py-3 text-sm font-medium flex items-center gap-2 bg-red-50 text-red-700 border border-red-100">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                </div>
            )}

            {/* Summary */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-5 rounded-full bg-gray-900" />
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Summary</h3>
                </div>

                {topUpAmount > 0 ? (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-400">Top-up Amount</span>
                            <span className="text-sm font-bold text-gray-900">
                                {currency} {topUpAmount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-400">Current Balance</span>
                            <span className="text-sm text-gray-500">
                                {currency} {balanceNum.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="border-t border-gray-100 pt-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold text-gray-700">New Balance</span>
                                <span className="text-lg font-bold text-emerald-600">
                                    {currency} {(balanceNum + topUpAmount).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-gray-300 text-center py-2">Select or enter an amount above</p>
                )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
                <Link
                    href="/h_stocks/wallet"
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-center border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                    Cancel
                </Link>
                <button
                    onClick={handleTopUp}
                    disabled={topUpAmount <= 0 || loading}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                    {loading ? (
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
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Confirm Top Up
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
