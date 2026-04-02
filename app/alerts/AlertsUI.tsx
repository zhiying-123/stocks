'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import CustomSelect from '@/app/components/CustomSelect';

type PolymarketAlert = {
    alert_id: number;
    market_id: string;
    market_question?: string;
    current_yes_percent?: number | null;
    current_no_percent?: number | null;
    notify_channels_list?: Array<'EMAIL' | 'DISCORD'>;
    outcome: 'YES' | 'NO';
    direction: 'ABOVE' | 'BELOW';
    target_price: number;
    target_price_percent: number;
    auto_buy_enabled?: boolean;
    auto_buy_quantity?: number | null;
    auto_buy_budget?: number | null;
    auto_buy_retry_max?: number;
    auto_buy_retry_count?: number;
    auto_buy_cooldown_m?: number;
    auto_buy_next_retry_at?: string | null;
    auto_buy_last_error?: string | null;
    tp_target_percent?: number | null;
    sl_target_percent?: number | null;
    parent_alert_id?: number | null;
    alert_tag?: string | null;
    source: string;
    is_active: boolean;
    created_at: string;
    triggered_at?: string | null;
};

type NotifyMode = 'BOTH' | 'EMAIL' | 'DISCORD';

function channelsToMode(channels?: Array<'EMAIL' | 'DISCORD'>): NotifyMode {
    const hasEmail = channels?.includes('EMAIL') ?? true;
    const hasDiscord = channels?.includes('DISCORD') ?? true;
    if (hasEmail && hasDiscord) return 'BOTH';
    if (hasEmail) return 'EMAIL';
    return 'DISCORD';
}

function modeToChannels(mode: NotifyMode): Array<'EMAIL' | 'DISCORD'> {
    if (mode === 'EMAIL') return ['EMAIL'];
    if (mode === 'DISCORD') return ['DISCORD'];
    return ['EMAIL', 'DISCORD'];
}

function modeLabel(mode: NotifyMode) {
    if (mode === 'EMAIL') return 'Email';
    if (mode === 'DISCORD') return 'Discord';
    return 'Email + Discord';
}

function getYesRule(item: PolymarketAlert) {
    if (item.outcome === 'YES') {
        return {
            operator: item.direction === 'BELOW' ? '≤' : '≥',
            threshold: item.target_price_percent,
        };
    }

    return {
        operator: item.direction === 'BELOW' ? '≥' : '≤',
        threshold: 100 - item.target_price_percent,
    };
}

function formatReason(reason?: string | null) {
    if (!reason) return null;
    const [code, detail] = reason.split(':');
    const normalizedCode = (code || '').trim().toUpperCase();

    if (normalizedCode.includes('INSUFFICIENT_BALANCE')) return `Insufficient balance${detail ? `:${detail}` : ''}`;
    if (normalizedCode.includes('BUDGET_EXCEEDED')) return `Budget exceeded${detail ? `:${detail}` : ''}`;
    if (normalizedCode.includes('MARKET_CLOSED')) return 'Market closed or unavailable';
    if (normalizedCode.includes('PRICE_INVALID')) return 'Price invalid at trigger time';
    if (normalizedCode.includes('WALLET_NOT_FOUND')) return 'Wallet not found';

    return reason;
}

function formatDateTime(value?: string | null) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString();
}

export default function AlertsUI({
    initialPolymarketAlerts,
}: {
    initialPolymarketAlerts: PolymarketAlert[];
}) {
    const [alerts, setAlerts] = useState<PolymarketAlert[]>(initialPolymarketAlerts);
    const [selectedMarketType, setSelectedMarketType] = useState<'STOCK' | 'POLYMARKET'>('POLYMARKET');
    const [editingAlertId, setEditingAlertId] = useState<number | null>(null);
    const [editOutcome, setEditOutcome] = useState<'YES' | 'NO'>('YES');
    const [editDirection, setEditDirection] = useState<'ABOVE' | 'BELOW'>('ABOVE');
    const [editTargetPrice, setEditTargetPrice] = useState('');
    const [editNotifyChannels, setEditNotifyChannels] = useState<Array<'EMAIL' | 'DISCORD'>>(['EMAIL', 'DISCORD']);
    const [editAutoBuyEnabled, setEditAutoBuyEnabled] = useState(false);
    const [editAutoBuyQuantity, setEditAutoBuyQuantity] = useState('10');
    const [autoBuyModalAlert, setAutoBuyModalAlert] = useState<PolymarketAlert | null>(null);
    const [autoBuyModalEnabled, setAutoBuyModalEnabled] = useState(false);
    const [autoBuyModalQuantity, setAutoBuyModalQuantity] = useState('10');
    const [autoBuyModalBudget, setAutoBuyModalBudget] = useState('');
    const [autoBuyModalRetryMax, setAutoBuyModalRetryMax] = useState('3');
    const [autoBuyModalCooldown, setAutoBuyModalCooldown] = useState('5');
    const [autoBuyModalTpPercent, setAutoBuyModalTpPercent] = useState('');
    const [autoBuyModalSlPercent, setAutoBuyModalSlPercent] = useState('');
    const [autoBuyModalLoading, setAutoBuyModalLoading] = useState(false);
    const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
    const [runAllLoading, setRunAllLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const activePolymarketAlerts = useMemo(
        () => alerts.filter((item) => item.is_active),
        [alerts]
    );

    const triggeredPolymarketAlerts = useMemo(
        () => alerts.filter((item) => !item.is_active),
        [alerts]
    );

    const editingAlert = useMemo(
        () => alerts.find((item) => item.alert_id === editingAlertId) || null,
        [alerts, editingAlertId]
    );

    function getCurrentYesPercent(item: PolymarketAlert) {
        return item.current_yes_percent;
    }

    function getStatusText(item: PolymarketAlert) {
        if (item.is_active) return 'Active';
        return item.triggered_at ? 'Triggered' : 'Paused';
    }

    function beginEdit(item: PolymarketAlert) {
        setError('');
        setSuccess('');
        setEditingAlertId(item.alert_id);
        setEditOutcome(item.outcome);
        setEditDirection(item.direction);
        setEditTargetPrice(item.target_price_percent.toFixed(2));
        setEditNotifyChannels(modeToChannels(channelsToMode(item.notify_channels_list)));
        setEditAutoBuyEnabled(Boolean(item.auto_buy_enabled));
        setEditAutoBuyQuantity(item.auto_buy_quantity ? item.auto_buy_quantity.toString() : '10');
    }

    function cancelEdit() {
        setEditingAlertId(null);
        setEditTargetPrice('');
    }

    function toggleEditNotifyChannel(channel: 'EMAIL' | 'DISCORD') {
        setEditNotifyChannels((prev) => {
            if (prev.includes(channel)) {
                return prev.filter((item) => item !== channel);
            }
            return [...prev, channel];
        });
    }

    function openAutoBuyModal(item: PolymarketAlert) {
        setError('');
        setSuccess('');
        setAutoBuyModalAlert(item);
        setAutoBuyModalEnabled(Boolean(item.auto_buy_enabled));
        setAutoBuyModalQuantity(item.auto_buy_quantity ? String(item.auto_buy_quantity) : '10');
        setAutoBuyModalBudget(item.auto_buy_budget ? String(item.auto_buy_budget) : '');
        setAutoBuyModalRetryMax(String(item.auto_buy_retry_max ?? 3));
        setAutoBuyModalCooldown(String(item.auto_buy_cooldown_m ?? 5));
        setAutoBuyModalTpPercent(item.tp_target_percent ? String(item.tp_target_percent) : '');
        setAutoBuyModalSlPercent(item.sl_target_percent ? String(item.sl_target_percent) : '');
    }

    function closeAutoBuyModal() {
        setAutoBuyModalAlert(null);
        setAutoBuyModalEnabled(false);
        setAutoBuyModalQuantity('10');
        setAutoBuyModalBudget('');
        setAutoBuyModalRetryMax('3');
        setAutoBuyModalCooldown('5');
        setAutoBuyModalTpPercent('');
        setAutoBuyModalSlPercent('');
        setAutoBuyModalLoading(false);
    }

    async function updateAutoBuy(alertId: number, enabled: boolean, quantity: number | null, extra?: {
        budget?: number | null;
        retryMax?: number;
        cooldownMinutes?: number;
        tpTargetPercent?: number | null;
        slTargetPercent?: number | null;
    }) {
        const res = await fetch('/api/polymarket/alerts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                alertId,
                autoBuyEnabled: enabled,
                autoBuyQuantity: enabled ? quantity : null,
                autoBuyBudget: enabled ? (extra?.budget ?? null) : null,
                autoBuyRetryMax: enabled ? (extra?.retryMax ?? 0) : 0,
                autoBuyCooldownMinutes: enabled ? (extra?.cooldownMinutes ?? 5) : 5,
                tpTargetPercent: enabled ? (extra?.tpTargetPercent ?? null) : null,
                slTargetPercent: enabled ? (extra?.slTargetPercent ?? null) : null,
            }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
            throw new Error(data?.error || 'Failed to update Auto Buy');
        }

        const updated = data.alert as PolymarketAlert;
        setAlerts((prev) => prev.map((item) => {
            if (item.alert_id !== alertId) return item;
            return {
                ...item,
                ...updated,
                market_question: item.market_question,
                current_yes_percent: item.current_yes_percent,
                current_no_percent: item.current_no_percent,
            };
        }));
    }

    async function handleAutoBuyToggle(item: PolymarketAlert) {
        setError('');
        setSuccess('');

        if (!item.is_active) {
            setError('Auto Buy can only be enabled on active alerts');
            return;
        }

        if (item.auto_buy_enabled) {
            setActionLoadingId(item.alert_id);
            try {
                await updateAutoBuy(item.alert_id, false, null);
                setSuccess('Auto Buy disabled');
            } catch (err) {
                console.error('Failed to disable Auto Buy:', err);
                setError(err instanceof Error ? err.message : 'Failed to disable Auto Buy');
            } finally {
                setActionLoadingId(null);
            }
            return;
        }

        openAutoBuyModal(item);
    }

    async function saveAutoBuyFromModal() {
        if (!autoBuyModalAlert) return;

        setError('');
        setSuccess('');

        const numericQuantity = Number(autoBuyModalQuantity);
        if (autoBuyModalEnabled && (!Number.isFinite(numericQuantity) || numericQuantity <= 0)) {
            setError('Auto buy quantity must be a positive number');
            return;
        }

        const numericBudget = autoBuyModalBudget ? Number(autoBuyModalBudget) : null;
        if (autoBuyModalEnabled && numericBudget != null && (!Number.isFinite(numericBudget) || numericBudget <= 0)) {
            setError('Budget must be a positive number');
            return;
        }

        const numericRetryMax = Number(autoBuyModalRetryMax || '0');
        if (autoBuyModalEnabled && (!Number.isFinite(numericRetryMax) || numericRetryMax < 0 || numericRetryMax > 20)) {
            setError('Retry max must be between 0 and 20');
            return;
        }

        const numericCooldown = Number(autoBuyModalCooldown || '5');
        if (autoBuyModalEnabled && (!Number.isFinite(numericCooldown) || numericCooldown < 1 || numericCooldown > 1440)) {
            setError('Cooldown must be between 1 and 1440 minutes');
            return;
        }

        const numericTp = autoBuyModalTpPercent ? Number(autoBuyModalTpPercent) : null;
        const numericSl = autoBuyModalSlPercent ? Number(autoBuyModalSlPercent) : null;
        if (autoBuyModalEnabled && numericTp != null && (!Number.isFinite(numericTp) || numericTp <= 0 || numericTp >= 100)) {
            setError('TP target must be between 0 and 100');
            return;
        }
        if (autoBuyModalEnabled && numericSl != null && (!Number.isFinite(numericSl) || numericSl <= 0 || numericSl >= 100)) {
            setError('SL target must be between 0 and 100');
            return;
        }

        setAutoBuyModalLoading(true);
        try {
            await updateAutoBuy(
                autoBuyModalAlert.alert_id,
                autoBuyModalEnabled,
                autoBuyModalEnabled ? numericQuantity : null,
                {
                    budget: autoBuyModalEnabled ? numericBudget : null,
                    retryMax: autoBuyModalEnabled ? Math.floor(numericRetryMax) : 0,
                    cooldownMinutes: autoBuyModalEnabled ? Math.floor(numericCooldown) : 5,
                    tpTargetPercent: autoBuyModalEnabled ? numericTp : null,
                    slTargetPercent: autoBuyModalEnabled ? numericSl : null,
                }
            );
            setSuccess(autoBuyModalEnabled ? 'Auto Buy enabled' : 'Auto Buy disabled');
            closeAutoBuyModal();
        } catch (err) {
            console.error('Failed to save Auto Buy:', err);
            setError(err instanceof Error ? err.message : 'Failed to save Auto Buy settings');
            setAutoBuyModalLoading(false);
        }
    }

    async function saveEdit(alertId: number) {
        setError('');
        setSuccess('');

        const numericTarget = Number(editTargetPrice);
        if (!Number.isFinite(numericTarget) || numericTarget <= 0 || numericTarget >= 100) {
            setError('Target must be between 0 and 100');
            return;
        }

        if (editNotifyChannels.length === 0) {
            setError('Please select at least one notification method');
            return;
        }

        if (editAutoBuyEnabled) {
            const numericAutoBuyQuantity = Number(editAutoBuyQuantity);
            if (!Number.isFinite(numericAutoBuyQuantity) || numericAutoBuyQuantity <= 0) {
                setError('Auto buy quantity must be a positive number');
                return;
            }
        }

        setActionLoadingId(alertId);
        try {
            const res = await fetch('/api/polymarket/alerts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    alertId,
                    outcome: editOutcome,
                    direction: editDirection,
                    targetPrice: numericTarget,
                    notifyChannels: editNotifyChannels,
                    autoBuyEnabled: editAutoBuyEnabled,
                    autoBuyQuantity: editAutoBuyEnabled ? Number(editAutoBuyQuantity) : null,
                }),
            });

            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setError(data?.error || 'Failed to update alert');
                return;
            }

            const updated = data.alert as PolymarketAlert;
            setAlerts((prev) => prev.map((item) => {
                if (item.alert_id !== alertId) return item;
                return {
                    ...item,
                    ...updated,
                    market_question: item.market_question,
                    current_yes_percent: item.current_yes_percent,
                    current_no_percent: item.current_no_percent,
                };
            }));
            setSuccess('Alert updated');
            cancelEdit();
        } catch (err) {
            console.error('Failed to update alert:', err);
            setError('Failed to update alert');
        } finally {
            setActionLoadingId(null);
        }
    }

    async function setPolymarketAlertActive(alertId: number, isActive: boolean) {
        setError('');
        setSuccess('');
        setActionLoadingId(alertId);

        try {
            const res = await fetch('/api/polymarket/alerts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    alertId,
                    isActive,
                }),
            });

            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setError(data?.error || `Failed to ${isActive ? 'resume' : 'pause'} alert`);
                return;
            }

            const updated = data.alert as PolymarketAlert;
            setAlerts((prev) => prev.map((item) => {
                if (item.alert_id !== alertId) return item;
                return {
                    ...item,
                    ...updated,
                    market_question: item.market_question,
                    current_yes_percent: item.current_yes_percent,
                    current_no_percent: item.current_no_percent,
                };
            }));
            setSuccess(isActive ? 'Alert resumed' : 'Alert paused');
            if (editingAlertId === alertId) {
                cancelEdit();
            }
        } catch (err) {
            console.error('Failed to change alert status:', err);
            setError(`Failed to ${isActive ? 'resume' : 'pause'} alert`);
        } finally {
            setActionLoadingId(null);
        }
    }

    async function deletePolymarketAlert(alertId: number) {
        setError('');
        setSuccess('');
        setActionLoadingId(alertId);
        try {
            const res = await fetch(`/api/polymarket/alerts?alertId=${alertId}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                setError(data?.error || 'Failed to delete alert');
                return;
            }

            setAlerts((prev) => prev.filter((item) => item.alert_id !== alertId));
            setSuccess('Alert deleted');
            if (editingAlertId === alertId) {
                cancelEdit();
            }
        } catch (err) {
            console.error('Failed to delete alert:', err);
            setError('Failed to delete alert');
        } finally {
            setActionLoadingId(null);
        }
    }

    async function refreshPolymarketAlerts() {
        const res = await fetch('/api/polymarket/alerts', {
            method: 'GET',
            cache: 'no-store',
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !Array.isArray(data?.alerts)) {
            throw new Error(data?.error || 'Failed to refresh alerts');
        }

        setAlerts((prev) => {
            const prevMap = new Map(prev.map((item) => [item.alert_id, item]));
            return data.alerts.map((item: PolymarketAlert) => {
                const prevItem = prevMap.get(item.alert_id);
                return {
                    ...item,
                    market_question: prevItem?.market_question || item.market_id,
                    current_yes_percent: prevItem?.current_yes_percent ?? null,
                    current_no_percent: prevItem?.current_no_percent ?? null,
                };
            });
        });
    }

    async function runAllPolymarketAlertsNow() {
        setError('');
        setSuccess('');
        setRunAllLoading(true);

        try {
            const res = await fetch('/api/polymarket/alerts/check?manual=1', {
                method: 'GET',
                cache: 'no-store',
            });

            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setError(data?.error || 'Failed to run all alerts check');
                return;
            }

            await refreshPolymarketAlerts();

            const checked = Number(data?.checked || 0);
            const triggered = Number(data?.triggered || 0);
            const autoBuyExecuted = Number(data?.autoBuyExecuted || 0);
            const autoBuyFailed = Number(data?.autoBuyFailed || 0);

            setSuccess(
                `Check completed: checked ${checked}, triggered ${triggered}, auto-buy executed ${autoBuyExecuted}, auto-buy failed ${autoBuyFailed}.`
            );
        } catch (err) {
            console.error('Failed to run all alerts check:', err);
            setError(err instanceof Error ? err.message : 'Failed to run all alerts check');
        } finally {
            setRunAllLoading(false);
        }
    }

    return (
        <div className="max-w-360 mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Alerts</h1>
                <p className="text-sm text-gray-500 mt-1">View and manage all alert events in one place</p>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-sm w-fit">
                <button
                    onClick={() => setSelectedMarketType('STOCK')}
                    className={`h-8 px-4 rounded-xl text-xs font-semibold transition-all ${selectedMarketType === 'STOCK'
                        ? 'bg-gray-900 text-white shadow-sm'
                        : 'bg-transparent text-gray-600 hover:bg-gray-100'
                        }`}
                >
                    Stock
                </button>
                <button
                    onClick={() => setSelectedMarketType('POLYMARKET')}
                    className={`h-8 px-4 rounded-xl text-xs font-semibold transition-all ${selectedMarketType === 'POLYMARKET'
                        ? 'bg-gray-900 text-white shadow-sm'
                        : 'bg-transparent text-gray-600 hover:bg-gray-100'
                        }`}
                >
                    Polymarket
                </button>
            </div>

            {selectedMarketType === 'STOCK' ? (
                <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">📈</span>
                            <h2 className="text-lg font-bold text-gray-900">Stock Alerts</h2>
                        </div>
                        <Link
                            href="/h_stocks/stocks"
                            className="h-8 px-3 rounded-xl border border-gray-200 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold flex items-center"
                        >
                            Set New Alert
                        </Link>
                    </div>
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center">
                        <p className="text-base font-semibold text-gray-700">Coming Soon</p>
                        <p className="text-sm text-gray-500 mt-1">Stock alert setup is not available yet.</p>
                    </div>
                </section>
            ) : (
                <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">🎲</span>
                            <h2 className="text-lg font-bold text-gray-900">Polymarket Alerts</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={runAllPolymarketAlertsNow}
                                disabled={runAllLoading || actionLoadingId !== null}
                                className="h-8 px-3 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold disabled:opacity-50"
                            >
                                {runAllLoading ? 'Running...' : 'Run All Now'}
                            </button>
                            <Link
                                href="/polymarket"
                                className="h-8 px-3 rounded-xl border border-gray-200 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold flex items-center"
                            >
                                Set New Alert
                            </Link>
                        </div>
                    </div>

                    {error && <p className="text-xs text-red-600">{error}</p>}
                    {success && <p className="text-xs text-emerald-600">{success}</p>}

                    <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-3">Active Events ({activePolymarketAlerts.length})</h3>
                        {activePolymarketAlerts.length === 0 ? (
                            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-500">
                                No active alert events.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                                {activePolymarketAlerts.map((item) => (
                                    <div key={item.alert_id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-gray-900 line-clamp-2">{item.market_question || item.market_id}</p>
                                                <p className="text-xs text-gray-600 mt-1">
                                                    Current YES: {getCurrentYesPercent(item) != null ? `${getCurrentYesPercent(item)?.toFixed(2)}%` : '-'}
                                                    {' · '}Rule: YES {getYesRule(item).operator} {getYesRule(item).threshold.toFixed(2)}%
                                                </p>
                                                <p className="text-xs text-gray-500 mt-0.5">Notify: {modeLabel(channelsToMode(item.notify_channels_list))}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    Auto Buy: {item.auto_buy_enabled ? `${Number(item.auto_buy_quantity || 0).toFixed(2)} shares` : 'Off'}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    Budget: {item.auto_buy_budget != null ? item.auto_buy_budget.toFixed(2) : '-'}
                                                    {' · '}Retry: {item.auto_buy_retry_count ?? 0}/{item.auto_buy_retry_max ?? 0}
                                                    {' · '}Cooldown: {item.auto_buy_cooldown_m ?? 5}m
                                                </p>
                                                {(item.tp_target_percent != null || item.sl_target_percent != null) && (
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        TP/SL: {item.tp_target_percent != null ? `TP ${Number(item.tp_target_percent).toFixed(2)}%` : '-'}
                                                        {' · '}
                                                        {item.sl_target_percent != null ? `SL ${Number(item.sl_target_percent).toFixed(2)}%` : '-'}
                                                    </p>
                                                )}
                                                {item.auto_buy_next_retry_at && (
                                                    <p className="text-xs text-amber-700 mt-0.5">Next retry: {formatDateTime(item.auto_buy_next_retry_at)}</p>
                                                )}
                                                {item.auto_buy_last_error && (
                                                    <p className="text-xs text-red-600 mt-0.5">Last error: {formatReason(item.auto_buy_last_error)}</p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleAutoBuyToggle(item)}
                                                disabled={actionLoadingId === item.alert_id}
                                                className={`h-8 px-3 rounded-full border text-xs font-semibold whitespace-nowrap shadow-sm transition-all inline-flex items-center gap-1.5 disabled:opacity-50 ${item.auto_buy_enabled
                                                    ? 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'
                                                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                                                    }`}
                                            >
                                                <span
                                                    className={`w-4 h-4 rounded-full text-[10px] leading-4 text-center font-bold ${item.auto_buy_enabled
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-gray-100 text-gray-500'
                                                        }`}
                                                >
                                                    {item.auto_buy_enabled ? '✓' : '×'}
                                                </span>
                                                <span>Auto Buy</span>
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[11px] px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 font-medium">
                                                {getStatusText(item)}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => beginEdit(item)}
                                                    disabled={actionLoadingId === item.alert_id}
                                                    className="h-8 px-3 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => setPolymarketAlertActive(item.alert_id, false)}
                                                    disabled={actionLoadingId === item.alert_id}
                                                    className="h-8 px-3 rounded-lg border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                                                >
                                                    Pause
                                                </button>
                                                <button
                                                    onClick={() => deletePolymarketAlert(item.alert_id)}
                                                    disabled={actionLoadingId === item.alert_id}
                                                    className="h-8 px-3 rounded-lg border border-red-300 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-3">Inactive Events ({triggeredPolymarketAlerts.length})</h3>
                        {triggeredPolymarketAlerts.length === 0 ? (
                            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-500">
                                No inactive alert events.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                                {triggeredPolymarketAlerts.map((item) => (
                                    <div key={item.alert_id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-gray-900 line-clamp-2">{item.market_question || item.market_id}</p>
                                                <p className="text-xs text-gray-600 mt-1">
                                                    Current YES: {getCurrentYesPercent(item) != null ? `${getCurrentYesPercent(item)?.toFixed(2)}%` : '-'}
                                                    {' · '}Rule: YES {getYesRule(item).operator} {getYesRule(item).threshold.toFixed(2)}%
                                                </p>
                                                <p className="text-xs text-gray-500 mt-0.5">Notify: {modeLabel(channelsToMode(item.notify_channels_list))}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    Auto Buy: {item.auto_buy_enabled ? `${Number(item.auto_buy_quantity || 0).toFixed(2)} shares` : 'Off'}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    Budget: {item.auto_buy_budget != null ? item.auto_buy_budget.toFixed(2) : '-'}
                                                    {' · '}Retry: {item.auto_buy_retry_count ?? 0}/{item.auto_buy_retry_max ?? 0}
                                                    {' · '}Cooldown: {item.auto_buy_cooldown_m ?? 5}m
                                                </p>
                                                {(item.tp_target_percent != null || item.sl_target_percent != null) && (
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        TP/SL: {item.tp_target_percent != null ? `TP ${Number(item.tp_target_percent).toFixed(2)}%` : '-'}
                                                        {' · '}
                                                        {item.sl_target_percent != null ? `SL ${Number(item.sl_target_percent).toFixed(2)}%` : '-'}
                                                    </p>
                                                )}
                                                {item.auto_buy_next_retry_at && (
                                                    <p className="text-xs text-amber-700 mt-0.5">Next retry: {formatDateTime(item.auto_buy_next_retry_at)}</p>
                                                )}
                                                {item.auto_buy_last_error && (
                                                    <p className="text-xs text-red-600 mt-0.5">Last error: {formatReason(item.auto_buy_last_error)}</p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleAutoBuyToggle(item)}
                                                disabled={actionLoadingId === item.alert_id || !item.is_active}
                                                className={`h-8 px-3 rounded-full border text-xs font-semibold whitespace-nowrap shadow-sm transition-all inline-flex items-center gap-1.5 disabled:opacity-50 ${item.auto_buy_enabled
                                                    ? 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'
                                                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                                                    }`}
                                                title={item.is_active ? 'Toggle Auto Buy' : 'Inactive alert cannot enable Auto Buy'}
                                            >
                                                <span
                                                    className={`w-4 h-4 rounded-full text-[10px] leading-4 text-center font-bold ${item.auto_buy_enabled
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-gray-100 text-gray-500'
                                                        }`}
                                                >
                                                    {item.auto_buy_enabled ? '✓' : '×'}
                                                </span>
                                                <span>Auto Buy</span>
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[11px] px-2 py-0.5 rounded-full border border-gray-300 bg-gray-100 text-gray-700 font-medium">
                                                {getStatusText(item)}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setPolymarketAlertActive(item.alert_id, true)}
                                                    disabled={actionLoadingId === item.alert_id}
                                                    className="h-8 px-3 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                                >
                                                    Resume
                                                </button>
                                                <button
                                                    onClick={() => deletePolymarketAlert(item.alert_id)}
                                                    disabled={actionLoadingId === item.alert_id}
                                                    className="h-8 px-3 rounded-lg border border-red-300 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            )}

            {editingAlert && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                    <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-200 shadow-2xl">
                        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-bold text-gray-900">Edit Alert</h3>
                                <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{editingAlert.market_question || editingAlert.market_id}</p>
                            </div>
                            <button
                                onClick={cancelEdit}
                                className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-5 space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <label className="block">
                                    <span className="block text-[11px] font-semibold text-gray-600 mb-1">Outcome</span>
                                    <CustomSelect
                                        value={editOutcome}
                                        onChange={(nextValue) => setEditOutcome(nextValue)}
                                        disabled={actionLoadingId === editingAlert.alert_id}
                                        size="compact"
                                        tone="soft"
                                        options={[
                                            { value: 'YES', label: 'YES' },
                                            { value: 'NO', label: 'NO' },
                                        ]}
                                    />
                                </label>
                                <label className="block">
                                    <span className="block text-[11px] font-semibold text-gray-600 mb-1">Direction</span>
                                    <CustomSelect
                                        value={editDirection}
                                        onChange={(nextValue) => setEditDirection(nextValue)}
                                        disabled={actionLoadingId === editingAlert.alert_id}
                                        size="compact"
                                        tone="soft"
                                        options={[
                                            { value: 'ABOVE', label: 'ABOVE' },
                                            { value: 'BELOW', label: 'BELOW' },
                                        ]}
                                    />
                                </label>
                            </div>

                            <label className="block">
                                <span className="block text-[11px] font-semibold text-gray-600 mb-1">Target Probability (%)</span>
                                <input
                                    type="number"
                                    min="0.01"
                                    max="99.99"
                                    step="0.01"
                                    inputMode="decimal"
                                    value={editTargetPrice}
                                    onChange={(e) => setEditTargetPrice(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
                                />
                            </label>

                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                                <span className="block text-[11px] font-semibold text-gray-600 mb-2">Notify Via</span>
                                <div className="flex flex-wrap gap-3">
                                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                                        <input
                                            type="checkbox"
                                            checked={editNotifyChannels.includes('EMAIL')}
                                            onChange={() => toggleEditNotifyChannel('EMAIL')}
                                            disabled={actionLoadingId === editingAlert.alert_id}
                                            className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-300"
                                        />
                                        Email
                                    </label>
                                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                                        <input
                                            type="checkbox"
                                            checked={editNotifyChannels.includes('DISCORD')}
                                            onChange={() => toggleEditNotifyChannel('DISCORD')}
                                            disabled={actionLoadingId === editingAlert.alert_id}
                                            className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-300"
                                        />
                                        Discord
                                    </label>
                                </div>
                            </div>

                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <span className="block text-[11px] font-semibold text-gray-600">Auto Buy</span>
                                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                        <input
                                            type="checkbox"
                                            checked={editAutoBuyEnabled}
                                            onChange={(e) => setEditAutoBuyEnabled(e.target.checked)}
                                            disabled={actionLoadingId === editingAlert.alert_id}
                                            className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-300"
                                        />
                                        Enable
                                    </label>
                                </div>
                                <input
                                    type="number"
                                    min="0.1"
                                    step="0.1"
                                    inputMode="decimal"
                                    value={editAutoBuyQuantity}
                                    onChange={(e) => setEditAutoBuyQuantity(e.target.value)}
                                    disabled={!editAutoBuyEnabled || actionLoadingId === editingAlert.alert_id}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-100"
                                    placeholder="Auto buy quantity"
                                />
                            </div>
                        </div>

                        <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
                            <button
                                onClick={cancelEdit}
                                disabled={actionLoadingId === editingAlert.alert_id}
                                className="h-8 px-3 rounded-xl border border-gray-200 bg-gray-100 text-xs font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => saveEdit(editingAlert.alert_id)}
                                disabled={actionLoadingId === editingAlert.alert_id}
                                className="h-8 px-3 rounded-xl border border-gray-200 bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold disabled:opacity-50"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {autoBuyModalAlert && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-2xl">
                        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-bold text-gray-900">Auto Buy Settings</h3>
                                <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{autoBuyModalAlert.market_question || autoBuyModalAlert.market_id}</p>
                            </div>
                            <button
                                onClick={closeAutoBuyModal}
                                disabled={autoBuyModalLoading}
                                className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-5 space-y-3">
                            <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={autoBuyModalEnabled}
                                    onChange={(e) => setAutoBuyModalEnabled(e.target.checked)}
                                    disabled={autoBuyModalLoading}
                                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-300"
                                />
                                Enable Auto Buy
                            </label>

                            <label className="block">
                                <span className="block text-[11px] font-semibold text-gray-600 mb-1">Auto Buy Quantity</span>
                                <input
                                    type="number"
                                    min="0.1"
                                    step="0.1"
                                    inputMode="decimal"
                                    value={autoBuyModalQuantity}
                                    onChange={(e) => setAutoBuyModalQuantity(e.target.value)}
                                    disabled={!autoBuyModalEnabled || autoBuyModalLoading}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-100"
                                    placeholder="e.g. 10"
                                />
                            </label>

                            <label className="block">
                                <span className="block text-[11px] font-semibold text-gray-600 mb-1">Budget Cap (wallet currency)</span>
                                <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    inputMode="decimal"
                                    value={autoBuyModalBudget}
                                    onChange={(e) => setAutoBuyModalBudget(e.target.value)}
                                    disabled={!autoBuyModalEnabled || autoBuyModalLoading}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-100"
                                    placeholder="Leave blank for no cap"
                                />
                            </label>

                            <div className="grid grid-cols-2 gap-2">
                                <label className="block">
                                    <span className="block text-[11px] font-semibold text-gray-600 mb-1">Retry Max</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="20"
                                        step="1"
                                        inputMode="numeric"
                                        value={autoBuyModalRetryMax}
                                        onChange={(e) => setAutoBuyModalRetryMax(e.target.value)}
                                        disabled={!autoBuyModalEnabled || autoBuyModalLoading}
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-100"
                                    />
                                </label>
                                <label className="block">
                                    <span className="block text-[11px] font-semibold text-gray-600 mb-1">Cooldown (minutes)</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="1440"
                                        step="1"
                                        inputMode="numeric"
                                        value={autoBuyModalCooldown}
                                        onChange={(e) => setAutoBuyModalCooldown(e.target.value)}
                                        disabled={!autoBuyModalEnabled || autoBuyModalLoading}
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-100"
                                    />
                                </label>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <label className="block">
                                    <span className="block text-[11px] font-semibold text-gray-600 mb-1">TP Target (%)</span>
                                    <input
                                        type="number"
                                        min="0.01"
                                        max="99.99"
                                        step="0.01"
                                        inputMode="decimal"
                                        value={autoBuyModalTpPercent}
                                        onChange={(e) => setAutoBuyModalTpPercent(e.target.value)}
                                        disabled={!autoBuyModalEnabled || autoBuyModalLoading}
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-100"
                                        placeholder="Optional"
                                    />
                                </label>
                                <label className="block">
                                    <span className="block text-[11px] font-semibold text-gray-600 mb-1">SL Target (%)</span>
                                    <input
                                        type="number"
                                        min="0.01"
                                        max="99.99"
                                        step="0.01"
                                        inputMode="decimal"
                                        value={autoBuyModalSlPercent}
                                        onChange={(e) => setAutoBuyModalSlPercent(e.target.value)}
                                        disabled={!autoBuyModalEnabled || autoBuyModalLoading}
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-100"
                                        placeholder="Optional"
                                    />
                                </label>
                            </div>
                        </div>

                        <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
                            <button
                                onClick={closeAutoBuyModal}
                                disabled={autoBuyModalLoading}
                                className="h-8 px-3 rounded-xl border border-gray-200 bg-gray-100 text-xs font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveAutoBuyFromModal}
                                disabled={autoBuyModalLoading}
                                className="h-8 px-3 rounded-xl border border-gray-200 bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold disabled:opacity-50"
                            >
                                {autoBuyModalLoading ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
