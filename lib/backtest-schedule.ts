export const BACKTEST_SCHEDULE_KEY = "polymarket_daily_backtest";
export const DEFAULT_BACKTEST_TIMEZONE = "Asia/Kuala_Lumpur";
export const DEFAULT_BACKTEST_RUN_TIME = "22:16";
export const DEFAULT_BACKTEST_DAILY_BATCH_SIZE = 10;
export const MIN_BACKTEST_DAILY_BATCH_SIZE = 5;
export const MAX_BACKTEST_DAILY_BATCH_SIZE = 20;

export type BacktestScheduleState = {
    key: string;
    enabled: boolean;
    dailyBatchSize: number;
    runTime: string;
    timezone: string;
    lastRunDate: string | null;
    lastRunAt: string | null;
};

function clampBatchSize(raw: number) {
    const rounded = Math.floor(raw);
    if (rounded < MIN_BACKTEST_DAILY_BATCH_SIZE) return MIN_BACKTEST_DAILY_BATCH_SIZE;
    if (rounded > MAX_BACKTEST_DAILY_BATCH_SIZE) return MAX_BACKTEST_DAILY_BATCH_SIZE;
    return rounded;
}

export function normalizeBacktestDailyBatchSize(raw: unknown) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_BACKTEST_DAILY_BATCH_SIZE;
    return clampBatchSize(parsed);
}

export function normalizeBacktestRunTime(raw: unknown) {
    const value = String(raw || "").trim();
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    if (!match) return DEFAULT_BACKTEST_RUN_TIME;
    return `${match[1]}:${match[2]}`;
}

export function formatBacktestRunTimeLabel(runTime: string) {
    const normalized = normalizeBacktestRunTime(runTime);
    const [hour, minute] = normalized.split(":").map((value) => Number(value));
    const date = new Date(Date.UTC(2000, 0, 1, hour, minute, 0, 0));

    return new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "UTC",
    }).format(date);
}

export function formatDateInTimeZone(date: Date, timeZone: string) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date);
}

export function getMinutesInTimeZone(date: Date, timeZone: string) {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    const hour = Number(values.hour || 0);
    const minute = Number(values.minute || 0);

    return hour * 60 + minute;
}

export function getMinutesFromRunTime(runTime: string) {
    const normalized = normalizeBacktestRunTime(runTime);
    const [hour, minute] = normalized.split(":").map((value) => Number(value));
    return hour * 60 + minute;
}
