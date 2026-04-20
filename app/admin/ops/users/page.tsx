import Link from "next/link";
import prisma from "@/lib/prisma";

type UsersPageProps = {
    searchParams?: Promise<{
        q?: string;
        status?: string;
        role?: string;
    }>;
};

export default async function StaffUsersPage({ searchParams }: UsersPageProps) {
    const params = (await searchParams) || {};
    const q = String(params.q || "").trim();
    const selectedStatus = String(params.status || "ALL").toUpperCase();
    const selectedRole = String(params.role || "ALL").toLowerCase();

    const allMatchedUsers = await prisma.user.findMany({
        where: {
            ...(q
                ? {
                    OR: [
                        { email: { contains: q, mode: "insensitive" } },
                        { name: { contains: q, mode: "insensitive" } },
                    ],
                }
                : {}),
            ...(selectedStatus !== "ALL"
                ? {
                    status: {
                        equals: selectedStatus,
                        mode: "insensitive",
                    },
                }
                : {}),
            ...(selectedRole !== "ALL"
                ? {
                    role: {
                        equals: selectedRole,
                        mode: "insensitive",
                    },
                }
                : {}),
        },
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
        take: 300,
    });

    const users = allMatchedUsers.slice(0, 120);

    const statusBucket = users.reduce<Record<string, number>>((acc, item) => {
        const key = String(item.status || "UNKNOWN").toUpperCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    const activeCount = statusBucket.ACTIVE || 0;
    const inactiveCount = statusBucket.INACTIVE || 0;
    const pendingCount = statusBucket.PENDING || 0;

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-linear-to-r from-white via-slate-50 to-white p-7 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Management Zone</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">User Management</h1>
                <p className="mt-2 text-sm text-slate-600">Search, filter, and inspect user accounts.</p>

                <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                        href="/admin/ops"
                        className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                        Back to Dashboard
                    </Link>
                    <Link
                        href="/admin/ops/users/analytics"
                        className="inline-flex items-center rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
                    >
                        User Growth Chart
                    </Link>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Filtered Total</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">{users.length}</p>
                    <p className="mt-1 text-xs text-slate-500">Current query result</p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Active</p>
                    <p className="mt-2 text-3xl font-semibold text-emerald-700">{activeCount}</p>
                    <p className="mt-1 text-xs text-slate-500">Status = ACTIVE</p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Inactive</p>
                    <p className="mt-2 text-3xl font-semibold text-amber-700">{inactiveCount}</p>
                    <p className="mt-1 text-xs text-slate-500">Status = INACTIVE</p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Pending</p>
                    <p className="mt-2 text-3xl font-semibold text-sky-700">{pendingCount}</p>
                    <p className="mt-1 text-xs text-slate-500">Status = PENDING</p>
                </article>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <form className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_170px_170px_auto] md:items-end">
                    <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Search</label>
                        <input
                            type="text"
                            name="q"
                            defaultValue={q}
                            placeholder="Name or email"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Status</label>
                        <select
                            name="status"
                            defaultValue={selectedStatus}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                        >
                            <option value="ALL">All</option>
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE">Inactive</option>
                            <option value="PENDING">Pending</option>
                            <option value="LOCKED">Locked</option>
                        </select>
                    </div>

                    <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Role</label>
                        <select
                            name="role"
                            defaultValue={selectedRole}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                        >
                            <option value="ALL">All</option>
                            <option value="member">Member</option>
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
                    >
                        Apply Filter
                    </button>
                </form>

                <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                            <tr>
                                <th className="px-4 py-3">ID</th>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Email</th>
                                <th className="px-4 py-3">Role</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Failed Attempts</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                                        No users found for current filter.
                                    </td>
                                </tr>
                            ) : (
                                users.map((item) => {
                                    const status = String(item.status || "UNKNOWN").toUpperCase();
                                    const statusClass =
                                        status === "ACTIVE"
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                            : status === "INACTIVE"
                                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                                : "bg-slate-100 text-slate-700 border-slate-200";

                                    return (
                                        <tr key={item.u_id} className="border-t border-slate-100 text-slate-700">
                                            <td className="px-4 py-3 font-medium">{item.u_id}</td>
                                            <td className="px-4 py-3">{item.name}</td>
                                            <td className="px-4 py-3">{item.email}</td>
                                            <td className="px-4 py-3">
                                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                                                    {String(item.role || "member").toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass}`}>
                                                    {status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">{item.access_time || 0}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
