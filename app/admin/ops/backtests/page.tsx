"use client";

import { useMemo, useState } from "react";

type BatchResponse = {
  success?: boolean;
  error?: string;
  requestedBy?: string;
  batchSize?: number;
  selectedMarkets?: number;
  completedCount?: number;
  failedCount?: number;
  discordDelivered?: number;
  completed?: Array<{
    marketId: string;
    clobTokenId: string;
    group: string;
    market: string;
    netPnL: number;
    returnPct: number;
    tradesExecuted: number;
    discordSent: boolean;
  }>;
  failed?: Array<{
    marketId: string;
    clobTokenId: string;
    group: string;
    market: string;
    error: string;
  }>;
};

const THEMES = ["NBA", "Elon market", "Economic policy", "Movies"];

export default function AdminBacktestsPage() {
  const [limit, setLimit] = useState<number>(12);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [result, setResult] = useState<BatchResponse | null>(null);

  const normalizedLimit = useMemo(() => {
    if (!Number.isFinite(limit)) return 12;
    if (limit < 10) return 10;
    if (limit > 20) return 20;
    return Math.floor(limit);
  }, [limit]);

  async function runDailyBatch() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/polymarket/backtest-daily", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ limit: normalizedLimit }),
      });

      const data = (await response.json().catch(() => ({}))) as BatchResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to run daily backtest batch");
      }

      setResult(data);
      setMessage(
        `Batch completed: ${data.completedCount || 0} done, ${data.failedCount || 0} failed, Discord sent ${data.discordDelivered || 0}.`,
      );
    } catch (error) {
      setResult(null);
      setMessage(error instanceof Error ? error.message : "Unexpected error while running backtests");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Ops Automation</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Daily Polymarket Backtest Runner</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          This runs a batch of priority-theme markets and sends a Discord message for every completed backtest. Theme priority:
          {" "}
          {THEMES.join(", ")}.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto] md:items-end">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Daily backtests target (10-20)</span>
            <input
              type="number"
              value={limit}
              min={10}
              max={20}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-sky-200 transition focus:ring"
            />
          </label>

          <button
            type="button"
            onClick={runDailyBatch}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-xl border border-sky-300 bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Running Backtests..." : `Run Batch (${normalizedLimit})`}
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          The scheduled cron job also runs daily and uses the same logic, so this page is for one-click manual trigger when needed.
        </p>

        {message ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        ) : null}
      </section>

      {result ? (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Requested</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{result.batchSize || 0}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Completed</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-700">{result.completedCount || 0}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Failed</p>
            <p className="mt-2 text-2xl font-semibold text-amber-700">{result.failedCount || 0}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Discord Delivered</p>
            <p className="mt-2 text-2xl font-semibold text-sky-700">{result.discordDelivered || 0}</p>
          </article>
        </section>
      ) : null}

      {result?.completed && result.completed.length > 0 ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Completed Markets</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-190 border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                  <th className="px-3 py-2">Theme</th>
                  <th className="px-3 py-2">Market</th>
                  <th className="px-3 py-2">PnL</th>
                  <th className="px-3 py-2">Return</th>
                  <th className="px-3 py-2">Trades</th>
                  <th className="px-3 py-2">Discord</th>
                </tr>
              </thead>
              <tbody>
                {result.completed.map((item) => (
                  <tr key={`${item.marketId}-${item.clobTokenId}`} className="border-b border-slate-100 text-slate-700">
                    <td className="px-3 py-2">{item.group}</td>
                    <td className="px-3 py-2">{item.market}</td>
                    <td className={`px-3 py-2 font-medium ${item.netPnL >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {item.netPnL >= 0 ? "+" : ""}
                      {item.netPnL.toFixed(2)}
                    </td>
                    <td className="px-3 py-2">{item.returnPct.toFixed(2)}%</td>
                    <td className="px-3 py-2">{item.tradesExecuted}</td>
                    <td className="px-3 py-2">{item.discordSent ? "Sent" : "Skipped"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {result?.failed && result.failed.length > 0 ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-amber-900">Failed Markets</h2>
          <ul className="mt-3 space-y-2 text-sm text-amber-900">
            {result.failed.map((item) => (
              <li key={`${item.marketId}-${item.clobTokenId}`}>[{item.group}] {item.market}: {item.error}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}