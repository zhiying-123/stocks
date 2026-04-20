import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

const QUICK_EMAIL_PREFIXES = ["quick.temp.", "quick.new.", "quick.intermediate."];

function isQuickAccount(email: string) {
    const value = String(email || "").toLowerCase();
    return QUICK_EMAIL_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function dayStart(date: Date) {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
}

function dayKey(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export default async function UserAnalyticsPage() {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get("auth")?.value === "true";
    const userCookie = cookieStore.get("user")?.value;
    const user = userCookie ? JSON.parse(userCookie) : null;

    if (!isLoggedIn || !user?.id) {
        redirect("/login");
    }

    const role = String(user.role || "").toLowerCase();
    if (role !== "staff" && role !== "admin") {
        redirect("/");
    }

    const now = new Date();
    const todayStart = dayStart(now);
    const chartStart = dayStart(new Date(now));
    chartStart.setDate(chartStart.getDate() - 13);

    const allUsers = await prisma.user.findMany({
        select: {
            u_id: true,
            email: true,
        },
    });

    const quickUsers = allUsers.filter((item) => isQuickAccount(item.email));
    const selfRegisteredUsers = allUsers.filter((item) => !isQuickAccount(item.email));
    const allUserIds = allUsers.map((item) => item.u_id);
    const quickUserIds = quickUsers.map((item) => item.u_id);
    const selfRegisteredUserIds = selfRegisteredUsers.map((item) => item.u_id);

    const [walletRows, activatedBeforeRange, activatedToday, activeUsers7d, quickActivated, selfActivated] = await Promise.all([
        allUserIds.length > 0
            ? prisma.userWallet.findMany({
                where: {
                    u_id: { in: allUserIds },
                    created_at: {
                        gte: chartStart,
                        lt: now,
                    },
                },
                select: {
                    created_at: true,
                },
                orderBy: {
                    created_at: "asc",
                },
            })
            : [],
        allUserIds.length > 0
            ? prisma.userWallet.count({
                where: {
                    u_id: { in: allUserIds },
                    created_at: { lt: chartStart },
                },
            })
            : 0,
        allUserIds.length > 0
            ? prisma.userWallet.count({
                where: {
                    u_id: { in: allUserIds },
                    created_at: {
                        gte: todayStart,
                        lt: now,
                    },
                },
            })
            : 0,
        allUserIds.length > 0
            ? prisma.walletTransaction.findMany({
                where: {
                    u_id: { in: allUserIds },
                    transaction_date: {
                        gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
                        lt: now,
                    },
                },
                select: {
                    u_id: true,
                },
                distinct: ["u_id"],
            })
            : [],
        quickUserIds.length > 0
            ? prisma.userWallet.count({
                where: {
                    u_id: { in: quickUserIds },
                },
            })
            : 0,
        selfRegisteredUserIds.length > 0
            ? prisma.userWallet.count({
                where: {
                    u_id: { in: selfRegisteredUserIds },
                },
            })
            : 0,
    ]);

    const bucket = new Map<string, number>();
    for (let i = 0; i < 14; i += 1) {
        const day = new Date(chartStart);
        day.setDate(chartStart.getDate() + i);
        bucket.set(dayKey(day), 0);
    }

    for (const row of walletRows) {
        const key = dayKey(row.created_at);
        bucket.set(key, (bucket.get(key) || 0) + 1);
    }

    const chartRows = Array.from(bucket.entries()).map(([key, count]) => ({
        key,
        label: key.slice(5),
        count,
    }));

    const maxCount = Math.max(1, ...chartRows.map((item) => item.count));

    let running = activatedBeforeRange;
    const cumulativeRows = chartRows.map((item) => {
        running += item.count;
        return {
            ...item,
            total: running,
        };
    });

    const latestTotal = cumulativeRows.length > 0 ? cumulativeRows[cumulativeRows.length - 1].total : activatedBeforeRange;

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-linear-to-r from-white via-slate-50 to-white p-7 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">User Analytics</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">User Growth Chart</h1>
                <p className="mt-2 text-sm text-slate-600">
                    All users are real records in database. Here we only classify users by Quick Login vs Self-Registered.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                        href="/admin/ops"
                        className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                        Back to Dashboard
                    </Link>
                    <Link
                        href="/admin/ops/users"
                        className="inline-flex items-center rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
                    >
                        Go to User Management
                    </Link>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Total Users</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">{allUsers.length}</p>
                    <p className="mt-1 text-xs text-slate-500">All user records</p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Activated Users</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">{latestTotal}</p>
                    <p className="mt-1 text-xs text-slate-500">Users with wallet created (cumulative)</p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">7D Active Users</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">{activeUsers7d.length}</p>
                    <p className="mt-1 text-xs text-slate-500">Distinct users with transactions</p>
                </article>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Quick Login Users</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">{quickUsers.length}</p>
                    <p className="mt-1 text-xs text-slate-500">Activated: {quickActivated}</p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Self-Registered Users</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">{selfRegisteredUsers.length}</p>
                    <p className="mt-1 text-xs text-slate-500">Activated: {selfActivated}</p>
                </article>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-900">New Activated Users (Last 14 Days)</h2>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                        Today +{activatedToday}
                    </span>
                </div>

                <div className="grid grid-cols-7 gap-3 sm:grid-cols-14">
                    {chartRows.map((item) => {
                        const barHeight = Math.max(8, Math.round((item.count / maxCount) * 120));
                        return (
                            <div key={item.key} className="flex flex-col items-center gap-2">
                                <span className="text-xs text-slate-500">{item.count}</span>
                                <div className="flex h-32 w-full items-end justify-center rounded-lg bg-slate-50 px-1.5">
                                    <div
                                        className="w-full rounded-md bg-linear-to-t from-sky-300 to-sky-100"
                                        style={{ height: `${barHeight}px` }}
                                        title={`${item.key}: ${item.count}`}
                                    />
                                </div>
                                <span className="text-[10px] text-slate-400">{item.label}</span>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Data Notes</h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    <li>All counts are from Prisma queries against current database data.</li>
                    <li>Quick login users are identified by email prefix: quick.temp / quick.new / quick.intermediate.</li>
                    <li>Activated users are measured by UserWallet creation records.</li>
                </ul>
            </section>
        </div>
    );
}
