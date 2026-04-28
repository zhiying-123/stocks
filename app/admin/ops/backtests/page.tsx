"use client";

import { useEffect, useMemo, useState } from "react";

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
  plannedMarkets?: PlannedMarket[];
  excludedCount?: number;
  groupFilters?: string[];
};

type PlannedMarket = {
  marketId: string;
  clobTokenId: string;
  group: string;
  market: string;
  isClosed: boolean;
  volume: number;
  liquidity: number;
};

const BATCH_SIZE_OPTIONS = [5, 10, 15] as const;
const THEME_FILTERS = [
  { label: "NBA", slug: "nba" },
  { label: "Elon", slug: "elon-tweets" },
  { label: "Economic", slug: "economic-policy" },
  { label: "Movies", slug: "movies" },
] as const;

export default function AdminBacktestsPage() {
  const [limit, setLimit] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showTokenIds, setShowTokenIds] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [result, setResult] = useState<BatchResponse | null>(null);
  const [plannedMarkets, setPlannedMarkets] = useState<PlannedMarket[]>([]);
  const [excludedClobTokenIds, setExcludedClobTokenIds] = useState<string[]>([]);
  const [selectedThemeSlugs, setSelectedThemeSlugs] = useState<string[]>(THEME_FILTERS.map((theme) => theme.slug));
  const [refreshVersion, setRefreshVersion] = useState(0);

  const normalizedLimit = useMemo(() => {
    if (!Number.isFinite(limit)) return 10;
    const rounded = Math.floor(limit);
    if (rounded < 5) return 5;
    if (rounded > 20) return 20;
    return rounded;
  }, [limit]);

  const plannedMarketCount = plannedMarkets.length;

  useEffect(() => {
    let cancelled = false;

    async function loadPlanPreview() {
      setPreviewLoading(true);

      try {
        const response = await fetch("/api/polymarket/backtest-daily", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            limit: normalizedLimit,
            previewOnly: true,
            excludedClobTokenIds,
            groupFilters: selectedThemeSlugs,
          }),
        });

        const data = (await response.json().catch(() => ({}))) as BatchResponse;
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to load planned backtests");
        }

        if (!cancelled) {
          setPlannedMarkets(data.plannedMarkets || []);
        }
      } catch {
        if (!cancelled) {
          setPlannedMarkets([]);
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    }

    void loadPlanPreview();

    return () => {
      cancelled = true;
    };
  }, [excludedClobTokenIds, normalizedLimit, refreshVersion, selectedThemeSlugs]);

  function toggleThemeFilter(slug: string) {
    setExcludedClobTokenIds([]);
    setSelectedThemeSlugs((current) => {
      const exists = current.includes(slug);
      const next = exists ? current.filter((item) => item !== slug) : [...current, slug];
      return next.length > 0 ? next : current;
    });
  }

  function refreshPlan() {
    setRefreshVersion((current) => current + 1);
  }

  function excludePlannedMarket(clobTokenId: string) {
    setExcludedClobTokenIds((current) => {
      if (current.includes(clobTokenId)) return current;
      return [...current, clobTokenId];
    });
  }

  function resetPlan() {
    setExcludedClobTokenIds([]);
  }

  async function runDailyBatch() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/polymarket/backtest-daily", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          limit: normalizedLimit,
          excludedClobTokenIds,
          groupFilters: selectedThemeSlugs,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as BatchResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to run daily backtest batch");
      }

      setResult(data);
      setPlannedMarkets(data.plannedMarkets || []);
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(186,230,253,0.28),transparent_38%),linear-gradient(180deg,#f8fafc_0%,#ffffff_44%,#eff6ff_100%)] px-4 py-6 md:px-8 md:py-8">
      <section className="mx-auto max-w-7xl space-y-6 rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Ops Automation</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Daily Polymarket Backtest Runner</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          This runs a batch of priority-theme markets and sends a Discord message for every completed backtest. Theme priority:
          {" "}
          {THEME_FILTERS.map((theme) => theme.label).join(", ")}.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4 shadow-sm md:grid-cols-[1fr_auto] md:items-end">
          <label className="space-y-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Daily backtests target</span>
              <p className="mt-1 text-xs text-slate-500">Type any number from 5 to 20, or tap a quick button.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {BATCH_SIZE_OPTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLimit(value)}
                  className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${normalizedLimit === value
                      ? "border-sky-500 bg-sky-600 text-white shadow-sm"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                >
                  {value}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={5}
              max={20}
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="w-full max-w-sm rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-sky-200 transition focus:ring"
              aria-label="Daily backtests target"
            />
          </label>

          <button
            type="button"
            onClick={runDailyBatch}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-2xl border border-sky-300 bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Running Backtests..." : `Run Batch (${normalizedLimit})`}
          </button>
        </div>

        <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Theme filter</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {THEME_FILTERS.map((theme) => {
              const active = selectedThemeSlugs.includes(theme.slug);
              return (
                <button
                  key={theme.slug}
                  type="button"
                  onClick={() => toggleThemeFilter(theme.slug)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${active
                      ? "border-emerald-400 bg-emerald-600 text-white shadow-sm"
                      : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-white"
                    }`}
                >
                  {theme.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setExcludedClobTokenIds([]);
                setSelectedThemeSlugs(THEME_FILTERS.map((theme) => theme.slug));
              }}
              className="rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
            >
              All themes
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Planned backtests</p>
              <p className="mt-1 text-sm text-slate-600">
                {previewLoading
                  ? "Refreshing the batch plan..."
                  : `Will run ${plannedMarketCount} markets. Click a card's X to swap it out for the next candidate.`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Excluded: {excludedClobTokenIds.length}</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Target: {normalizedLimit}</span>
              <button
                type="button"
                onClick={() => setShowTokenIds((current) => !current)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 transition hover:bg-slate-100"
              >
                {showTokenIds ? "Hide token IDs" : "Show token IDs"}
              </button>
              <button
                type="button"
                onClick={refreshPlan}
                disabled={previewLoading}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {previewLoading ? "Refreshing..." : "Refresh"}
              </button>
              {excludedClobTokenIds.length > 0 ? (
                <button
                  type="button"
                  onClick={resetPlan}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 transition hover:bg-slate-100"
                >
                  Reset plan
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {plannedMarkets.length > 0 ? (
              plannedMarkets.map((market, index) => (
                <article key={market.clobTokenId} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        #{index + 1} · {market.group}
                      </p>
                      <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">{market.market}</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {showTokenIds ? `Token ${market.clobTokenId}` : "Token hidden"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => excludePlannedMarket(market.clobTokenId)}
                      className="shrink-0 rounded-full border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                      aria-label={`Exclude ${market.market}`}
                    >
                      X
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full bg-white px-2.5 py-1">Volume {market.volume.toFixed(0)}</span>
                    <span className="rounded-full bg-white px-2.5 py-1">Liquidity {market.liquidity.toFixed(0)}</span>
                    <span className={`rounded-full px-2.5 py-1 ${market.isClosed ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                      {market.isClosed ? "Closed" : "Open"}
                    </span>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                {previewLoading ? "Loading planned markets..." : "No markets available for the current filter."}
              </div>
            )}
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          The scheduled cron job also runs daily and uses the same logic, so this page is for one-click manual trigger when needed.
        </p>

        {message ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 shadow-sm">
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