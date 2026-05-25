import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";

type OpsMetrics = {
  totalUsers: number;
  todayNewUsers: number;
  activeUsersCount: number;
  abnormalUsers: number;
  staffAccounts: number;
  staffAdminUsers: number;
  staffName: string;
  loaded: boolean;
  errorMessage: string | null;
};

function getDateRanges() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return { now, todayStart, todayEnd, sevenDaysAgo };
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

async function loadOpsMetrics(user: { name?: string; email?: string; role?: string }) {
  const { now, todayStart, todayEnd, sevenDaysAgo } = getDateRanges();
  const abnormalStatuses = new Set(["INACTIVE", "LOCKED", "PENDING", "SUSPENDED"]);

  try {
    const allUsers = await prisma.user.findMany({
      select: {
        u_id: true,
        status: true,
        role: true,
      },
    });

    const allUserIds = allUsers.map((item) => item.u_id);

    const [todayNewUsers, activeUsers7d] = await Promise.all([
      allUserIds.length > 0
        ? prisma.userWallet.count({
          where: {
            u_id: { in: allUserIds },
            created_at: {
              gte: todayStart,
              lt: todayEnd,
            },
          },
        })
        : 0,
      allUserIds.length > 0
        ? prisma.walletTransaction.findMany({
          where: {
            u_id: { in: allUserIds },
            transaction_date: {
              gte: sevenDaysAgo,
              lt: now,
            },
          },
          select: {
            u_id: true,
          },
          distinct: ["u_id"],
        })
        : [],
    ]);

    const staffName = user.name || user.email || "Staff User";
    const staffAdminUsers = allUsers.filter((item) => {
      const currentRole = String(item.role || "").toLowerCase();
      return currentRole === "staff" || currentRole === "admin";
    }).length;

    return {
      totalUsers: allUsers.length,
      todayNewUsers,
      activeUsersCount: activeUsers7d.length,
      abnormalUsers: allUsers.filter((item) => abnormalStatuses.has(String(item.status || "").toUpperCase())).length,
      staffAccounts: allUsers.filter((item) => String(item.role || "").toLowerCase() === "staff").length,
      staffAdminUsers,
      staffName,
      loaded: true,
      errorMessage: null,
    } satisfies OpsMetrics;
  } catch (error) {
    console.error("Ops dashboard metrics load failed:", error);

    return {
      totalUsers: 0,
      todayNewUsers: 0,
      activeUsersCount: 0,
      abnormalUsers: 0,
      staffAccounts: 0,
      staffAdminUsers: 0,
      staffName: user.name || user.email || "Staff User",
      loaded: false,
      errorMessage: error instanceof Error ? error.message : "Database unavailable right now.",
    } satisfies OpsMetrics;
  }
}

export default async function OpsDashboardPage() {
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

  const { now } = getDateRanges();
  const metrics = await loadOpsMetrics(user);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-linear-to-r from-white via-slate-50 to-white p-7 shadow-sm">
        <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-sky-100/70 blur-2xl" />
        <div className="absolute -bottom-16 -left-10 h-36 w-36 rounded-full bg-emerald-100/60 blur-2xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Staff Console</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Management Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Independent staff workspace for account governance and operations.
            </p>
          </div>
          <div className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm shadow-sm lg:w-auto lg:min-w-80">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Current Admin</p>
            <p className="mt-2 text-base font-semibold text-slate-900">{metrics.staffName}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-700">
                Role: {String(user.role || "staff").toUpperCase()}
              </span>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-700">
                Staff Accounts: {metrics.staffAccounts}
              </span>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
                Updated {toLocalDateTime(now)}
              </span>
            </div>
          </div>
        </div>

        {!metrics.loaded ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
            <p className="font-semibold">Database temporarily unavailable</p>
            <p className="mt-1 text-xs leading-5 text-amber-800">
              The dashboard shell is loading, but live metrics could not be fetched right now. {metrics.errorMessage}
            </p>
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Total Users</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{metrics.totalUsers}</p>
          <p className="mt-1 text-xs text-slate-500">All registered users</p>
          <div className="mt-4">
            <Link
              href="/admin/ops/users/analytics"
              className="inline-flex items-center rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2 text-xs font-medium text-sky-700 transition hover:bg-sky-100"
            >
              View User Chart
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">New Users Today</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{metrics.todayNewUsers}</p>
          <p className="mt-1 text-xs text-slate-500">Based on newly activated wallets</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Active Users (7D)</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{metrics.activeUsersCount}</p>
          <p className="mt-1 text-xs text-slate-500">Users with transaction activity</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Abnormal Accounts</p>
          <p className={`mt-2 text-3xl font-semibold ${metrics.abnormalUsers > 0 ? "text-amber-600" : "text-slate-900"}`}>
            {metrics.abnormalUsers}
          </p>
          <p className="mt-1 text-xs text-slate-500">Locked / pending / inactive users</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Management Zones</h2>
            <p className="mt-1 text-sm text-slate-600">Choose a management area to continue.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article className="group rounded-2xl border border-slate-200 bg-linear-to-b from-white to-slate-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Core</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">User Management</h3>
            <p className="mt-2 text-sm text-slate-600">Browse accounts, review status, and perform account-level actions.</p>
            <div className="mt-5">
              <Link
                href="/admin/ops/users"
                className="inline-flex items-center rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
              >
                Enter Section
              </Link>
            </div>
          </article>

          <article className="group rounded-2xl border border-slate-200 bg-linear-to-b from-white to-slate-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Governance</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">Roles & Permissions</h3>
            <p className="mt-2 text-sm text-slate-600">Define who can access sensitive features and admin operations.</p>
            <div className="mt-5">
              <Link
                href="/admin/ops/roles"
                className="inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
              >
                Enter Section
              </Link>
            </div>
          </article>

          <article className="group rounded-2xl border border-slate-200 bg-linear-to-b from-white to-slate-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Security</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">Risk & Reports</h3>
            <p className="mt-2 text-sm text-slate-600">Handle suspicious behavior, user reports, and moderation workflows.</p>
            <div className="mt-5">
              <Link
                href="/admin/ops/risk"
                className="inline-flex items-center rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100"
              >
                Enter Section
              </Link>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-linear-to-b from-white to-slate-50 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Operations</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">Announcements</h3>
            <p className="mt-2 text-sm text-slate-600">Publish system notices and operational messages.</p>
            <div className="mt-5">
              <span className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
                Coming Soon
              </span>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-linear-to-b from-white to-slate-50 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Finance</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">Wallet & Transactions</h3>
            <p className="mt-2 text-sm text-slate-600">Inspect wallet balances, deposits, and transaction anomalies.</p>
            <div className="mt-5">
              <span className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
                Coming Soon
              </span>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-linear-to-b from-white to-slate-50 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Monitoring</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">API & Job Status</h3>
            <p className="mt-2 text-sm text-slate-600">Observe critical APIs and scheduled task execution health.</p>
            <div className="mt-5">
              <Link
                href="/admin/ops/backtests"
                className="inline-flex items-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
              >
                Run Backtest Batch
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Metric Notes</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li>Total users: all accounts.</li>
          <li>New users today: count of wallets created today (activated users).</li>
          <li>Active users 7D: distinct users with wallet transactions in the last 7 days.</li>
          <li>Abnormal accounts: status in INACTIVE / LOCKED / PENDING / SUSPENDED.</li>
        </ul>
      </section>
    </div>
  );
}
