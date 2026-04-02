import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

type ReasonCount = {
  reason: string;
  count: number;
};

type EventRow = {
  id: string;
  module: "Polymarket" | "Stocks";
  label: string;
  triggeredAt: Date;
  executed: boolean;
  discordEligible: boolean;
  error: string | null;
};

function getTodayRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { now, start, end };
}

function parseCsvChannels(value: string | null | undefined): string[] {
  const raw = String(value || "").trim();
  if (!raw) return ["EMAIL", "DISCORD"];
  const channels = raw
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  return channels.length > 0 ? channels : ["EMAIL", "DISCORD"];
}

function parsePolymarketChannelsFromSource(source: string | null | undefined): string[] {
  const raw = String(source || "");
  const parts = raw.split("|");
  if (parts.length < 2) return ["EMAIL", "DISCORD"];
  return parseCsvChannels(parts[1]);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function toLocalTime(value: Date) {
  return value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function toLocalDateTime(value: Date) {
  return value.toLocaleString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function compactReason(raw: string) {
  const reason = raw.trim();
  if (!reason) return "Unknown error";
  const separator = reason.indexOf(":");
  if (separator <= 0 || separator >= reason.length - 1) return reason;
  return reason.slice(0, separator);
}

function topReasons(reasons: string[], take = 5): ReasonCount[] {
  const bucket = new Map<string, number>();
  for (const reason of reasons) {
    const normalized = compactReason(reason);
    bucket.set(normalized, (bucket.get(normalized) || 0) + 1);
  }

  return Array.from(bucket.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, take);
}

export default async function OpsDashboardPage() {
  const cookieStore = await cookies();
  const isLoggedIn = cookieStore.get("auth")?.value === "true";
  const userCookie = cookieStore.get("user")?.value;
  const user = userCookie ? JSON.parse(userCookie) : null;

  if (!isLoggedIn || !user?.id) {
    redirect("/login");
  }

  const { now, start, end } = getTodayRange();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";

  const [polymarketAlertsToday, stockRulesToday, walletTransactionsToday] = await Promise.all([
    prisma.polymarketPriceAlert.findMany({
      where: {
        u_id: user.id,
        triggered_at: {
          gte: start,
          lt: end,
        },
      },
      select: {
        alert_id: true,
        market_id: true,
        outcome: true,
        triggered_at: true,
        source: true,
        auto_buy_executed_at: true,
        auto_buy_last_error: true,
      },
    }),
    prisma.stockAutoTrader.findMany({
      where: {
        u_id: user.id,
        triggered_at: {
          gte: start,
          lt: end,
        },
      },
      select: {
        auto_id: true,
        symbol: true,
        action: true,
        triggered_at: true,
        notify_channels: true,
        executed_at: true,
        last_error: true,
      },
    }),
    prisma.walletTransaction.findMany({
      where: {
        u_id: user.id,
        transaction_date: {
          gte: start,
          lt: end,
        },
        transaction_type: {
          in: ["STOCK_BUY", "STOCK_SELL", "POLYMARKET_BUY", "POLYMARKET_SELL"],
        },
      },
      select: {
        transaction_type: true,
        amount: true,
        transaction_date: true,
        symbol: true,
      },
    }),
  ]);

  const totalTriggered = polymarketAlertsToday.length + stockRulesToday.length;

  const polymarketExecAttempted = polymarketAlertsToday.filter(
    (item) => Boolean(item.auto_buy_executed_at || item.auto_buy_last_error),
  );
  const polymarketExecSuccess = polymarketExecAttempted.filter((item) => Boolean(item.auto_buy_executed_at)).length;

  const stockExecAttempted = stockRulesToday.length;
  const stockExecSuccess = stockRulesToday.filter((item) => Boolean(item.executed_at)).length;

  const executionAttempted = polymarketExecAttempted.length + stockExecAttempted;
  const executionSuccess = polymarketExecSuccess + stockExecSuccess;
  const executionSuccessRate = executionAttempted > 0 ? (executionSuccess / executionAttempted) * 100 : 0;

  const polymarketExecutionRate = polymarketExecAttempted.length > 0
    ? (polymarketExecSuccess / polymarketExecAttempted.length) * 100
    : 0;
  const stockExecutionRate = stockExecAttempted > 0
    ? (stockExecSuccess / stockExecAttempted) * 100
    : 0;

  const failedReasons = [
    ...polymarketAlertsToday
      .map((item) => item.auto_buy_last_error)
      .filter((item): item is string => Boolean(item)),
    ...stockRulesToday
      .map((item) => item.last_error)
      .filter((item): item is string => Boolean(item)),
  ];
  const failureTop = topReasons(failedReasons);

  const polymarketDiscordEligible = polymarketAlertsToday.filter((item) =>
    parsePolymarketChannelsFromSource(item.source).includes("DISCORD"),
  ).length;
  const stockDiscordEligible = stockRulesToday.filter((item) =>
    parseCsvChannels(item.notify_channels).includes("DISCORD"),
  ).length;
  const discordEligibleTotal = polymarketDiscordEligible + stockDiscordEligible;

  const discordWebhookConfigured = Boolean(process.env.DISCORD_WEBHOOK_URL);
  const discordDeliveredEstimated = discordWebhookConfigured ? discordEligibleTotal : 0;
  const discordSuccessRate = discordEligibleTotal > 0 ? (discordDeliveredEstimated / discordEligibleTotal) * 100 : 0;

  const buyTypes = new Set(["STOCK_BUY", "POLYMARKET_BUY"]);
  const sellTypes = new Set(["STOCK_SELL", "POLYMARKET_SELL"]);

  let simulatedBuyCost = 0;
  let simulatedSellValue = 0;
  let stockBuyCost = 0;
  let stockSellValue = 0;
  let polyBuyCost = 0;
  let polySellValue = 0;

  for (const tx of walletTransactionsToday) {
    const amount = Number(tx.amount || 0);
    if (buyTypes.has(tx.transaction_type)) {
      simulatedBuyCost += amount;
      if (tx.transaction_type === "STOCK_BUY") stockBuyCost += amount;
      if (tx.transaction_type === "POLYMARKET_BUY") polyBuyCost += amount;
    } else if (sellTypes.has(tx.transaction_type)) {
      simulatedSellValue += amount;
      if (tx.transaction_type === "STOCK_SELL") stockSellValue += amount;
      if (tx.transaction_type === "POLYMARKET_SELL") polySellValue += amount;
    }
  }

  const simulatedPnL = simulatedSellValue - simulatedBuyCost;
  const stockPnL = stockSellValue - stockBuyCost;
  const polymarketPnL = polySellValue - polyBuyCost;

  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    count: 0,
  }));

  for (const alert of polymarketAlertsToday) {
    const when = alert.triggered_at;
    if (!when) continue;
    hourly[when.getHours()].count += 1;
  }
  for (const rule of stockRulesToday) {
    const when = rule.triggered_at;
    if (!when) continue;
    hourly[when.getHours()].count += 1;
  }

  const peakHourCount = Math.max(1, ...hourly.map((item) => item.count));

  const recentEvents: EventRow[] = [
    ...polymarketAlertsToday
      .filter((item): item is typeof item & { triggered_at: Date } => Boolean(item.triggered_at))
      .map((item) => ({
        id: `p-${item.alert_id}`,
        module: "Polymarket" as const,
        label: `${item.outcome} @ ${item.market_id.slice(0, 10)}...`,
        triggeredAt: item.triggered_at,
        executed: Boolean(item.auto_buy_executed_at),
        discordEligible: parsePolymarketChannelsFromSource(item.source).includes("DISCORD"),
        error: item.auto_buy_last_error,
      })),
    ...stockRulesToday
      .filter((item): item is typeof item & { triggered_at: Date } => Boolean(item.triggered_at))
      .map((item) => ({
        id: `s-${item.auto_id}`,
        module: "Stocks" as const,
        label: `${item.action} ${item.symbol}`,
        triggeredAt: item.triggered_at,
        executed: Boolean(item.executed_at),
        discordEligible: parseCsvChannels(item.notify_channels).includes("DISCORD"),
        error: item.last_error,
      })),
  ]
    .sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime())
    .slice(0, 12);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-orange-100 bg-linear-to-br from-amber-50 via-white to-teal-50 p-7 shadow-sm">
        <div className="absolute -top-24 -right-16 h-56 w-56 rounded-full bg-orange-200/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-teal-200/30 blur-3xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Operations Cockpit</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">Daily Automation Intelligence</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-700">
              Screenshot-ready view for trigger volume, execution health, Discord delivery confidence, and simulated P/L.
            </p>
          </div>
          <div className="w-full self-start rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm shadow-sm backdrop-blur-sm lg:w-auto lg:min-w-90">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Report Window</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                Today: {toLocalTime(start)} - {toLocalTime(end)}
              </span>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                TZ: {timezone}
              </span>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">
                Updated {toLocalDateTime(now)}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Today Triggered</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{totalTriggered}</p>
          <p className="mt-1 text-xs text-slate-500">Polymarket {polymarketAlertsToday.length} · Stocks {stockRulesToday.length}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Execution Success</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{formatPercent(executionSuccessRate)}</p>
          <p className="mt-1 text-xs text-slate-500">{executionSuccess}/{executionAttempted} successful</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-linear-to-r from-emerald-200 to-teal-200" style={{ width: `${Math.min(100, executionSuccessRate)}%` }} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Discord Success</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{formatPercent(discordSuccessRate)}</p>
          <p className="mt-1 text-xs text-slate-500">{discordDeliveredEstimated}/{discordEligibleTotal} estimated delivered</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-linear-to-r from-cyan-200 to-blue-200" style={{ width: `${Math.min(100, discordSuccessRate)}%` }} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Simulated P/L</p>
          <p className={`mt-2 text-3xl font-semibold ${simulatedPnL >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {formatCurrency(simulatedPnL)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Sell - Buy cashflow for today</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Discord Webhook</p>
          <p className={`mt-2 text-3xl font-semibold ${discordWebhookConfigured ? "text-emerald-600" : "text-amber-600"}`}>
            {discordWebhookConfigured ? "ON" : "OFF"}
          </p>
          <p className="mt-1 text-xs text-slate-500">Based on DISCORD_WEBHOOK_URL</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Hourly Trigger Heat</h2>
            <p className="text-xs text-slate-500">Peak: {peakHourCount}</p>
          </div>
          <div className="mt-5 grid grid-cols-12 gap-2">
            {hourly.map((item) => {
              const height = item.count === 0 ? 6 : Math.max(10, Math.round((item.count / peakHourCount) * 56));
              return (
                <div key={item.label} className="flex flex-col items-center gap-2">
                  <div className="text-[10px] text-slate-500">{item.count}</div>
                  <div className="flex h-16 w-full items-end justify-center rounded-md bg-slate-50 px-1">
                    <div
                      className="w-full rounded-sm bg-linear-to-t from-orange-200 to-amber-200"
                      style={{ height }}
                      title={`${item.label} · ${item.count}`}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400">{item.label.slice(0, 2)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Module Execution Split</h2>
          <div className="mt-4 space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">Polymarket</span>
                <span className="text-slate-500">{formatPercent(polymarketExecutionRate)}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-linear-to-r from-fuchsia-200 to-pink-200" style={{ width: `${Math.min(100, polymarketExecutionRate)}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{polymarketExecSuccess}/{polymarketExecAttempted.length} successful</p>
            </div>

            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">Stocks</span>
                <span className="text-slate-500">{formatPercent(stockExecutionRate)}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-linear-to-r from-sky-200 to-indigo-200" style={{ width: `${Math.min(100, stockExecutionRate)}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{stockExecSuccess}/{stockExecAttempted} successful</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-widest text-slate-500">P/L Breakdown</p>
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                <div className="flex justify-between"><span>Stocks</span><span className={stockPnL >= 0 ? "text-emerald-600" : "text-rose-600"}>{formatCurrency(stockPnL)}</span></div>
                <div className="flex justify-between"><span>Polymarket</span><span className={polymarketPnL >= 0 ? "text-emerald-600" : "text-rose-600"}>{formatCurrency(polymarketPnL)}</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Failure Reasons Top</h2>
          {failureTop.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No failures recorded today.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {failureTop.map((item) => (
                <div key={item.reason} className="rounded-xl border border-rose-100 bg-rose-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-900">{item.reason}</p>
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-600">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Metric Notes</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>Execution success: Stock auto-trader + Polymarket auto-buy execution attempts.</li>
            <li>Discord success: estimated by Discord-eligible triggers and webhook configuration.</li>
            <li>P/L (simulated): today wallet cashflow from STOCK/POLYMARKET BUY/SELL transactions only.</li>
            <li>Reason labels are normalized to keep screenshot readability.</li>
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Recent Triggered Events</h2>
        {recentEvents.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No triggered events today.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-widest text-slate-500">
                  <th className="pb-2 pr-4">Time</th>
                  <th className="pb-2 pr-4">Module</th>
                  <th className="pb-2 pr-4">Event</th>
                  <th className="pb-2 pr-4">Execution</th>
                  <th className="pb-2 pr-4">Discord</th>
                  <th className="pb-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 align-top text-slate-700">
                    <td className="py-2 pr-4 font-medium">{toLocalTime(item.triggeredAt)}</td>
                    <td className="py-2 pr-4">{item.module}</td>
                    <td className="py-2 pr-4">{item.label}</td>
                    <td className="py-2 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.executed ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
                        {item.executed ? "SUCCESS" : "FAILED"}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{item.discordEligible ? "Yes" : "No"}</td>
                    <td className="py-2 text-xs text-slate-500">{item.error ? compactReason(item.error) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
