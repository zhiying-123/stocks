import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
    BACKTEST_SCHEDULE_KEY,
    DEFAULT_BACKTEST_DAILY_BATCH_SIZE,
    DEFAULT_BACKTEST_RUN_TIME,
    DEFAULT_BACKTEST_TIMEZONE,
    formatBacktestRunTimeLabel,
    normalizeBacktestDailyBatchSize,
    normalizeBacktestRunTime,
} from "@/lib/backtest-schedule";

async function checkAdminAuth() {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get("auth")?.value === "true";
    const userCookie = cookieStore.get("user")?.value;

    let user: { id?: number; role?: string } | null = null;
    if (userCookie) {
        try {
            user = JSON.parse(userCookie) as { id?: number; role?: string };
        } catch (parseError) {
            console.error("Failed to parse user cookie:", parseError);
            return null;
        }
    }

    if (!isLoggedIn || !user?.id) {
        return null;
    }

    const role = String(user.role || "").toLowerCase();
    if (role !== "staff" && role !== "admin") {
        return null;
    }

    return user;
}

function toScheduleResponse(schedule: {
    key: string;
    enabled: boolean;
    daily_batch_size: number;
    run_time: string;
    timezone: string;
    last_run_date: string | null;
    last_run_at: Date | null;
}) {
    return {
        key: schedule.key,
        enabled: schedule.enabled,
        dailyBatchSize: schedule.daily_batch_size,
        runTime: schedule.run_time,
        runTimeLabel: formatBacktestRunTimeLabel(schedule.run_time),
        timezone: schedule.timezone,
        lastRunDate: schedule.last_run_date,
        lastRunAt: schedule.last_run_at?.toISOString() ?? null,
    };
}

async function loadOrCreateSchedule() {
    return prisma.backtestSchedule.upsert({
        where: { key: BACKTEST_SCHEDULE_KEY },
        create: {
            key: BACKTEST_SCHEDULE_KEY,
            enabled: true,
            daily_batch_size: DEFAULT_BACKTEST_DAILY_BATCH_SIZE,
            run_time: DEFAULT_BACKTEST_RUN_TIME,
            timezone: DEFAULT_BACKTEST_TIMEZONE,
        },
        update: {},
    });
}

export async function GET() {
    const user = await checkAdminAuth();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const schedule = await loadOrCreateSchedule();
        return NextResponse.json({ success: true, schedule: toScheduleResponse(schedule) });
    } catch (error) {
        console.error("GET backtest schedule error:", error);
        return NextResponse.json({ error: "Failed to load backtest schedule" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const user = await checkAdminAuth();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json().catch(() => ({}));
        const enabled = body?.enabled !== false;
        const dailyBatchSize = normalizeBacktestDailyBatchSize(body?.dailyBatchSize ?? body?.daily_batch_size);
        const runTime = normalizeBacktestRunTime(body?.runTime ?? body?.run_time);
        const timezone = String(body?.timezone || DEFAULT_BACKTEST_TIMEZONE).trim() || DEFAULT_BACKTEST_TIMEZONE;

        const schedule = await prisma.backtestSchedule.upsert({
            where: { key: BACKTEST_SCHEDULE_KEY },
            create: {
                key: BACKTEST_SCHEDULE_KEY,
                enabled,
                daily_batch_size: dailyBatchSize,
                run_time: runTime,
                timezone,
            },
            update: {
                enabled,
                daily_batch_size: dailyBatchSize,
                run_time: runTime,
                timezone,
            },
        });

        return NextResponse.json({ success: true, schedule: toScheduleResponse(schedule) });
    } catch (error) {
        console.error("POST backtest schedule error:", error);
        return NextResponse.json({ error: "Failed to save backtest schedule" }, { status: 500 });
    }
}