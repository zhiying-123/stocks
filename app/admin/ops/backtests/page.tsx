"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_BACKTEST_RUN_TIME,
  DEFAULT_BACKTEST_TIMEZONE,
  formatBacktestRunTimeLabel,
  normalizeBacktestDailyBatchSize,
  normalizeBacktestRunTime,
} from "@/lib/backtest-schedule";

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

type BacktestScheduleResponse = {
  success?: boolean;
  error?: string;
  schedule?: {
    key: string;
    enabled: boolean;
    dailyBatchSize: number;
    runTime: string;
    runTimeLabel: string;
    timezone: string;
    lastRunDate: string | null;
    lastRunAt: string | null;
  };
};

const BATCH_SIZE_OPTIONS = [5, 10, 15] as const;
const TIME_PRESETS = [
  { label: "09:00 AM", value: "09:00" },
  { label: "12:00 PM", value: "12:00" },
  { label: "03:00 PM", value: "15:00" },
  { label: "08:00 PM", value: "20:00" },
] as const;
const THEME_FILTERS = [
  { label: "NBA", slug: "nba" },
  { label: "Elon", slug: "elon-tweets" },
  { label: "Economic", slug: "economic-policy" },
  { label: "Movies", slug: "movies" },
] as const;

export default function AdminBacktestsPage() {
  const [limit, setLimit] = useState<number>(10);
  const [runTime, setRunTime] = useState<string>(DEFAULT_BACKTEST_RUN_TIME);
  const [timeZone, setTimeZone] = useState<string>(DEFAULT_BACKTEST_TIMEZONE);
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [lastRunDate, setLastRunDate] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [savedSchedule, setSavedSchedule] = useState<{
    enabled: boolean;
    dailyBatchSize: number;
    runTime: string;
    timezone: string;
  } | null>(null);
  const [scheduleReady, setScheduleReady] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
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

  const hasUnsavedChanges = useMemo(() => {
    if (!savedSchedule) return false;
    return (
      savedSchedule.enabled !== autoEnabled
      || savedSchedule.dailyBatchSize !== normalizedLimit
      || savedSchedule.runTime !== normalizeBacktestRunTime(runTime)
      || savedSchedule.timezone !== timeZone
    );
  }, [autoEnabled, normalizedLimit, runTime, savedSchedule, timeZone]);

  const lastRunLabel = useMemo(() => {
    if (lastRunAt) {
      const dt = new Date(lastRunAt);
      if (Number.isFinite(dt.getTime())) {
        return dt.toLocaleString("en-MY", {
          hour12: true,
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone,
        });
      }
    }

    if (lastRunDate) {
      return `${lastRunDate} (date only)`;
    }

    return "Never";
  }, [lastRunAt, lastRunDate, timeZone]);

  useEffect(() => {
    let cancelled = false;

    async function loadSchedule() {
      try {
        const response = await fetch("/api/admin/backtest-schedule", { method: "GET" });
        const data = (await response.json().catch(() => ({}))) as BacktestScheduleResponse;

        if (!response.ok || !data.success || !data.schedule || cancelled) {
          if (!cancelled) {
            setScheduleReady(true);
          }
          return;
        }

        setLimit(normalizeBacktestDailyBatchSize(data.schedule.dailyBatchSize));
        setRunTime(normalizeBacktestRunTime(data.schedule.runTime));
        setTimeZone(data.schedule.timezone || DEFAULT_BACKTEST_TIMEZONE);
        setAutoEnabled(data.schedule.enabled);
        setLastRunDate(data.schedule.lastRunDate);
        setLastRunAt(data.schedule.lastRunAt);
        setSavedSchedule({
          enabled: data.schedule.enabled,
          dailyBatchSize: normalizeBacktestDailyBatchSize(data.schedule.dailyBatchSize),
          runTime: normalizeBacktestRunTime(data.schedule.runTime),
          timezone: data.schedule.timezone || DEFAULT_BACKTEST_TIMEZONE,
        });
        setScheduleReady(true);
      } catch {
        if (!cancelled) {
          setScheduleReady(true);
        }
      }
    }

    void loadSchedule();

    return () => {
      cancelled = true;
    };
  }, []);

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
      } catch (err) {
        if (!cancelled) {
          setPlannedMarkets([]);
          setMessage("Failed to load planned backtests. Check server or refresh.");
          // eslint-disable-next-line no-console
          console.error("loadPlanPreview error", err);
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

  function applyTimePreset(value: string) {
    setRunTime(normalizeBacktestRunTime(value));
  }

  function restoreSavedSchedule() {
    if (!savedSchedule) return;
    setAutoEnabled(savedSchedule.enabled);
    setLimit(savedSchedule.dailyBatchSize);
    setRunTime(savedSchedule.runTime);
    setTimeZone(savedSchedule.timezone);
    setMessage("Reverted to the last saved schedule.");
  }

  async function saveSchedule() {
    setScheduleSaving(true);

    try {
      const response = await fetch("/api/admin/backtest-schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled: autoEnabled,
          dailyBatchSize: normalizedLimit,
          runTime,
          timezone: timeZone,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as BacktestScheduleResponse;
      if (!response.ok || !data.success || !data.schedule) {
        throw new Error(data.error || "Failed to save schedule");
      }

      setLimit(normalizeBacktestDailyBatchSize(data.schedule.dailyBatchSize));
      setRunTime(normalizeBacktestRunTime(data.schedule.runTime));
      setTimeZone(data.schedule.timezone || DEFAULT_BACKTEST_TIMEZONE);
      setAutoEnabled(data.schedule.enabled);
      setLastRunDate(data.schedule.lastRunDate);
      setLastRunAt(data.schedule.lastRunAt);
      setSavedSchedule({
        enabled: data.schedule.enabled,
        dailyBatchSize: normalizeBacktestDailyBatchSize(data.schedule.dailyBatchSize),
        runTime: normalizeBacktestRunTime(data.schedule.runTime),
        timezone: data.schedule.timezone || DEFAULT_BACKTEST_TIMEZONE,
      });
      setMessage(
        data.schedule.enabled
          ? `Auto schedule saved: ${formatBacktestRunTimeLabel(data.schedule.runTime)} · ${data.schedule.dailyBatchSize} markets per day.`
          : "Auto schedule saved in disabled mode. Cron will skip until re-enabled."
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save auto schedule");
    } finally {
      setScheduleSaving(false);
    }
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
    if (plannedMarkets.length === 0) {
      setMessage("No markets planned. Refresh or change filters.");
      return;
    }

    setLoading(true);
    setMessage("Starting batch process...");

    // Reset any previous results
    setResult({
      batchSize: normalizedLimit,
      completedCount: 0,
      failedCount: 0,
      discordDelivered: 0,
      completed: [],
      failed: [],
    });

    const completed: any[] = [];
    const failed: any[] = [];

    try {
      // Phase 1: Process planned markets one by one
      for (let i = 0; i < plannedMarkets.length; i++) {
        const planned = plannedMarkets[i];
        setMessage(`Running backtest ${i + 1} of ${plannedMarkets.length}... (${planned.market})`);

        // Re-map planned market back to backend CandidateMarket format
        const candidate = {
          marketId: planned.marketId,
          clobTokenId: planned.clobTokenId,
          groupName: planned.group,
          groupSlug: planned.group.toLowerCase().replace(/\s+/g, '-'),
          question: planned.market,
          isClosed: planned.isClosed,
          volume: planned.volume,
          liquidity: planned.liquidity,
        };

        const response = await fetch("/api/polymarket/backtest-daily", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runSingleCandidate: candidate }),
        });

        const data = await response.json();

        if (response.ok && data.success && data.result?.ok) {
          completed.push(data.result);
        } else {
          failed.push({
            marketId: candidate.marketId,
            clobTokenId: candidate.clobTokenId,
            group: candidate.groupName,
            market: candidate.question,
            error: data?.result?.error || data?.error || "Unknown server error",
          });
        }

        // Update UI as we progress
        setResult(prev => ({
          ...prev!,
          completedCount: completed.length,
          failedCount: failed.length,
          completed: [...completed],
          failed: [...failed],
        }));
      }

      // Phase 2: Send Discord Summary
      setMessage("All backtests completed. Sending Discord summary...");
      const summaryResponse = await fetch("/api/polymarket/backtest-daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sendSummary: {
            batchSize: normalizedLimit,
            candidatesLength: plannedMarkets.length,
            groupFilters: selectedThemeSlugs,
            completed,
            failed,
          },
        }),
      });

      let deliveredCount = 0;
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        if (summaryData.success) deliveredCount = summaryData.discordDelivered || 0;
      }

      // Phase 3: Final UI Update
      setResult(prev => ({
        ...prev!,
        discordDelivered: deliveredCount,
      }));
      setMessage(`Batch completely finished: ${completed.length} done, ${failed.length} failed. Sent to Discord.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unexpected error while running backtests");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(186,230,253,0.28),transparent_38%),linear-gradient(180deg,#f8fafc_0%,#ffffff_44%,#eff6ff_100%)] px-4 py-6 md:px-8 md:py-8">
      <section className="mx-auto max-w-7xl space-y-6 rounded-4xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Monitoring</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Polymarket Backtest Management</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          This runs a batch of priority-theme markets and sends a Discord message for every completed backtest. Theme priority:
          {" "}
          {THEME_FILTERS.map((theme) => theme.label).join(", ")}.
        </p>

        <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                <span className={`rounded-full border px-3 py-1 ${autoEnabled ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700"}`}>
                  Auto-run {autoEnabled ? "enabled" : "disabled"}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
                  Last run: {lastRunLabel}
                </span>
                <span className={`rounded-full border px-3 py-1 ${hasUnsavedChanges ? "border-sky-300 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-600"}`}>
                  {hasUnsavedChanges ? "Unsaved changes" : "All changes saved"}
                </span>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Auto-run status</p>
                    <p className="mt-1 text-xs text-slate-500">Turn this off to pause daily cron execution without losing settings.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoEnabled((current) => !current)}
                    className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition ${autoEnabled
                      ? "border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-500"
                      : "border-amber-300 bg-amber-500 text-white hover:bg-amber-400"
                      }`}
                  >
                    {autoEnabled ? "Enabled" : "Disabled"}
                  </button>
                </div>
              </div>

              <label className="block space-y-3">
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

              <label className="block space-y-3">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Auto-run time</span>
                  <p className="mt-1 text-xs text-slate-500">Saved in Malaysia time. Cron checks this every minute and runs when due.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {TIME_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => applyTimePreset(preset.value)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${runTime === preset.value
                        ? "border-sky-500 bg-sky-600 text-white"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                        }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <input
                  type="time"
                  value={runTime}
                  onChange={(event) => setRunTime(normalizeBacktestRunTime(event.target.value))}
                  className="w-full max-w-sm rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-sky-200 transition focus:ring"
                  aria-label="Auto-run time"
                />
                <p className="text-xs text-slate-500">
                  Current setting: {formatBacktestRunTimeLabel(runTime)} · {timeZone}
                </p>
              </label>

              <p className="text-xs text-slate-500">
                Save this once and the daily cron will automatically run the batch at the configured time.
              </p>
            </div>

            <div className="flex flex-col gap-3 md:min-w-52">
              <button
                type="button"
                onClick={saveSchedule}
                disabled={scheduleSaving || !scheduleReady || !hasUnsavedChanges}
                className="inline-flex items-center justify-center rounded-2xl border border-emerald-300 bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {scheduleSaving ? "Saving..." : hasUnsavedChanges ? "Save Auto Schedule" : "Saved"}
              </button>

              <button
                type="button"
                onClick={restoreSavedSchedule}
                disabled={!hasUnsavedChanges || !savedSchedule}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Revert Changes
              </button>

              <button
                type="button"
                onClick={runDailyBatch}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-2xl border border-sky-300 bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Running Backtests..." : `Run Batch (${normalizedLimit})`}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
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

        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Polymarket Backtest Management</h2>
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

          <div className="mt-3 flex justify-end">
            <a
              href="/admin/ops/backtests/history"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-200"
            >
              Backtest History
            </a>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          The scheduled cron job checks the saved time every minute and runs automatically when it is due, so this page is for manual trigger and schedule updates.
        </p>

        {message ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 shadow-sm">
            {message}
          </div>
        ) : null}
      </section>

      <div className="mx-auto max-w-7xl space-y-6 mt-6">
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
    </div>
  );
}