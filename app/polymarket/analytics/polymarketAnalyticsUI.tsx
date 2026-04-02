'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
    AreaChart,
    Area,
    LineChart,
    Line,
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

interface MarketOption {
    id: string;
    question: string;
}

function parseStringArray(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((item) => String(item));
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value) as unknown;
            return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
        } catch {
            return [];
        }
    }
    return [];
}

interface BacktestResult {
    config: {
        marketId: string;
        action: 'BUY' | 'SELL' | 'BOTH';
        triggerType: 'PRICE_TARGET' | 'MOVING_AVERAGE';
        direction: 'ABOVE' | 'BELOW';
        targetPrice: number | null;
        buyTargetPrice?: number | null;
        sellTargetPrice?: number | null;
        movingAverageDays: number | null;
        quantity: number;
        start: string;
        end: string;
        initialCash: number;
        initialPosition: number;
        mode: 'once' | 'repeat';
    };
    market: {
        resolvedMarketId?: string;
        points: number;
        startDate: string;
        endDate: string;
        firstPrice: number;
        lastPrice: number;
        lowPrice: number;
        highPrice: number;
    };
    result: {
        matchedSignals: number;
        tradesExecuted: number;
        matchedButSkipped: number;
        buyTrades: number;
        sellTrades: number;
        totalBoughtCost: number;
        totalBoughtQty: number;
        totalSoldProceeds: number;
        totalSoldQty: number;
        endingCash: number;
        endingPosition: number;
        endingPositionValue: number;
        realizedPnL: number;
        unrealizedPnL: number;
        tradingCashDelta: number;
        positionMarkToMarketDelta: number;
        initialEquity: number;
        finalEquity: number;
        netPnL: number;
        returnPct: number;
        buyAndHoldFinalEquity: number;
        buyAndHoldNetPnL: number;
        buyAndHoldReturnPct: number;
        vsBuyAndHoldPct: number;
        maxDrawdownPct: number;
    };
    skipReasonSummary?: Array<{
        reason: string;
        count: number;
    }>;
    insights?: string[];
    trades: Array<{
        date: string;
        action: 'BUY' | 'SELL';
        price: number;
        quantity: number;
        cashAfter: number;
        positionAfter: number;
        triggerValue: number;
    }>;
    skippedMatches: Array<{
        date: string;
        reason: string;
        price: number;
        triggerValue: number;
    }>;
}

type CategoryDatum = {
    name: string;
    value: number;
    percentage?: number;
};

type OutcomeDatum = {
    name: string;
    value: number;
};

type MonthlyVolumeDatum = {
    month: string;
    bought: number;
    sold: number;
};

function formatDateInput(daysAgo: number = 0) {
    const date = new Date();
    if (daysAgo > 0) {
        date.setDate(date.getDate() - daysAgo);
    }

    // Use local date to avoid UTC day-shift issues in date inputs.
    const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
    return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

function formatFixed(value: unknown, digits: number) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return (0).toFixed(digits);
    }
    return numeric.toFixed(digits);
}

// Soft monochrome palette with very light accents
const PASTEL_COLORS = ['#E5E7EB', '#D1D5DB', '#CBD5E1', '#E2E8F0', '#F1F5F9', '#E5E7EB', '#F3F4F6', '#D4D4D8'];

const OUTCOME_COLORS = {
    YES: '#E5E7EB',
    NO: '#D1D5DB',
};

export default function PolymarketAnalyticsUI({
    holdings,
    transactions,
    currency,
    marketOptions,
}: {
    holdings: Holding[];
    transactions: Transaction[];
    currency: string;
    marketOptions: MarketOption[];
}) {
    const searchParams = useSearchParams();
    const marketPickerRef = useRef<HTMLDivElement>(null);
    const hasTriggeredAutoRunRef = useRef(false);

    const today = formatDateInput(0);

    const [selectedView, setSelectedView] = useState<'category' | 'outcome'>('category');
    const [availableMarketOptions, setAvailableMarketOptions] = useState<MarketOption[]>(marketOptions);
    const [isLoadingMarketOptions, setIsLoadingMarketOptions] = useState(false);
    const [marketId, setMarketId] = useState(marketOptions[0]?.id || '');
    const [fallbackMarketQuestion, setFallbackMarketQuestion] = useState('');
    const [marketQuery, setMarketQuery] = useState('');
    const [isMarketMenuOpen, setIsMarketMenuOpen] = useState(false);
    const [action, setAction] = useState<'BUY' | 'SELL' | 'BOTH'>('BOTH');
    const [triggerType, setTriggerType] = useState<'PRICE_TARGET' | 'MOVING_AVERAGE'>('PRICE_TARGET');
    const [direction, setDirection] = useState<'ABOVE' | 'BELOW'>('BELOW');
    const [targetPrice, setTargetPrice] = useState('0.55');
    const [buyTargetPrice, setBuyTargetPrice] = useState('0.40');
    const [sellTargetPrice, setSellTargetPrice] = useState('0.60');
    const [movingAverageDays, setMovingAverageDays] = useState('20');
    const [quantity, setQuantity] = useState('1');
    const [startDate, setStartDate] = useState(formatDateInput(365));
    const [endDate, setEndDate] = useState(today);
    const [initialCash, setInitialCash] = useState('1000');
    const [initialPosition, setInitialPosition] = useState('0');
    const [mode, setMode] = useState<'once' | 'repeat'>('repeat');
    const [isRunningBacktest, setIsRunningBacktest] = useState(false);
    const [backtestError, setBacktestError] = useState('');
    const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    useEffect(() => {
        setAvailableMarketOptions(marketOptions);
    }, [marketOptions]);

    useEffect(() => {
        if (availableMarketOptions.length > 0 || isLoadingMarketOptions) {
            return;
        }

        let cancelled = false;

        async function loadFallbackMarketOptions() {
            try {
                setIsLoadingMarketOptions(true);
                const response = await fetch('https://gamma-api.polymarket.com/events?limit=300&offset=0&closed=false', {
                    cache: 'no-store',
                    headers: { Accept: 'application/json' },
                });

                if (!response.ok) {
                    return;
                }

                const data = (await response.json()) as unknown;
                if (!Array.isArray(data)) {
                    return;
                }

                const map = new Map<string, MarketOption>();
                for (const event of data) {
                    if (typeof event !== 'object' || event === null) continue;
                    const eventRecord = event as Record<string, unknown>;
                    const markets = eventRecord.markets;
                    if (!Array.isArray(markets)) continue;

                    for (const market of markets) {
                        if (typeof market !== 'object' || market === null) continue;
                        const marketRecord = market as Record<string, unknown>;
                        const clobIds = parseStringArray(marketRecord.clobTokenIds);
                        const tokenId = String(marketRecord.conditionId || '').trim() || clobIds[0]?.trim();
                        if (!tokenId || map.has(tokenId)) continue;

                        const question = String(marketRecord.question || eventRecord.title || tokenId).trim();
                        map.set(tokenId, {
                            id: tokenId,
                            question: question || tokenId,
                        });
                    }
                }

                if (!cancelled) {
                    setAvailableMarketOptions(Array.from(map.values()));
                }
            } catch {
                // Ignore fallback load errors and keep manual input available.
            } finally {
                if (!cancelled) {
                    setIsLoadingMarketOptions(false);
                }
            }
        }

        void loadFallbackMarketOptions();

        return () => {
            cancelled = true;
        };
    }, [availableMarketOptions.length, isLoadingMarketOptions]);

    useEffect(() => {
        if (!marketId && availableMarketOptions.length > 0) {
            setMarketId(availableMarketOptions[0].id);
            setMarketQuery(availableMarketOptions[0].question);
        }
    }, [availableMarketOptions, marketId]);

    useEffect(() => {
        if (!isReportModalOpen) {
            return;
        }

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setIsReportModalOpen(false);
            }
        }

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.body.style.overflow = originalOverflow;
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [isReportModalOpen]);

    const marketNameMap = useMemo(() => {
        return new Map(availableMarketOptions.map((option) => [option.id, option.question]));
    }, [availableMarketOptions]);

    const selectedMarket = useMemo(() => {
        return availableMarketOptions.find((option) => option.id === marketId) || null;
    }, [availableMarketOptions, marketId]);

    const selectedMarketLabel = selectedMarket?.question || fallbackMarketQuestion || 'Unknown market';

    const filteredMarketOptions = useMemo(() => {
        const normalized = marketQuery.trim().toLowerCase();
        if (!normalized) {
            return availableMarketOptions.slice(0, 80);
        }

        return availableMarketOptions
            .filter((option) => option.question.toLowerCase().includes(normalized))
            .slice(0, 80);
    }, [availableMarketOptions, marketQuery]);

    useEffect(() => {
        function handleOutsideClick(event: MouseEvent) {
            if (!marketPickerRef.current) return;
            if (!marketPickerRef.current.contains(event.target as Node)) {
                setIsMarketMenuOpen(false);
            }
        }

        document.addEventListener('mousedown', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, []);

    useEffect(() => {
        if (!isMarketMenuOpen && selectedMarket?.question) {
            setMarketQuery(selectedMarket.question);
        }
    }, [isMarketMenuOpen, selectedMarket]);

    useEffect(() => {
        const incomingMarketId = searchParams.get('marketId')?.trim();
        const incomingMarketQuestion = searchParams.get('marketQuestion')?.trim();

        if (incomingMarketQuestion) {
            setFallbackMarketQuestion(incomingMarketQuestion);
        }

        if (incomingMarketId) {
            setMarketId(incomingMarketId);
            const matchedOption = availableMarketOptions.find((option) => option.id === incomingMarketId);
            setMarketQuery(matchedOption?.question || incomingMarketQuestion || incomingMarketId);
        }
    }, [availableMarketOptions, searchParams]);

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
    const categoryData = holdings.reduce<CategoryDatum[]>((acc, holding) => {
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
    const outcomeData = holdings.reduce<OutcomeDatum[]>((acc, holding) => {
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
    const monthlyVolume = transactions.reduce<MonthlyVolumeDatum[]>((acc, tx) => {
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
            marketName: marketNameMap.get(h.market_id) || fallbackMarketQuestion || `Market ${h.market_id.slice(0, 8)}...`,
            category: h.category || 'Other',
            value: h.quantity * h.avg_price * exchangeRate,
            outcome: h.outcome,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    async function runBacktest() {
        try {
            setIsRunningBacktest(true);
            setBacktestError('');

            if (!marketId.trim()) {
                throw new Error('Please select a market from the dropdown');
            }

            if (endDate < startDate) {
                throw new Error('End date cannot be earlier than start date');
            }

            if (triggerType === 'PRICE_TARGET' && action === 'BOTH') {
                const buyLine = Number(buyTargetPrice);
                const sellLine = Number(sellTargetPrice);
                if (!Number.isFinite(buyLine) || buyLine <= 0 || buyLine >= 1) {
                    throw new Error('Buy line must be between 0 and 1');
                }
                if (!Number.isFinite(sellLine) || sellLine <= 0 || sellLine >= 1) {
                    throw new Error('Sell line must be between 0 and 1');
                }
                if (buyLine >= sellLine) {
                    throw new Error('Buy line must be lower than sell line');
                }
            }

            const payload = {
                marketId: marketId.trim(),
                action,
                triggerType,
                direction,
                targetPrice: triggerType === 'PRICE_TARGET' && action !== 'BOTH' ? Number(targetPrice) : null,
                buyTargetPrice: triggerType === 'PRICE_TARGET' && action === 'BOTH' ? Number(buyTargetPrice) : null,
                sellTargetPrice: triggerType === 'PRICE_TARGET' && action === 'BOTH' ? Number(sellTargetPrice) : null,
                movingAverageDays: triggerType === 'MOVING_AVERAGE' ? Number(movingAverageDays) : null,
                quantity: Number(quantity),
                start: startDate,
                end: endDate,
                initialCash: Number(initialCash),
                initialPosition: Number(initialPosition),
                mode,
            };

            const response = await fetch('/api/polymarket/backtest-auto-buy-sell', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.error || 'Backtest failed');
            }

            setBacktestResult(data as BacktestResult);
            setIsReportModalOpen(true);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Backtest failed';
            setBacktestError(message);
            setBacktestResult(null);
            setIsReportModalOpen(false);
        } finally {
            setIsRunningBacktest(false);
        }
    }

    useEffect(() => {
        const shouldAutoRun = searchParams.get('autorun') === '1';
        if (!shouldAutoRun || !marketId || hasTriggeredAutoRunRef.current) {
            return;
        }

        hasTriggeredAutoRunRef.current = true;
        void runBacktest();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [marketId, searchParams]);

    const backtestTradeActionData = useMemo(() => {
        if (!backtestResult) return [];
        return [
            { action: 'BUY', count: backtestResult.result.buyTrades || 0 },
            { action: 'SELL', count: backtestResult.result.sellTrades || 0 },
        ];
    }, [backtestResult]);

    const backtestExecutionPriceData = useMemo(() => {
        if (!backtestResult) return [];

        const bucket = new Map<string, {
            date: string;
            buyQty: number;
            sellQty: number;
            buyNotional: number;
            sellNotional: number;
        }>();

        for (const trade of backtestResult.trades) {
            const key = trade.date.slice(0, 10);
            const row = bucket.get(key) || {
                date: key,
                buyQty: 0,
                sellQty: 0,
                buyNotional: 0,
                sellNotional: 0,
            };
            if (trade.action === 'BUY') {
                row.buyQty += Number(trade.quantity || 0);
                row.buyNotional += Number(trade.price || 0) * Number(trade.quantity || 0);
            } else {
                row.sellQty += Number(trade.quantity || 0);
                row.sellNotional += Number(trade.price || 0) * Number(trade.quantity || 0);
            }
            bucket.set(key, row);
        }

        return Array.from(bucket.values())
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((row) => ({
                date: row.date,
                buyQty: row.buyQty,
                sellQty: row.sellQty,
                buyAvgPrice: row.buyQty > 0 ? row.buyNotional / row.buyQty : null,
                sellAvgPrice: row.sellQty > 0 ? row.sellNotional / row.sellQty : null,
            }))
            .slice(-28);
    }, [backtestResult]);

    const conciseBacktestInsights = useMemo(() => {
        if (!backtestResult?.insights) return [];
        return backtestResult.insights
            .slice(0, 4)
            .map((line) => line.replace(/^Strategy\s+/i, '').replace(/^Signals\s+/i, 'Signals ').trim());
    }, [backtestResult]);

    const backtestPanel = (
        <div className="bg-linear-to-b from-white to-gray-50 rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Auto Buy/Sell Backtest</h3>
                    <p className="text-xs text-gray-500 mt-1">Historical simulation for Polymarket market rules</p>
                </div>
                <button
                    onClick={runBacktest}
                    disabled={isRunningBacktest}
                    className="px-4 py-2 text-sm font-semibold text-white bg-gray-900 hover:bg-black disabled:bg-gray-400 rounded-xl transition-colors"
                >
                    {isRunningBacktest ? 'Running...' : 'Run Backtest'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Market</label>
                    <div ref={marketPickerRef} className="relative">
                        <button
                            type="button"
                            onClick={() => {
                                setIsMarketMenuOpen((prev) => !prev);
                                if (!isMarketMenuOpen) {
                                    setMarketQuery(selectedMarket?.question || fallbackMarketQuestion || '');
                                }
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-left text-sm text-gray-800 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                        >
                            <span className="flex items-center justify-between gap-2">
                                <span className="truncate">{selectedMarket?.question || fallbackMarketQuestion || 'Select a market'}</span>
                                <svg className={`w-4 h-4 text-gray-500 transition-transform ${isMarketMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </span>
                        </button>

                        {isMarketMenuOpen && (
                            <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                                <div className="border-b border-gray-100 p-2">
                                    <input
                                        type="text"
                                        value={marketQuery}
                                        onChange={(event) => setMarketQuery(event.target.value)}
                                        placeholder="Type keywords to filter events..."
                                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                                    />
                                </div>

                                <div className="max-h-64 overflow-auto py-1">
                                    {isLoadingMarketOptions && (
                                        <p className="px-3 py-2 text-sm text-gray-500">Loading markets...</p>
                                    )}

                                    {filteredMarketOptions.length === 0 ? (
                                        <div className="px-3 py-2 space-y-2">
                                            <p className="text-sm text-gray-500">No matching markets</p>
                                            {marketQuery.trim() && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const typedValue = marketQuery.trim();
                                                        setMarketId(typedValue);
                                                        setFallbackMarketQuestion(typedValue);
                                                        setIsMarketMenuOpen(false);
                                                    }}
                                                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                                                >
                                                    Use "{marketQuery.trim()}" as market identifier
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        filteredMarketOptions.map((option) => (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => {
                                                    setMarketId(option.id);
                                                    setMarketQuery(option.question);
                                                    setIsMarketMenuOpen(false);
                                                    setFallbackMarketQuestion(option.question);
                                                }}
                                                className={`w-full px-3 py-2 text-left text-sm transition-colors ${option.id === marketId
                                                    ? 'bg-gray-900 text-white'
                                                    : 'text-gray-700 hover:bg-gray-100'
                                                    }`}
                                                title={option.question}
                                            >
                                                {option.question}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <p className="mt-1 truncate text-[11px] text-gray-500">Selected event: {selectedMarketLabel}</p>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Action</label>
                    <select value={action} onChange={(event) => setAction(event.target.value as 'BUY' | 'SELL' | 'BOTH')} className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200">
                        <option value="BOTH">BOTH (Buy + Sell)</option>
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Trigger</label>
                    <select value={triggerType} onChange={(event) => setTriggerType(event.target.value as 'PRICE_TARGET' | 'MOVING_AVERAGE')} className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200">
                        <option value="PRICE_TARGET">PRICE_TARGET</option>
                        <option value="MOVING_AVERAGE">MOVING_AVERAGE</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Direction</label>
                    <select value={direction} onChange={(event) => setDirection(event.target.value as 'ABOVE' | 'BELOW')} disabled={triggerType === 'PRICE_TARGET' && action === 'BOTH'} className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:bg-gray-100 disabled:text-gray-500">
                        <option value="ABOVE">ABOVE</option>
                        <option value="BELOW">BELOW</option>
                    </select>
                </div>

                {triggerType === 'PRICE_TARGET' ? (
                    action === 'BOTH' ? (
                        <>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Buy Line (&lt;=)</label>
                                <input type="number" min="0" max="1" step="0.0001" value={buyTargetPrice} onChange={(event) => setBuyTargetPrice(event.target.value)} className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Sell Line (&gt;=)</label>
                                <input type="number" min="0" max="1" step="0.0001" value={sellTargetPrice} onChange={(event) => setSellTargetPrice(event.target.value)} className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200" />
                            </div>
                        </>
                    ) : (
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Target Price (0-1)</label>
                            <input type="number" min="0" max="1" step="0.0001" value={targetPrice} onChange={(event) => setTargetPrice(event.target.value)} className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200" />
                        </div>
                    )
                ) : (
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">MA Days</label>
                        <input type="number" min="2" value={movingAverageDays} onChange={(event) => setMovingAverageDays(event.target.value)} className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200" />
                    </div>
                )}

                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Quantity</label>
                    <input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200" />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Start</label>
                    <input
                        type="date"
                        max={today}
                        value={startDate}
                        onChange={(event) => {
                            const rawStart = event.target.value;
                            const nextStart = rawStart > today ? today : rawStart;
                            setStartDate(nextStart);
                            if (endDate < nextStart) {
                                setEndDate(nextStart);
                            }
                        }}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">End</label>
                    <input
                        type="date"
                        min={startDate || today}
                        max={today}
                        value={endDate}
                        onChange={(event) => {
                            const rawEnd = event.target.value;
                            let nextEnd = rawEnd > today ? today : rawEnd;
                            if (nextEnd < startDate) {
                                nextEnd = startDate;
                            }
                            setEndDate(nextEnd);
                        }}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Initial Cash (USDC)</label>
                    <input type="number" min="0" step="0.01" value={initialCash} onChange={(event) => setInitialCash(event.target.value)} className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200" />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Initial Position</label>
                    <input type="number" min="0" step="0.0001" value={initialPosition} onChange={(event) => setInitialPosition(event.target.value)} className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200" />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Mode</label>
                    <select value={mode} onChange={(event) => setMode(event.target.value as 'once' | 'repeat')} className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200">
                        <option value="repeat">repeat</option>
                        <option value="once">once</option>
                    </select>
                </div>
            </div>

            {backtestError && (
                <div className="px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700">
                    {backtestError}
                </div>
            )}

            {backtestResult && (
                <div className="rounded-xl border border-gray-200 bg-white/90 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Backtest ready</p>
                            <p className="text-sm text-gray-700 mt-1">Report generated for <span className="font-semibold text-gray-900">{selectedMarketLabel}</span></p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${backtestResult.result.netPnL >= 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                PnL {backtestResult.result.netPnL >= 0 ? '+' : ''}{formatFixed(backtestResult.result.netPnL, 2)}
                            </span>
                            <button
                                onClick={() => setIsReportModalOpen(true)}
                                className="px-3.5 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black transition-colors"
                            >
                                View Report Table
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const backtestReportModal = backtestResult && isReportModalOpen ? (
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4 sm:p-6">
            <div
                className="absolute inset-0 bg-black/35 backdrop-blur-sm"
                onClick={() => setIsReportModalOpen(false)}
            />

            <div className="relative w-full max-w-6xl rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
                <div className="flex items-start justify-between gap-4 border-b border-gray-200 bg-linear-to-r from-white to-gray-50 px-5 py-4">
                    <div>
                        <h3 className="text-base font-bold text-gray-900">Backtest Report</h3>
                        <p className="text-sm text-gray-600 mt-1">{selectedMarketLabel}</p>
                    </div>
                    <button
                        onClick={() => setIsReportModalOpen(false)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                        aria-label="Close report"
                    >
                        ×
                    </button>
                </div>

                <div className="max-h-[80vh] overflow-auto p-5 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                        <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
                            <p className="text-[11px] uppercase tracking-wide font-semibold text-rose-500">Net PnL</p>
                            <p className={`text-xl font-bold mt-1 ${backtestResult.result.netPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {backtestResult.result.netPnL >= 0 ? '+' : ''}{formatFixed(backtestResult.result.netPnL, 2)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Return {formatFixed(backtestResult.result.returnPct, 2)}%</p>
                        </div>
                        <div className="rounded-xl border border-sky-100 bg-sky-50 p-4">
                            <p className="text-[11px] uppercase tracking-wide font-semibold text-sky-600">Capital</p>
                            <p className="text-lg font-bold text-gray-900 mt-1">{formatFixed(backtestResult.config.initialCash, 2)} start</p>
                            <p className="text-xs text-gray-600 mt-1">Cash {formatFixed(backtestResult.result.endingCash, 2)} / Position {formatFixed(backtestResult.result.endingPositionValue, 2)}</p>
                        </div>
                        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                            <p className="text-[11px] uppercase tracking-wide font-semibold text-amber-600">Trades</p>
                            <p className="text-lg font-bold text-gray-900 mt-1">{backtestResult.result.tradesExecuted} executed</p>
                            <p className="text-xs text-gray-600 mt-1">BUY {backtestResult.result.buyTrades} / SELL {backtestResult.result.sellTrades}</p>
                        </div>
                        <div className="rounded-xl border border-violet-100 bg-violet-50 p-4">
                            <p className="text-[11px] uppercase tracking-wide font-semibold text-violet-600">Risk</p>
                            <p className="text-lg font-bold text-gray-900 mt-1">MDD {formatFixed(backtestResult.result.maxDrawdownPct, 2)}%</p>
                            <p className="text-xs text-gray-600 mt-1">Vs B&H {formatFixed(backtestResult.result.vsBuyAndHoldPct, 2)} pp</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-slate-200 bg-linear-to-br from-slate-50 to-white p-4">
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Core Snapshot</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Selected</p>
                                    <p className="text-xs font-semibold text-slate-700 mt-1">{backtestResult.config.start} → {backtestResult.config.end}</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Covered</p>
                                    <p className="text-xs font-semibold text-slate-700 mt-1">{backtestResult.market.startDate} → {backtestResult.market.endDate}</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Price Band</p>
                                    <p className="text-xs font-semibold text-slate-700 mt-1">{formatFixed(backtestResult.market.lowPrice, 4)} ↔ {formatFixed(backtestResult.market.highPrice, 4)}</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-wide text-slate-400">PnL Split</p>
                                    <p className="text-xs font-semibold text-slate-700 mt-1">R {formatFixed(backtestResult.result.realizedPnL, 2)} / U {formatFixed(backtestResult.result.unrealizedPnL, 2)}</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 sm:col-span-2">
                                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Flow</p>
                                    <p className="text-xs font-semibold text-slate-700 mt-1">Buy {formatFixed(backtestResult.result.totalBoughtCost, 2)} • Sell {formatFixed(backtestResult.result.totalSoldProceeds, 2)}</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 sm:col-span-2">
                                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Resolved Market ID</p>
                                    <p className="text-xs font-semibold text-slate-700 mt-1 break-all">{backtestResult.market.resolvedMarketId || backtestResult.config.marketId}</p>
                                </div>
                                {backtestResult.config.triggerType === 'PRICE_TARGET' && backtestResult.config.action === 'BOTH' ? (
                                    <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 sm:col-span-2">
                                        <p className="text-[10px] uppercase tracking-wide text-violet-500">Trigger Lines</p>
                                        <p className="text-xs font-semibold text-violet-700 mt-1">BUY ≤ {formatFixed(backtestResult.config.buyTargetPrice, 4)} • SELL ≥ {formatFixed(backtestResult.config.sellTargetPrice, 4)}</p>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                        <div className="rounded-xl border border-indigo-100 bg-linear-to-br from-indigo-50 to-white p-4">
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Trade Mix</p>
                            <ResponsiveContainer width="100%" height={180}>
                                <PieChart>
                                    <Pie
                                        data={backtestTradeActionData}
                                        dataKey="count"
                                        nameKey="action"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={48}
                                        outerRadius={76}
                                        paddingAngle={4}
                                        strokeWidth={0}
                                    >
                                        <Cell fill="#93C5FD" />
                                        <Cell fill="#FDBA74" />
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'white',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '10px',
                                        }}
                                        formatter={(value: number | undefined, name: string) => [value || 0, `${name} trades`]}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {(backtestResult.insights?.length || backtestResult.skipReasonSummary?.length) ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="rounded-xl border border-emerald-100 bg-linear-to-br from-emerald-50 to-white p-4">
                                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Why Profit / Loss</p>
                                <div className="flex flex-wrap gap-2">
                                    {conciseBacktestInsights.length === 0 ? (
                                        <p className="text-sm text-gray-500">No insights generated.</p>
                                    ) : conciseBacktestInsights.map((insight, index) => (
                                        <span key={`${index}-${insight.slice(0, 14)}`} className="inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700">
                                            {insight}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="rounded-xl border border-amber-100 bg-linear-to-br from-amber-50 to-white p-4">
                                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Top Skipped Reasons</p>
                                {(backtestResult.skipReasonSummary || []).length === 0 ? (
                                    <p className="text-sm text-gray-500">No skipped signals.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {(backtestResult.skipReasonSummary || []).map((row) => (
                                            <li key={row.reason} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-amber-700 font-medium">{row.reason}: {row.count}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    ) : null}

                    <div className="rounded-xl border border-cyan-100 bg-linear-to-br from-cyan-50 to-white p-4">
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Execution Price Timeline (Last 28 Buckets)</p>
                        <p className="text-[11px] text-gray-500 mb-3">X-axis: date, Y-axis: average executed price. Tooltip shows quantity details.</p>
                        {backtestExecutionPriceData.length === 0 ? (
                            <p className="text-sm text-gray-500">No trades executed for selected parameters.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={backtestExecutionPriceData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6B7280' }} />
                                    <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} domain={[0, 1]} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'white',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '10px',
                                        }}
                                        formatter={(value: number | undefined, name: string, props: any) => {
                                            const payload = props?.payload || {};
                                            if (name === 'BUY Avg Price') {
                                                return [
                                                    value != null ? `${formatFixed(value, 4)} (qty ${formatFixed(payload.buyQty, 2)})` : 'N/A',
                                                    name,
                                                ];
                                            }
                                            if (name === 'SELL Avg Price') {
                                                return [
                                                    value != null ? `${formatFixed(value, 4)} (qty ${formatFixed(payload.sellQty, 2)})` : 'N/A',
                                                    name,
                                                ];
                                            }
                                            return [value ?? 'N/A', name];
                                        }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                                    <Line type="monotone" dataKey="buyAvgPrice" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 3 }} connectNulls name="BUY Avg Price" />
                                    <Line type="monotone" dataKey="sellAvgPrice" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 3 }} connectNulls name="SELL Avg Price" />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>
        </div>
    ) : null;

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

                {backtestPanel}
                {backtestReportModal}
            </div>
        );
    }

    return (
        <div className="max-w-340 mx-auto px-6 py-4 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Market Analytics</h1>
                    <p className="text-sm text-gray-500 mt-1">Comprehensive analysis of your predictions</p>
                </div>
                <Link href="/polymarket/overview">
                    <button className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-100 rounded-xl transition-all border border-gray-200">
                        ← Back to Overview
                    </button>
                </Link>
            </div>

            {backtestPanel}

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
                                label={(entry: { name: string; value: number }) => {
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
                                        <p className="text-sm font-semibold text-gray-900 truncate">{market.marketName}</p>
                                        {market.category && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
                                                {market.category}
                                            </span>
                                        )}
                                    </div>
                                    <span className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-full ${market.outcome === 'YES'
                                        ? 'bg-gray-100 text-gray-700 border border-gray-200'
                                        : 'bg-gray-200 text-gray-700 border border-gray-300'
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

            {backtestReportModal}
        </div>
    );
}
