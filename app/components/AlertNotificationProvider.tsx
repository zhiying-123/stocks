"use client";

import { useEffect, useState } from "react";

interface AlertNotification {
    alert_id: number;
    symbol: string;
    message: string;
    triggered_at: string;
    triggered_price: number;
}

export default function AlertNotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<AlertNotification[]>([]);
    const [permission, setPermission] = useState<NotificationPermission>("default");

    // Request notification permission on mount
    useEffect(() => {
        if ("Notification" in window) {
            setPermission(Notification.permission);

            if (Notification.permission === "default") {
                Notification.requestPermission().then(perm => {
                    setPermission(perm);
                });
            }
        }
    }, []);

    // Check for triggered alerts when user visits
    useEffect(() => {
        async function checkTriggeredAlerts() {
            try {
                const res = await fetch("/api/alerts/triggered");
                if (res.ok) {
                    const data = await res.json();
                    if (data.alerts && data.alerts.length > 0) {
                        setNotifications(data.alerts);

                        // Show browser notification
                        if (permission === "granted") {
                            data.alerts.forEach((alert: AlertNotification) => {
                                new Notification(`🔔 Price Alert: ${alert.symbol}`, {
                                    body: alert.message,
                                    icon: "/favicon.ico",
                                    tag: `alert-${alert.alert_id}`,
                                });
                            });
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to check triggered alerts:", error);
            }
        }

        // Check on mount
        checkTriggeredAlerts();

        // Check every 5 minutes while user is on the site
        const interval = setInterval(checkTriggeredAlerts, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [permission]);

    const dismissNotification = (alertId: number) => {
        setNotifications(prev => prev.filter(n => n.alert_id !== alertId));
    };

    return (
        <>
            {children}

            {/* In-app notification banners */}
            <div className="fixed bottom-4 right-4 z-9999 space-y-2 max-w-sm">
                {notifications.map((notif) => (
                    <div
                        key={notif.alert_id}
                        className="bg-white rounded-xl shadow-2xl border border-orange-200 p-4 animate-in slide-in-from-bottom-5"
                    >
                        <div className="flex items-start gap-3">
                            <div className="shrink-0">
                                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                                    <span className="text-xl">🔔</span>
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="text-sm font-bold text-gray-900">
                                        Price Alert Triggered
                                    </h4>
                                    <button
                                        onClick={() => dismissNotification(notif.alert_id)}
                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <p className="text-sm text-gray-600 mb-2">
                                    <span className="font-semibold text-orange-600">{notif.symbol}</span> — {notif.message}
                                </p>
                                <p className="text-xs text-gray-400">
                                    Price: ${notif.triggered_price.toFixed(2)}
                                </p>
                                <div className="flex gap-2 mt-3">
                                    <a
                                        href={`/h_stocks/stocks/${notif.symbol}`}
                                        className="text-xs font-semibold text-orange-600 hover:text-orange-700"
                                    >
                                        View Stock →
                                    </a>
                                    <a
                                        href="/h_stocks/alerts"
                                        className="text-xs font-semibold text-gray-600 hover:text-gray-700"
                                    >
                                        Manage Alerts
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
