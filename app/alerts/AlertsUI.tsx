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
    const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
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
                        <Link
                            href="/polymarket"
                            className="h-8 px-3 rounded-xl border border-gray-200 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold flex items-center"
                        >
                            Set New Alert
                        </Link>
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
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900 line-clamp-2">{item.market_question || item.market_id}</p>
                                            <p className="text-xs text-gray-600 mt-1">
                                                Current YES: {getCurrentYesPercent(item) != null ? `${getCurrentYesPercent(item)?.toFixed(2)}%` : '-'}
                                                {' · '}Rule: YES {getYesRule(item).operator} {getYesRule(item).threshold.toFixed(2)}%
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5">Notify: {modeLabel(channelsToMode(item.notify_channels_list))}</p>
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
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900 line-clamp-2">{item.market_question || item.market_id}</p>
                                            <p className="text-xs text-gray-600 mt-1">
                                                Current YES: {getCurrentYesPercent(item) != null ? `${getCurrentYesPercent(item)?.toFixed(2)}%` : '-'}
                                                {' · '}Rule: YES {getYesRule(item).operator} {getYesRule(item).threshold.toFixed(2)}%
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5">Notify: {modeLabel(channelsToMode(item.notify_channels_list))}</p>
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
        </div>
    );
}
