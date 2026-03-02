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

    function getStatusColor(alert: Alert) {
        if (alert.is_triggered) return "text-green-600 bg-green-50";
        if (alert.is_active) return "text-blue-600 bg-blue-50";
        return "text-gray-600 bg-gray-50";
    }

    function getStatusText(alert: Alert) {
        if (alert.is_triggered) return "Triggered";
        if (alert.is_active) return "Active";
        return "Inactive";
    }

    function AlertCard({ alert }: { alert: Alert }) {
        const priceChange = alert.currentPrice - (alert.reference_price || alert.currentPrice);
        const priceChangePercent = alert.reference_price
            ? ((priceChange / alert.reference_price) * 100).toFixed(2)
            : "0.00";
        const isPositive = priceChange >= 0;

        return (
            <div className="bg-white rounded-xl p-5 border border-gray-100 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-bold text-gray-900">{alert.symbol}</h3>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getStatusColor(alert)}`}>
                                {getStatusText(alert)}
                            </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{alert.companyName}</p>
                    </div>
                    <div className="text-right">
                        <div className="text-xl font-bold text-gray-900">
                            ${alert.currentPrice.toFixed(2)}
                        </div>
                        <div className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            {isPositive ? '+' : ''}{priceChange.toFixed(2)} ({isPositive ? '+' : ''}{priceChangePercent}%)
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <div className="text-xs text-gray-500 mb-1">Alert Condition</div>
                    <div className="text-sm font-semibold text-gray-900">
                        {getAlertDescription(alert)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                        Reference: ${alert.reference_price?.toFixed(2)}
                    </div>
                </div>

                {alert.is_triggered && alert.triggered_at && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                        <div className="text-xs text-green-700 font-semibold mb-1">
                            🔔 Triggered
                        </div>
                        <div className="text-xs text-green-600">
                            Price: ${alert.triggered_price?.toFixed(2)} • {new Date(alert.triggered_at).toLocaleString()}
                        </div>
                    </div>
                )}

                <div className="flex gap-2">
                    {!alert.is_triggered && (
                        <button
                            onClick={() => toggleAlert(alert.alert_id, alert.is_active)}
                            disabled={loading === alert.alert_id}
                            className="flex-1 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            {loading === alert.alert_id ? "..." : alert.is_active ? "Deactivate" : "Activate"}
                        </button>
                    )}
                    <button
                        onClick={() => deleteAlert(alert.alert_id)}
                        disabled={loading === alert.alert_id}
                        className="flex-1 px-3 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                        {loading === alert.alert_id ? "..." : "Delete"}
                    </button>
                </div>

                <div className="text-xs text-gray-400 mt-2">
                    Created: {new Date(alert.created_at).toLocaleDateString()}
                </div>
            </div>
        );
    }

    if (alerts.length === 0) {
        return (
            <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
                <div className="text-6xl mb-4">🔔</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Price Alerts Yet</h3>
                <p className="text-gray-600 mb-6">
                    Create alerts to get notified when stock prices reach your target
                </p>
                <a
                    href="/h_stocks/stocks"
                    className="inline-block px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
                >
                    Browse Stocks
                </a>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Active Alerts */}
            {activeAlerts.length > 0 && (
                <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-4">
                        Active Alerts ({activeAlerts.length})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeAlerts.map(alert => (
                            <AlertCard key={alert.alert_id} alert={alert} />
                        ))}
                    </div>
                </div>
            )}

            {/* Triggered Alerts */}
            {triggeredAlerts.length > 0 && (
                <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-4">
                        Triggered Alerts ({triggeredAlerts.length})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {triggeredAlerts.map(alert => (
                            <AlertCard key={alert.alert_id} alert={alert} />
                        ))}
                    </div>
                </div>
            )}

            {/* Inactive Alerts */}
            {inactiveAlerts.length > 0 && (
                <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-4">
                        Inactive Alerts ({inactiveAlerts.length})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {inactiveAlerts.map(alert => (
                            <AlertCard key={alert.alert_id} alert={alert} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
