'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface WalletData {
    balance: number;
    currency: string;
    updatedAt: string;
}

interface Transaction {
    id: number;
    symbol: string;
    type: string;
    quantity: number;
    price: number;
    totalAmount: number;
    currency: string;
    date: string;
}

export default function WalletUI({
    wallet,
    transactions,
}: {
    wallet: WalletData | null;
    transactions: Transaction[];
}) {
    const router = useRouter();
    const [activating, setActivating] = useState(false);
    const [error, setError] = useState('');
    const [converting, setConverting] = useState(false);
    const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);
    const currencyMenuRef = useRef<HTMLDivElement>(null);

    // Close currency menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (currencyMenuRef.current && !currencyMenuRef.current.contains(event.target as Node)) {
                setShowCurrencyMenu(false);
            }
        }

        if (showCurrencyMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showCurrencyMenu]);

    // If wallet not activated
    if (!wallet) {
        async function handleActivate() {
            setActivating(true);
            setError('');

            try {
                const res = await fetch('/api/wallet/activate', {
                    method: 'POST',
                });
                const data = await res.json();
                if (res.ok) {
                    router.refresh();
                } else {
                    setError(data.error || 'Activation failed');
                }
            } catch {
                setError('Network error, please try again');
            } finally {
                setActivating(false);
            }
        }

        return (
            <div className="space-y-6">
                {/* Inactive Hero */}
                <div className="relative overflow-hidden rounded-2xl bg-gray-900 p-8 md:p-10">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/3 rounded-full -translate-y-1/2 translate-x-1/4" />
                    <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-white/2 rounded-full translate-y-1/2" />

                    <div className="relative text-center max-w-md mx-auto">
                        <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Wallet Not Activated</h2>
                        <p className="text-gray-400 text-sm mb-6">
                            Activate your investment wallet to start trading stocks and manage your portfolio
                        </p>

                        <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/10">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div className="text-left">
                                    <p className="text-xs text-gray-400">Welcome Bonus</p>
                                    <p className="text-lg font-bold text-white">MYR 10.00</p>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500">Get started with a free welcome bonus when you activate!</p>
                        </div>

                        {error && (
                            <div className="mb-4 rounded-xl px-4 py-2.5 text-sm font-medium flex items-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20">
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleActivate}
                            disabled={activating}
                            className="w-full px-6 py-3 rounded-xl text-sm font-semibold bg-white text-gray-900 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                            {activating ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Activating...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    Activate Wallet
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Status Card */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Wallet Status</p>
                            <p className="text-lg font-bold text-gray-400">Inactive</p>
                        </div>
                        <div className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center">
                            <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const balance = wallet.balance;
    const currency = wallet.currency;

    const currencies = [
        { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', flag: '🇲🇾' },
        { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬' },
        { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
    ];

    // Exchange rates for converting transaction amounts to current wallet currency
    const EXCHANGE_RATES = {
        MYR: 1,
        SGD: 0.30,  // 1 MYR = 0.30 SGD
        USD: 0.22,  // 1 MYR = 0.22 USD
    };

    // Convert transaction amount to current wallet currency
    function convertAmount(amount: number, fromCurrency: string, toCurrency: string): number {
        if (fromCurrency === toCurrency) return amount;

        // Convert to MYR first (base currency)
        const amountInMYR = amount / EXCHANGE_RATES[fromCurrency as keyof typeof EXCHANGE_RATES];
        // Then convert to target currency
        const convertedAmount = amountInMYR * EXCHANGE_RATES[toCurrency as keyof typeof EXCHANGE_RATES];

        return convertedAmount;
    }

    async function handleCurrencyConvert(toCurrency: string) {
        if (toCurrency === currency) {
            setShowCurrencyMenu(false);
            return;
        }

        setConverting(true);
        setError('');

        try {
            const res = await fetch('/api/wallet/convert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toCurrency }),
            });
            const data = await res.json();

            if (res.ok) {
                setShowCurrencyMenu(false);
                router.refresh();
            } else {
                setError(data.error || 'Conversion failed');
            }
        } catch {
            setError('Network error, please try again');
        } finally {
            setConverting(false);
        }
    }

    return (
        <div className="space-y-8">
            {/* Error Message */}
            {error && (
                <div className="rounded-xl px-5 py-3 text-sm font-medium flex items-center gap-2 bg-red-50 text-red-700 border border-red-100">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                </div>
            )}

            {/* Wallet Hero */}
            <div className="relative rounded-2xl bg-gray-900 p-8 md:p-10 overflow-visible">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/3 rounded-full -translate-y-1/2 translate-x-1/4 -z-10" />
                <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-white/2 rounded-full translate-y-1/2 -z-10" />

                <div className="relative">
                    {/* Currency Selector */}
                    <div className="flex items-center gap-2 mb-4">
                        <div className="relative" ref={currencyMenuRef}>
                            <button
                                onClick={() => setShowCurrencyMenu(!showCurrencyMenu)}
                                disabled={converting}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 transition-colors disabled:opacity-50"
                            >
                                <span className="text-xl">{currencies.find(c => c.code === currency)?.flag}</span>
                                <span className="text-xs font-semibold text-white">{currency}</span>
                                <svg className={`w-3 h-3 text-white transition-transform ${showCurrencyMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {/* Currency Dropdown */}
                            {showCurrencyMenu && (
                                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                                    <div className="p-2">
                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 py-2">Select Currency</p>
                                        {currencies.map((curr) => (
                                            <button
                                                key={curr.code}
                                                onClick={() => handleCurrencyConvert(curr.code)}
                                                disabled={converting || curr.code === currency}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${curr.code === currency
                                                    ? 'bg-gray-100 cursor-not-allowed'
                                                    : 'hover:bg-gray-50'
                                                    }`}
                                            >
                                                <span className="text-2xl">{curr.flag}</span>
                                                <div className="flex-1">
                                                    <p className="text-sm font-semibold text-gray-900">{curr.code}</p>
                                                    <p className="text-xs text-gray-400">{curr.name}</p>
                                                </div>
                                                {curr.code === currency && (
                                                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-gray-400">
                            {converting ? 'Converting...' : 'Click to convert currency'}
                        </p>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                        <div>
                            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Your Balance</p>
                            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-2">
                                {currency} {balance.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                            </h1>
                            <p className="text-gray-500 text-sm">
                                {wallet?.updatedAt
                                    ? `Last updated ${new Date(wallet.updatedAt).toLocaleDateString('en-MY', { month: 'short', day: 'numeric', year: 'numeric' })}`
                                    : 'Default balance'
                                }
                            </p>
                        </div>
                        <Link
                            href="/h_stocks/wallet/topup"
                            className="inline-flex items-center gap-2 bg-white text-gray-900 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-gray-100 transition-colors shrink-0"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Top Up
                        </Link>
                    </div>
                </div>
            </div>

            {/* Wallet Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Currency</span>
                        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                            <span className="text-lg">{currencies.find(c => c.code === currency)?.flag}</span>
                        </div>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{currencies.find(c => c.code === currency)?.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Active trading currency</p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Transactions</span>
                        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                            </svg>
                        </div>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{transactions.length}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Recent transactions</p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</span>
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                    <p className="text-lg font-bold text-emerald-700">Active</p>
                    <p className="text-xs text-gray-400 mt-0.5">Wallet is active</p>
                </div>
            </div>

            {/* Transaction History */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                    <div className="w-1.5 h-5 rounded-full bg-gray-900" />
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Transaction History</h3>
                </div>

                {transactions.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                        </div>
                        <p className="text-sm text-gray-400 mb-1">No transactions yet</p>
                        <p className="text-xs text-gray-300">Your buy and sell transactions will appear here</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {transactions.map((tx) => {
                            const isBuy = tx.type === 'BUY';
                            // Convert transaction amount to current wallet currency
                            const convertedAmount = convertAmount(tx.totalAmount, tx.currency, currency);

                            return (
                                <div key={tx.id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isBuy ? 'bg-emerald-50' : 'bg-red-50'}`}>
                                        <svg className={`w-4 h-4 ${isBuy ? 'text-emerald-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            {isBuy ? (
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m0-16l-4 4m4-4l4 4" />
                                            ) : (
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20V4m0 16l-4-4m4 4l4-4" />
                                            )}
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold text-gray-900">{tx.symbol}</p>
                                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${isBuy ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                                {tx.type}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400">
                                            {tx.quantity} shares @ ${tx.price.toFixed(2)}
                                            {tx.currency !== currency && (
                                                <span className="text-gray-300"> • Orig: {tx.currency}</span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-bold ${isBuy ? 'text-red-600' : 'text-emerald-600'}`}>
                                            {isBuy ? '-' : '+'}{currency} {convertedAmount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {new Date(tx.date).toLocaleDateString('en-MY', { month: 'short', day: 'numeric' })}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
