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

const PRIORITY_MARKET_RULES = [
    {
        url: 'https://polymarket.com/predictions/elon-tweets',
        slugHints: ['elon-tweets'],
        keywordHints: ['elon', 'tweet'],
    },
    {
        url: 'https://polymarket.com/predictions/economic-policy',
        slugHints: ['economic-policy'],
        keywordHints: ['economic policy', 'federal reserve', 'interest rate', 'inflation', 'economy', 'fed'],
    },
    {
        url: 'https://polymarket.com/predictions/nba',
        slugHints: ['nba'],
        keywordHints: ['nba', 'basketball'],
    },
    {
        url: 'https://polymarket.com/pop-culture/movies',
        slugHints: ['movies'],
        keywordHints: ['movie', 'movies', 'box office', 'film'],
    },
] as const;

function normalizeText(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function getPriorityRank(texts: string[]): number | null {
    const normalizedTexts = texts
        .map((text) => normalizeText(String(text || '')))
        .filter(Boolean);

    for (let index = 0; index < PRIORITY_MARKET_RULES.length; index += 1) {
        const rule = PRIORITY_MARKET_RULES[index];
        const hasSlugHit = rule.slugHints.some((hint) =>
            normalizedTexts.some((text) => text.includes(normalizeText(hint)))
        );
        const hasKeywordHit = rule.keywordHints.some((hint) => {
            const normalizedHint = normalizeText(hint);
            return normalizedTexts.some((text) => text.includes(normalizedHint));
        });

        if (hasSlugHit || hasKeywordHit) {
            return index;
        }
    }

    return null;
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

type BacktestWindowPreset = '1W' | '1M' | '3M';

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

function getPresetStartDate(preset: BacktestWindowPreset) {
    if (preset === '1W') return formatDateInput(7);
    if (preset === '3M') return formatDateInput(90);
    return formatDateInput(30);
}

function formatFixed(value: unknown, digits: number) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return (0).toFixed(digits);
    }
    return numeric.toFixed(digits);
}

function escapeHtml(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
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
    const backtestRunIdRef = useRef(0);

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
    const [windowPreset, setWindowPreset] = useState<BacktestWindowPreset>('1M');
    const [startDate, setStartDate] = useState(getPresetStartDate('1M'));
    const [endDate, setEndDate] = useState(today);
    const [initialCash, setInitialCash] = useState('1000');
    const [initialPosition, setInitialPosition] = useState('0');
    const [mode, setMode] = useState<'once' | 'repeat'>('repeat');
    const [isRunningBacktest, setIsRunningBacktest] = useState(false);
    const [backtestError, setBacktestError] = useState('');
    const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [shareChannels, setShareChannels] = useState<Array<'WHATSAPP' | 'DISCORD'>>(['DISCORD']);
    const [isSharingBacktestReport, setIsSharingBacktestReport] = useState(false);
    const [shareStatusMessage, setShareStatusMessage] = useState('');
    const [lastCompletedBacktestRunId, setLastCompletedBacktestRunId] = useState(0);

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
                const priorityRankMap = new Map<string, number>();
                for (const event of data) {
                    if (typeof event !== 'object' || event === null) continue;
                    const eventRecord = event as Record<string, unknown>;
                    const markets = eventRecord.markets;
                    if (!Array.isArray(markets)) continue;

                    for (const market of markets) {
                        if (typeof market !== 'object' || market === null) continue;
                        const marketRecord = market as Record<string, unknown>;
                        const clobIds = parseStringArray(marketRecord.clobTokenIds);
                        const tokenId = clobIds[0]?.trim() || String(marketRecord.conditionId || '').trim() || String(marketRecord.id || '').trim();
                        if (!tokenId || map.has(tokenId)) continue;

                        const question = String(marketRecord.question || eventRecord.title || tokenId).trim();
                        const priorityRank = getPriorityRank([
                            question,
                            String(eventRecord.title || ''),
                            String(eventRecord.slug || ''),
                            String(marketRecord.slug || ''),
                            String(marketRecord.url || ''),
                        ]);
                        map.set(tokenId, {
                            id: tokenId,
                            question: question || tokenId,
                        });

                        if (priorityRank !== null) {
                            const existingRank = priorityRankMap.get(tokenId);
                            if (existingRank == null || priorityRank < existingRank) {
                                priorityRankMap.set(tokenId, priorityRank);
                            }
                        }
                    }
                }

                if (!cancelled) {
                    const sorted = Array.from(map.values()).sort((left, right) => {
                        const leftPriorityRank = priorityRankMap.get(left.id);
                        const rightPriorityRank = priorityRankMap.get(right.id);

                        const leftIsPriority = leftPriorityRank !== undefined;
                        const rightIsPriority = rightPriorityRank !== undefined;
                        if (leftIsPriority !== rightIsPriority) return leftIsPriority ? -1 : 1;
                        if (leftIsPriority && rightIsPriority && leftPriorityRank !== rightPriorityRank) {
                            return (leftPriorityRank as number) - (rightPriorityRank as number);
                        }

                        return left.question.localeCompare(right.question);
                    });
                    setAvailableMarketOptions(sorted);
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
        const nextEnd = today;
        const nextStart = getPresetStartDate(windowPreset);
        setStartDate(nextStart);
        setEndDate(nextEnd);
    }, [today, windowPreset]);

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
            backtestRunIdRef.current += 1;
            setLastCompletedBacktestRunId(backtestRunIdRef.current);
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

    const conciseBacktestInsights = useMemo(() => {
        if (!backtestResult?.insights) return [];
        return backtestResult.insights
            .slice(0, 4)
            .map((line) => line.replace(/^Strategy\s+/i, '').replace(/^Signals\s+/i, 'Signals ').trim());
    }, [backtestResult]);

    const reportTitle = useMemo(() => {
        if (!backtestResult) return '';
        return `Backtest Performance Report - ${selectedMarketLabel}`;
    }, [backtestResult, selectedMarketLabel]);

    const resolvedMarketTokenId = useMemo(() => {
        if (!backtestResult) return '';
        return backtestResult.market.resolvedMarketId || backtestResult.config.marketId;
    }, [backtestResult]);

    const backtestDetailPath = useMemo(() => {
        if (!resolvedMarketTokenId) return '';
        return `/polymarket/market/${encodeURIComponent(resolvedMarketTokenId)}`;
    }, [resolvedMarketTokenId]);

    const backtestSiteUrl = useMemo(() => {
        if (!backtestDetailPath) return '';

        if (typeof window === 'undefined') {
            return backtestDetailPath;
        }

        return `${window.location.origin}${backtestDetailPath}`;
    }, [backtestDetailPath]);

    const reportLines = useMemo(() => {
        if (!backtestResult) return [] as string[];

        const insights = conciseBacktestInsights.length > 0
            ? conciseBacktestInsights.slice(0, 3).join(' | ')
            : 'No notable strategy notes generated.';
        const topSkipReason = backtestResult.skipReasonSummary?.[0];

        const reportGeneratedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);

        const lines = [
            `Generated (UTC): ${reportGeneratedAt}`,
            `Market: ${selectedMarketLabel}`,
            `Detail Page: ${backtestSiteUrl || backtestDetailPath || 'N/A'}`,
            '',
            '**Summary**',
            `- Net PnL: ${backtestResult.result.netPnL >= 0 ? '+' : ''}${formatFixed(backtestResult.result.netPnL, 2)} (${formatFixed(backtestResult.result.returnPct, 2)}%)`,
            `- Final Equity: ${formatFixed(backtestResult.result.finalEquity, 2)}`,
            `- Vs Buy & Hold: ${formatFixed(backtestResult.result.vsBuyAndHoldPct, 2)} pp`,
            '',
            '**Strategy**',
            `- Window: ${backtestResult.config.start} to ${backtestResult.config.end}`,
            `- Setup: ${backtestResult.config.action} | ${backtestResult.config.triggerType} | mode=${backtestResult.config.mode}`,
            `- Inputs: qty=${formatFixed(backtestResult.config.quantity, 2)}, cash=${formatFixed(backtestResult.config.initialCash, 2)}, position=${formatFixed(backtestResult.config.initialPosition, 2)}`,
            '',
            '**Execution & Risk**',
            `- Trades: executed=${backtestResult.result.tradesExecuted}, buy=${backtestResult.result.buyTrades}, sell=${backtestResult.result.sellTrades}`,
            `- Signals: matched=${backtestResult.result.matchedSignals}, skipped=${backtestResult.result.matchedButSkipped}`,
            `- Max Drawdown: ${formatFixed(backtestResult.result.maxDrawdownPct, 2)}%`,
            `- Market Data: points=${backtestResult.market.points}, range=${formatFixed(backtestResult.market.lowPrice, 4)} to ${formatFixed(backtestResult.market.highPrice, 4)}`,
            topSkipReason
                ? `- Top Skip Reason: ${topSkipReason.reason} (${topSkipReason.count})`
                : '- Top Skip Reason: none',
            '',
            '**Notes**',
            `- ${insights}`,
        ];

        return lines;
    }, [backtestDetailPath, backtestResult, backtestSiteUrl, conciseBacktestInsights, selectedMarketLabel]);

    const reportShareMessage = useMemo(() => {
        if (!backtestResult || !reportTitle) return '';
        return [reportTitle, ...reportLines.map((line) => `- ${line}`)].join('\n');
    }, [backtestResult, reportLines, reportTitle]);

    useEffect(() => {
        if (!backtestResult || !reportTitle || reportLines.length === 0 || lastCompletedBacktestRunId <= 0) {
            return;
        }

        let cancelled = false;

        async function sendAutoDiscordNotification() {
            try {
                const response = await fetch('/api/polymarket/backtest-report/share', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        title: 'Polymarket Backtest Completed (Auto)',
                        lines: reportLines,
                    }),
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data?.error || 'Failed to send Discord auto notification');
                }

                if (!cancelled) {
                    setShareStatusMessage('Backtest complete. Discord has been notified with the detail page link.');
                }
            } catch (error) {
                if (!cancelled) {
                    const message = error instanceof Error ? error.message : 'Discord auto notification failed';
                    setShareStatusMessage(`Backtest complete, but Discord notification failed: ${message}`);
                }
            }
        }

        void sendAutoDiscordNotification();

        return () => {
            cancelled = true;
        };
    }, [backtestResult, lastCompletedBacktestRunId, reportLines, reportTitle]);

    const latestExecutedTrades = useMemo(() => {
        if (!backtestResult) return [] as BacktestResult['trades'];
        return [...backtestResult.trades]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 20);
    }, [backtestResult]);

    const sortedSkipReasonSummary = useMemo(() => {
        if (!backtestResult?.skipReasonSummary) return [] as Array<{ reason: string; count: number }>;
        return [...backtestResult.skipReasonSummary]
            .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
    }, [backtestResult]);

    function downloadBacktestPdf() {
        if (!backtestResult) return;

        const popup = window.open('', '_blank');
        if (!popup) {
            setShareStatusMessage('Popup blocked. Please allow popups, then try Download PDF again.');
            return;
        }

        const tradeRows = backtestResult.trades
            .slice(-20)
            .reverse()
            .map((trade, index) => `
                                <tr>
                                        <td>${index + 1}</td>
                                        <td>${escapeHtml(trade.date)}</td>
                                        <td>${escapeHtml(trade.action)}</td>
                                        <td>${formatFixed(trade.price, 4)}</td>
                                        <td>${formatFixed(trade.quantity, 2)}</td>
                                        <td>${formatFixed(trade.cashAfter, 2)}</td>
                                        <td>${formatFixed(trade.positionAfter, 2)}</td>
                                </tr>
                        `)
            .join('');

        const notesRows = reportLines
            .map((line) => `<li>${escapeHtml(line)}</li>`)
            .join('');

        const html = `<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <title>${escapeHtml(reportTitle || 'Backtest Performance Report')}</title>
    <style>
        @page { size: A4; margin: 14mm; }
        body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 0; }
        h1 { font-size: 20px; margin: 0 0 6px; }
        h2 { font-size: 14px; margin: 16px 0 8px; }
        p { margin: 0; color: #374151; }
        .header { border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 14px; }
        .meta { font-size: 12px; color: #4b5563; }
        ul { margin: 0; padding-left: 20px; }
        li { margin-bottom: 6px; font-size: 12px; line-height: 1.4; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
        th { background: #f3f4f6; }
        .muted { color: #6b7280; font-size: 11px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${escapeHtml(reportTitle || 'Backtest Performance Report')}</h1>
        <p>${escapeHtml(selectedMarketLabel)}</p>
        <p class="meta">Generated from Analytics module</p>
    </div>

    <h2>Executive Summary</h2>
    <ul>${notesRows}</ul>

    <h2>Latest Execution Log (20 rows)</h2>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Time (UTC)</th>
                <th>Action</th>
                <th>Price</th>
                <th>Qty</th>
                <th>Cash After</th>
                <th>Position After</th>
            </tr>
        </thead>
        <tbody>
            ${tradeRows || '<tr><td colspan="7">No trades executed.</td></tr>'}
        </tbody>
    </table>

    <p class="muted" style="margin-top:12px;">This report is generated automatically for strategy review and communication purposes.</p>
</body>
</html>`;

        popup.document.open();
        popup.document.write(html);
        popup.document.close();
        popup.focus();
        window.setTimeout(() => {
            popup.print();
        }, 300);
    }

    async function shareBacktestReport() {
        if (!backtestResult) return;
        if (shareChannels.length === 0) {
            setShareStatusMessage('Please choose at least one channel.');
            return;
        }

        setIsSharingBacktestReport(true);
        setShareStatusMessage('');

        try {
            const tasks: Array<Promise<void>> = [];

            if (shareChannels.includes('WHATSAPP')) {
                const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(reportShareMessage)}`;
                window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
            }

            if (shareChannels.includes('DISCORD')) {
                tasks.push((async () => {
                    const response = await fetch('/api/polymarket/backtest-report/share', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            title: reportTitle,
                            lines: reportLines,
                        }),
                    });

                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        throw new Error(data?.error || 'Failed to share report to Discord');
                    }
                })());
            }

            await Promise.all(tasks);
            setShareStatusMessage(`Report shared via ${shareChannels.join(' + ')}.`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to share report';
            setShareStatusMessage(message);
        } finally {
            setIsSharingBacktestReport(false);
        }
    }

    const backtestPanel = (
        <div className="rounded-2xl border border-slate-300 bg-white shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 tracking-wide">Auto Buy/Sell Backtest</h3>
                    <p className="text-sm text-slate-600 mt-1">Configure strategy parameters and run a historical simulation.</p>
                </div>
                <button
                    onClick={runBacktest}
                    disabled={isRunningBacktest}
                    className="px-5 py-2.5 text-base font-semibold text-white bg-slate-900 hover:bg-black disabled:bg-slate-400 rounded-lg transition-colors"
                >
                    {isRunningBacktest ? 'Running...' : 'Run Backtest'}
                </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Strategy Parameters</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 [&>div]:rounded-lg [&>div]:border [&>div]:border-slate-200 [&>div]:bg-slate-50 [&>div]:p-3 [&_label]:mb-2 [&_label]:block [&_label]:text-sm [&_label]:font-semibold [&_label]:text-slate-700 [&_input]:h-11 [&_input]:rounded-lg [&_input]:border-slate-300 [&_input]:bg-white [&_input]:px-3 [&_input]:text-base [&_input]:font-medium [&_input]:text-slate-900 [&_select]:h-11 [&_select]:rounded-lg [&_select]:border-slate-300 [&_select]:bg-white [&_select]:px-3 [&_select]:text-base [&_select]:font-medium [&_select]:text-slate-900">
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
                            className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-left text-base font-medium text-slate-900 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
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
                    <p className="mt-2 truncate text-sm text-slate-600">Selected market is ready.</p>
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
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Backtest Window</label>
                    <select
                        value={windowPreset}
                        onChange={(event) => setWindowPreset(event.target.value as BacktestWindowPreset)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    >
                        <option value="1W">Last 1 week</option>
                        <option value="1M">Last 1 month</option>
                        <option value="3M">Last 3 months</option>
                    </select>
                    <p className="mt-1 text-[11px] text-gray-500">Range: {startDate} to {endDate}</p>
                    <p className="mt-1 text-xs font-medium text-red-600">Reminder: prioritize short-term markets (1 week to 1 month).</p>
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
                <div className="px-4 py-3 rounded-lg border border-red-300 bg-red-50 text-sm text-red-800 font-medium">
                    {backtestError}
                </div>
            )}

            {backtestResult && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Backtest ready</p>
                            <p className="text-sm text-gray-700 mt-1">Report generated for <span className="font-semibold text-gray-900">{selectedMarketLabel}</span></p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border ${backtestResult.result.netPnL >= 0 ? 'text-emerald-700 border-emerald-200 bg-emerald-50/50' : 'text-red-700 border-red-200 bg-red-50/50'}`}>
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

            <div className="relative w-full max-w-7xl rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
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
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Quick Actions</p>
                                <p className="text-sm text-gray-600 mt-1">Share report or jump to the page you want.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!backtestDetailPath) return;
                                        setIsReportModalOpen(false);
                                        window.location.assign(backtestDetailPath);
                                    }}
                                    className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 transition-colors"
                                >
                                    Go to Detail Page
                                </button>
                                <button
                                    onClick={downloadBacktestPdf}
                                    className="px-3.5 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 text-sm font-semibold hover:bg-gray-100 transition-colors"
                                >
                                    Download PDF
                                </button>
                            </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-4">
                            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={shareChannels.includes('WHATSAPP')}
                                    onChange={() => {
                                        setShareChannels((prev) => prev.includes('WHATSAPP')
                                            ? prev.filter((item) => item !== 'WHATSAPP')
                                            : [...prev, 'WHATSAPP']);
                                    }}
                                    className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
                                />
                                WhatsApp
                            </label>
                            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={shareChannels.includes('DISCORD')}
                                    onChange={() => {
                                        setShareChannels((prev) => prev.includes('DISCORD')
                                            ? prev.filter((item) => item !== 'DISCORD')
                                            : [...prev, 'DISCORD']);
                                    }}
                                    className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
                                />
                                Discord
                            </label>
                            <button
                                onClick={shareBacktestReport}
                                disabled={isSharingBacktestReport}
                                className="px-3.5 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black disabled:bg-gray-400 transition-colors"
                            >
                                {isSharingBacktestReport ? 'Sharing...' : 'Share Report'}
                            </button>
                        </div>

                        {shareStatusMessage ? (
                            <p className="mt-2 text-xs text-gray-600">{shareStatusMessage}</p>
                        ) : null}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="rounded-xl border border-gray-200 bg-white p-4">
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Net PnL</p>
                            <p className={`mt-1 text-xl font-bold ${backtestResult.result.netPnL >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                {backtestResult.result.netPnL >= 0 ? '+' : ''}{formatFixed(backtestResult.result.netPnL, 2)}
                            </p>
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-white p-4">
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Return</p>
                            <p className="mt-1 text-xl font-bold text-gray-900">{formatFixed(backtestResult.result.returnPct, 2)}%</p>
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-white p-4">
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Final Equity</p>
                            <p className="mt-1 text-xl font-bold text-gray-900">{formatFixed(backtestResult.result.finalEquity, 2)}</p>
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-white p-4">
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Max Drawdown</p>
                            <p className="mt-1 text-xl font-bold text-gray-900">{formatFixed(backtestResult.result.maxDrawdownPct, 2)}%</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-gray-200 bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Strategy Setup</p>
                            <div className="space-y-2 text-sm text-gray-700">
                                <div className="flex justify-between gap-4"><span className="text-gray-500">Date Range</span><span className="font-medium text-right">{backtestResult.config.start} to {backtestResult.config.end}</span></div>
                                <div className="flex justify-between gap-4"><span className="text-gray-500">Action / Trigger / Mode</span><span className="font-medium text-right">{backtestResult.config.action} / {backtestResult.config.triggerType} / {backtestResult.config.mode}</span></div>
                                <div className="flex justify-between gap-4"><span className="text-gray-500">Quantity</span><span className="font-medium text-right">{formatFixed(backtestResult.config.quantity, 2)}</span></div>
                                <div className="flex justify-between gap-4"><span className="text-gray-500">Initial Cash</span><span className="font-medium text-right">{formatFixed(backtestResult.config.initialCash, 2)}</span></div>
                                <div className="flex justify-between gap-4"><span className="text-gray-500">Initial Position</span><span className="font-medium text-right">{formatFixed(backtestResult.config.initialPosition, 2)}</span></div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Market Coverage</p>
                            <div className="space-y-2 text-sm text-gray-700">
                                <div className="flex justify-between gap-4"><span className="text-gray-500">Resolved Market ID</span><span className="font-medium text-right break-all">{backtestResult.market.resolvedMarketId || backtestResult.config.marketId}</span></div>
                                <div className="flex justify-between gap-4"><span className="text-gray-500">History Coverage</span><span className="font-medium text-right">{backtestResult.market.startDate} to {backtestResult.market.endDate}</span></div>
                                <div className="flex justify-between gap-4"><span className="text-gray-500">Points</span><span className="font-medium text-right">{backtestResult.market.points}</span></div>
                                <div className="flex justify-between gap-4"><span className="text-gray-500">Price Band</span><span className="font-medium text-right">{formatFixed(backtestResult.market.lowPrice, 4)} to {formatFixed(backtestResult.market.highPrice, 4)}</span></div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (backtestSiteUrl) {
                                            window.open(backtestSiteUrl, '_blank', 'noopener,noreferrer');
                                        }
                                    }}
                                    className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 transition-colors"
                                >
                                    Open Site Link
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!backtestSiteUrl) return;
                                        try {
                                            await navigator.clipboard.writeText(backtestSiteUrl);
                                            setShareStatusMessage('Site link copied to clipboard.');
                                        } catch {
                                            setShareStatusMessage('Unable to copy automatically. Please copy the URL manually.');
                                        }
                                    }}
                                    className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                                >
                                    Copy Link
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Execution Log (Latest 20, Newest First)</p>
                        {latestExecutedTrades.length === 0 ? (
                            <p className="text-sm text-gray-500">No trades executed in this window.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm text-left border-collapse">
                                    <thead className="sticky top-0 bg-white">
                                        <tr className="border-b border-gray-200 text-gray-500">
                                            <th className="py-2 pr-4 font-semibold">Time (UTC)</th>
                                            <th className="py-2 pr-4 font-semibold">Action</th>
                                            <th className="py-2 pr-4 font-semibold">Price</th>
                                            <th className="py-2 pr-4 font-semibold">Qty</th>
                                            <th className="py-2 pr-4 font-semibold">Trigger</th>
                                            <th className="py-2 pr-4 font-semibold">Cash After</th>
                                            <th className="py-2 pr-4 font-semibold">Pos After</th>
                                            <th className="py-2 pr-4 font-semibold">PnL</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-gray-700">
                                        {latestExecutedTrades.map((trade, index) => (
                                            <tr key={`${trade.date}-${trade.action}-${index}`} className="border-b border-gray-100 last:border-b-0 odd:bg-gray-50/40">
                                                <td className="py-2 pr-4 whitespace-nowrap">{trade.date}</td>
                                                <td className="py-2 pr-4 font-medium">
                                                    <span className={trade.action === 'BUY' ? 'text-blue-600' : 'text-red-500'}>{trade.action}</span>
                                                </td>
                                                <td className="py-2 pr-4">{formatFixed(trade.price, 4)}</td>
                                                <td className="py-2 pr-4">{formatFixed(trade.quantity, 2)}</td>
                                                <td className="py-2 pr-4">{formatFixed(trade.triggerValue, 4)}</td>
                                                <td className="py-2 pr-4">{formatFixed(trade.cashAfter, 2)}</td>
                                                <td className="py-2 pr-4">{formatFixed(trade.positionAfter, 2)}</td>
                                                <td className={`py-2 pr-4 font-medium whitespace-nowrap ${(trade as any).pnl && (trade as any).pnl > 0 ? 'text-green-600' :
                                                        (trade as any).pnl && (trade as any).pnl < 0 ? 'text-red-500' : 'text-gray-400'
                                                    }`}>
                                                    {(trade as any).pnl ? ((trade as any).pnl > 0 ? '+' : '') + formatFixed((trade as any).pnl, 2) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-gray-200 bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Skipped Signals (Sorted)</p>
                            {sortedSkipReasonSummary.length === 0 ? (
                                <p className="text-sm text-gray-500">No skipped signals.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-gray-200 text-gray-500">
                                                <th className="py-2 pr-4 font-semibold">Reason</th>
                                                <th className="py-2 pr-4 font-semibold">Count</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-gray-700">
                                            {sortedSkipReasonSummary.map((row) => (
                                                <tr key={row.reason} className="border-b border-gray-100 last:border-b-0">
                                                    <td className="py-2 pr-4">{row.reason}</td>
                                                    <td className="py-2 pr-4 font-medium">{row.count}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Analyst Notes</p>
                            {conciseBacktestInsights.length === 0 ? (
                                <p className="text-sm text-gray-500">No insights generated.</p>
                            ) : (
                                <ol className="space-y-2 text-sm text-gray-700 list-decimal pl-5">
                                    {conciseBacktestInsights.map((insight, index) => (
                                        <li key={`${index}-${insight.slice(0, 14)}`}>{insight}</li>
                                    ))}
                                </ol>
                            )}
                        </div>
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
                    <div className="flex items-center gap-2">
                        <Link href="/polymarket/analytics/research">
                            <button className="px-4 py-2 text-sm font-semibold text-white bg-gray-900 hover:bg-black rounded-xl transition-all border border-gray-900">
                                Research Markets
                            </button>
                        </Link>
                        <Link href="/polymarket/overview">
                            <button className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white hover:bg-gray-50 rounded-xl transition-all border border-gray-100">
                                ← Back to Overview
                            </button>
                        </Link>
                    </div>
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
        <div className="mx-auto w-full max-w-screen-2xl px-6 py-4 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Market Analytics</h1>
                    <p className="text-sm text-gray-500 mt-1">Comprehensive analysis of your predictions</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/polymarket/analytics/research">
                        <button className="px-4 py-2 text-sm font-semibold text-white bg-gray-900 hover:bg-black rounded-xl transition-all border border-gray-900">
                            Research Markets
                        </button>
                    </Link>
                    <Link href="/polymarket/overview">
                        <button className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-100 rounded-xl transition-all border border-gray-200">
                            ← Back to Overview
                        </button>
                    </Link>
                </div>
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
                                label={(entry) => {
                                    const data = selectedView === 'category' ? categoryData : outcomeData;
                                    const total = data.reduce((sum, item) => sum + item.value, 0);
                                    const value = Number(entry?.value ?? 0);
                                    const name = String(entry?.name ?? 'Unknown');
                                    const percent = total > 0 ? (value / total * 100).toFixed(1) : '0.0';
                                    return `${name}: ${percent}%`;
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
