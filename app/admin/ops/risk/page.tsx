import Link from "next/link";
import prisma from "@/lib/prisma";

const QUICK_EMAIL_PREFIXES = ["quick.temp.", "quick.new.", "quick.intermediate."];
const ABNORMAL_STATUSES = new Set(["INACTIVE", "LOCKED", "PENDING", "SUSPENDED"]);

function realUserWhere() {
    return {
        NOT: QUICK_EMAIL_PREFIXES.map((prefix) => ({
            email: {
                startsWith: prefix,
            },
        })),
    };
}

export default async function StaffRiskPage() {
    const users = await prisma.user.findMany({
        where: realUserWhere(),
        select: {
            u_id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            access_time: true,
        },
        orderBy: {
            u_id: "desc",
        },
        take: 160,
    });

    const abnormalAccounts = users.filter((item) => ABNORMAL_STATUSES.has(String(item.status || "").toUpperCase()));
    const warningAccounts = users.filter((item) => (item.access_time || 0) > 0 && !ABNORMAL_STATUSES.has(String(item.status || "").toUpperCase()));
    const highRisk = users.filter((item) => (item.access_time || 0) >= 2 || String(item.status || "").toUpperCase() === "INACTIVE");

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-linear-to-r from-white via-slate-50 to-white p-7 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Management Zone</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Risk & Reports</h1>
                <p className="mt-2 text-sm text-slate-600">Monitor abnormal statuses and suspicious login attempts from real accounts.</p>

                <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                        href="/admin/ops"
                        className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                        Back to Dashboard
                    </Link>
                    <Link
                        href="/admin/ops/users"
                        className="inline-flex items-center rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100"
                    >
                        Review Users
                    </Link>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Abnormal Accounts</p>
                    <p className="mt-2 text-3xl font-semibold text-amber-700">{abnormalAccounts.length}</p>
                    <p className="mt-1 text-xs text-slate-500">INACTIVE / LOCKED / PENDING / SUSPENDED</p>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Warning Accounts</p>
                    <p className="mt-2 text-3xl font-semibold text-sky-700">{warningAccounts.length}</p>
                    <p className="mt-1 text-xs text-slate-500">Failed login attempts &gt; 0</p>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">High Risk</p>
                    <p className="mt-2 text-3xl font-semibold text-rose-700">{highRisk.length}</p>
                    <p className="mt-1 text-xs text-slate-500">Inactive or failed attempts &gt;= 2</p>
                </article>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Abnormal Account Queue</h2>
                    <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                                <tr>
                                    <th className="px-4 py-3">User</th>
                                    <th className="px-4 py-3">Role</th>
                                    <th className="px-4 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {abnormalAccounts.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-8 text-center text-slate-500">No abnormal accounts right now.</td>
                                    </tr>
                                ) : (
                                    abnormalAccounts.map((item) => (
                                        <tr key={item.u_id} className="border-t border-slate-100 text-slate-700">
                                            <td className="px-4 py-3">
                                                <p className="font-medium">{item.name}</p>
                                                <p className="text-xs text-slate-500">{item.email}</p>
                                            </td>
                                            <td className="px-4 py-3">{String(item.role || "member").toUpperCase()}</td>
                                            <td className="px-4 py-3">
                                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                                                    {String(item.status || "UNKNOWN").toUpperCase()}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Failed Login Watchlist</h2>
                    <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                                <tr>
                                    <th className="px-4 py-3">User</th>
                                    <th className="px-4 py-3">Attempts</th>
                                    <th className="px-4 py-3">Risk Flag</th>
                                </tr>
                            </thead>
                            <tbody>
                                {warningAccounts.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-8 text-center text-slate-500">No warning accounts.</td>
                                    </tr>
                                ) : (
                                    warningAccounts.map((item) => (
                                        <tr key={item.u_id} className="border-t border-slate-100 text-slate-700">
                                            <td className="px-4 py-3">
                                                <p className="font-medium">{item.name}</p>
                                                <p className="text-xs text-slate-500">{item.email}</p>
                                            </td>
                                            <td className="px-4 py-3 font-medium">{item.access_time || 0}</td>
                                            <td className="px-4 py-3">
                                                {(item.access_time || 0) >= 2 ? (
                                                    <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">High</span>
                                                ) : (
                                                    <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">Moderate</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </article>
            </section>
        </div>
    );
}
