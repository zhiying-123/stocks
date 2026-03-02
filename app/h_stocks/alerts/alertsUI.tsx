"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Alert {
    alert_id: number;
    symbol: string;
    companyName: string;
    alert_type: string;
    condition: string;
    target_price: number | null;
    percentage_change: number | null;
    reference_price: number | null;
    currentPrice: number;
    is_active: boolean;
    is_triggered: boolean;
    triggered_at: Date | null;
    triggered_price: number | null;
    created_at: Date;
}

interface AlertsUIProps {
    alerts: Alert[];
}

export default function AlertsUI({ alerts }: AlertsUIProps) {
    const router = useRouter();
    const [loading, setLoading] = useState<number | null>(null);

    const activeAlerts = alerts.filter(a => a.is_active && !a.is_triggered);
    const triggeredAlerts = alerts.filter(a => a.is_triggered);
    const inactiveAlerts = alerts.filter(a => !a.is_active && !a.is_triggered);

    async function deleteAlert(alertId: number) {
        if (!confirm("Are you sure you want to delete this alert?")) return;

        setLoading(alertId);
        try {
            const res = await fetch(`/api/alerts?alertId=${alertId}`, {
                method: "DELETE",
            });

            if (!res.ok) throw new Error("Failed to delete alert");

            router.refresh();
        } catch (error) {
            alert("Failed to delete alert");
        } finally {
            setLoading(null);
        }
    }

    async function toggleAlert(alertId: number, currentStatus: boolean) {
        setLoading(alertId);
        try {
            const res = await fetch("/api/alerts", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ alertId, isActive: !currentStatus }),
            });

            if (!res.ok) throw new Error("Failed to update alert");

            router.refresh();
        } catch (error) {
            alert("Failed to update alert");
        } finally {
            setLoading(null);
        }
    }

    function getAlertDescription(alert: Alert) {
        if (alert.alert_type === "TARGET_PRICE") {
            return `${alert.condition === "ABOVE" ? "Above" : "Below"} $${alert.target_price?.toFixed(2)}`;
        } else {
            return `${alert.condition === "ABOVE" ? "+" : "-"}${alert.percentage_change}% change`;
        }
    }

    function AlertCard({ alert }: { alert: Alert }) {
        const priceChange = alert.currentPrice - (alert.reference_price || alert.currentPrice);
        const priceChangePercent = alert.reference_price
            ? ((priceChange / alert.reference_price) * 100).toFixed(2)
            : "0.00";
        const isPositive = priceChange >= 0;

        return (
            <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
                {/* Status Indicator Bar */}
                <div className={`h-1.5 ${alert.is_triggered
                    ? 'bg-emerald-500'
                    : alert.is_active
                        ? 'bg-gray-900'
                        : 'bg-gray-300'
                    }`} />

                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center text-white text-sm font-bold">
                                {alert.symbol.substring(0, 2)}
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-gray-900">{alert.symbol}</h3>
                                <p className="text-xs text-gray-400">{alert.companyName}</p>
                            </div>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${alert.is_triggered
                            ? 'text-emerald-700 bg-emerald-50'
                            : alert.is_active
                                ? 'text-gray-700 bg-gray-100'
                                : 'text-gray-600 bg-gray-50'
                            }`}>
                            {alert.is_triggered ? '✓ Triggered' : alert.is_active ? '● Active' : '○ Inactive'}
                        </span>
                    </div>

                    {/* Price Info */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                                Current Price
                            </span>
                            <p className="text-xl font-bold text-gray-900">
                                ${alert.currentPrice.toFixed(2)}
                            </p>
                        </div>
                        <div className="text-right">
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                                Change
                            </span>
                            <div className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isPositive ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'
                                }`}>
                                <span>{isPositive ? '↑' : '↓'}</span>
                                <span>{isPositive ? '+' : ''}{priceChangePercent}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Alert Condition */}
                    <div className="bg-gray-50 rounded-xl p-3 mb-4">
                        <div className="flex items-center gap-2 mb-1">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Target</span>
                        </div>
                        <p className="text-sm font-bold text-gray-900">
                            {getAlertDescription(alert)}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Set at: ${alert.reference_price?.toFixed(2)}
                        </p>
                    </div>

                    {/* Triggered Info */}
                    {alert.is_triggered && alert.triggered_at && (
                        <div className="bg-emerald-50 rounded-xl p-3 mb-4 border border-emerald-100">
                            <div className="flex items-center gap-2 mb-1">
                                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="text-xs font-bold text-emerald-700">Alert Triggered!</span>
                            </div>
                            <p className="text-xs text-emerald-700">
                                Price reached ${alert.triggered_price?.toFixed(2)} • {new Date(alert.triggered_at).toLocaleDateString()}
                            </p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                        {!alert.is_triggered && (
                            <button
                                onClick={() => toggleAlert(alert.alert_id, alert.is_active)}
                                disabled={loading === alert.alert_id}
                                className={`flex-1 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${alert.is_active
                                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    : 'bg-gray-900 text-white hover:bg-gray-800'
                                    } disabled:opacity-50`}
                            >
                                {loading === alert.alert_id ? "..." : alert.is_active ? "Pause" : "Activate"}
                            </button>
                        )}
                        <button
                            onClick={() => deleteAlert(alert.alert_id)}
                            disabled={loading === alert.alert_id}
                            className="flex-1 px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all disabled:opacity-50"
                        >
                            {loading === alert.alert_id ? "..." : "Delete"}
                        </button>
                    </div>

                    {/* Timestamp */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <p className="text-xs text-gray-400">
                            Created {new Date(alert.created_at).toLocaleDateString('en-MY', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                            })}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (alerts.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Price Alerts Yet</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                    Create your first alert to get notified when stock prices reach your target
                </p>
                <a
                    href="/h_stocks/stocks"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white font-semibold text-sm rounded-xl hover:bg-gray-800 transition-all shadow-sm"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Browse Stocks
                </a>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Active Alerts */}
            {activeAlerts.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-5">
                        <div className="w-1.5 h-5 rounded-full bg-gray-900" />
                        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Active Alerts</h2>
                        <span className="text-xs font-semibold text-gray-400">({activeAlerts.length})</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {activeAlerts.map(alert => (
                            <AlertCard key={alert.alert_id} alert={alert} />
                        ))}
                    </div>
                </div>
            )}

            {/* Triggered Alerts */}
            {triggeredAlerts.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-5">
                        <div className="w-1.5 h-5 rounded-full bg-emerald-500" />
                        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Triggered Alerts</h2>
                        <span className="text-xs font-semibold text-gray-400">({triggeredAlerts.length})</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {triggeredAlerts.map(alert => (
                            <AlertCard key={alert.alert_id} alert={alert} />
                        ))}
                    </div>
                </div>
            )}

            {/* Inactive Alerts */}
            {inactiveAlerts.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-5">
                        <div className="w-1.5 h-5 rounded-full bg-gray-400" />
                        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Inactive Alerts</h2>
                        <span className="text-xs font-semibold text-gray-400">({inactiveAlerts.length})</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {inactiveAlerts.map(alert => (
                            <AlertCard key={alert.alert_id} alert={alert} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
