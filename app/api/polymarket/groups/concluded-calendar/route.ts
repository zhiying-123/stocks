import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type CalendarMarket = {
    market_id: string;
    question: string | null;
    category: string | null;
    end_date_iso: string;
};

function parseMonthParam(value: string | null): string | null {
    if (!value) return null;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
    return value;
}

function dayKeyFromDate(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function monthKeyFromDate(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthMeta(monthKey: string) {
    const [yearString, monthString] = monthKey.split("-");
    const year = Number(yearString);
    const month = Number(monthString);

    const firstDayUtc = new Date(Date.UTC(year, month - 1, 1));
    const startWeekday = firstDayUtc.getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const monthLabel = firstDayUtc.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    });

    return { startWeekday, daysInMonth, monthLabel };
}

export async function GET(request: NextRequest) {
    try {
        const groupIdValue = request.nextUrl.searchParams.get("groupId");
        const groupId = Number(groupIdValue);

        if (!Number.isInteger(groupId) || groupId <= 0) {
            return NextResponse.json({ error: "groupId is required" }, { status: 400 });
        }

        const requestedMonth = parseMonthParam(request.nextUrl.searchParams.get("month"));

        const latestClosedSnapshots = await prisma.polymarketGroupedMarketSnapshot.findMany({
            where: {
                group_id: groupId,
                is_closed: true,
                end_date_iso: { not: null },
            },
            orderBy: [{ market_id: "asc" }, { collected_at: "desc" }],
            distinct: ["market_id"],
            select: {
                market_id: true,
                question: true,
                category: true,
                end_date_iso: true,
            },
        });

        const normalized = latestClosedSnapshots
            .map((row) => {
                const endDate = row.end_date_iso ? new Date(row.end_date_iso) : null;
                if (!endDate || !Number.isFinite(endDate.getTime())) return null;

                return {
                    market_id: row.market_id,
                    question: row.question,
                    category: row.category,
                    endDate,
                    dayKey: dayKeyFromDate(endDate),
                    monthKey: monthKeyFromDate(endDate),
                };
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item));

        const availableMonths = [...new Set(normalized.map((item) => item.monthKey))].sort((a, b) => b.localeCompare(a));
        const selectedMonth = requestedMonth && availableMonths.includes(requestedMonth)
            ? requestedMonth
            : availableMonths[0] || monthKeyFromDate(new Date());

        const selectedMonthRows = normalized.filter((item) => item.monthKey === selectedMonth);
        const dayCountsMap = new Map<string, number>();
        const marketsByDay = new Map<string, CalendarMarket[]>();

        for (const row of selectedMonthRows) {
            dayCountsMap.set(row.dayKey, (dayCountsMap.get(row.dayKey) || 0) + 1);

            const marketList = marketsByDay.get(row.dayKey) || [];
            marketList.push({
                market_id: row.market_id,
                question: row.question,
                category: row.category,
                end_date_iso: row.endDate.toISOString(),
            });
            marketsByDay.set(row.dayKey, marketList);
        }

        for (const marketList of marketsByDay.values()) {
            marketList.sort((a, b) => (a.question || "").localeCompare(b.question || ""));
        }

        const day_counts = [...dayCountsMap.entries()]
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        const { startWeekday, daysInMonth, monthLabel } = monthMeta(selectedMonth);

        return NextResponse.json({
            success: true,
            group_id: groupId,
            selected_month: selectedMonth,
            month_label: monthLabel,
            calendar_start_weekday: startWeekday,
            days_in_month: daysInMonth,
            total_closed_markets: normalized.length,
            available_months: availableMonths,
            day_counts,
            markets_by_day: Object.fromEntries(marketsByDay),
        });
    } catch (error) {
        console.error("[POLYMARKET GROUP CONCLUDED CALENDAR GET]", error);
        return NextResponse.json({ error: "Failed to fetch concluded-market calendar" }, { status: 500 });
    }
}