import Link from "next/link";
import { cookies } from "next/headers";
import { Fragment } from "react";
import prisma from "@/lib/prisma";
import {
    createManagedUserAction,
    deleteManagedUserAction,
    editManagedUserDetailAction,
    updateManagedUserStatusAction,
} from "./actions";
import CreateUserModal from "./CreateUserModal";
import ConfirmDeleteButton from "./ConfirmDeleteButton";
import EditUserModal from "./EditUserModal";

type UsersPageProps = {
    searchParams?: Promise<{
        q?: string;
        status?: string;
        role?: string;
        sortBy?: string;
        sortDir?: string;
        op?: string;
        note?: string;
    }>;
};

export default async function StaffUsersPage({ searchParams }: UsersPageProps) {
    const params = (await searchParams) || {};
    const cookieStore = await cookies();
    const rawUser = cookieStore.get("user")?.value;
    const sessionUser = rawUser ? JSON.parse(rawUser) as { email?: string } : null;
    const loginEmail = String(sessionUser?.email || "").trim().toLowerCase();

    const q = String(params.q || "").trim();
    const selectedStatus = String(params.status || "ALL").toUpperCase();
    const selectedRole = String(params.role || "ALL").toLowerCase();
    const sortByRaw = String(params.sortBy || "id").toLowerCase();
    const sortDirRaw = String(params.sortDir || "desc").toLowerCase();
    const op = String(params.op || "").toLowerCase();
    const note = String(params.note || "").trim();

    const selectedSortBy = ["id", "name", "email", "role", "status", "failed"].includes(sortByRaw)
        ? sortByRaw
        : "id";
    const selectedSortDir = sortDirRaw === "asc" ? "asc" : "desc";

    const orderByField =
        selectedSortBy === "name"
            ? "name"
            : selectedSortBy === "email"
                ? "email"
                : selectedSortBy === "role"
                    ? "role"
                    : selectedSortBy === "status"
                        ? "status"
                        : selectedSortBy === "failed"
                            ? "access_time"
                            : "u_id";

    const returnParams = new URLSearchParams();
    if (q) returnParams.set("q", q);
    if (selectedStatus !== "ALL") returnParams.set("status", selectedStatus);
    if (selectedRole !== "all") returnParams.set("role", selectedRole);
    if (selectedSortBy !== "id") returnParams.set("sortBy", selectedSortBy);
    if (selectedSortDir !== "desc") returnParams.set("sortDir", selectedSortDir);
    const returnPath = returnParams.toString()
        ? `/admin/ops/users?${returnParams.toString()}`
        : "/admin/ops/users";

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
            ...(selectedRole !== "all"
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
            [orderByField]: selectedSortDir,
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
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-semibold text-slate-900">Create User</h2>
                        <p className="mt-1 text-sm text-slate-600">Open a popup form to create account and send email details.</p>
                    </div>
                    <CreateUserModal loginEmail={loginEmail} action={createManagedUserAction} />
                </div>

                {note ? (
                    <div
                        className={`mt-4 rounded-xl border px-3 py-2 text-sm ${
                            op === "success"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                        }`}
                    >
                        {note}
                    </div>
                ) : null}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <form className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                    <div className="lg:col-span-12">
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Search</label>
                        <input
                            type="text"
                            name="q"
                            defaultValue={q}
                            placeholder="Name or email"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                        />
                    </div>

                    <div className="lg:col-span-2">
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

                    <div className="lg:col-span-2">
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

                    <div className="lg:col-span-2">
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Sort By</label>
                        <select
                            name="sortBy"
                            defaultValue={selectedSortBy}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                        >
                            <option value="id">ID</option>
                            <option value="name">Name</option>
                            <option value="email">Email</option>
                            <option value="role">Role</option>
                            <option value="status">Status</option>
                            <option value="failed">Failed Attempts</option>
                        </select>
                    </div>

                    <div className="lg:col-span-2">
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Order</label>
                        <select
                            name="sortDir"
                            defaultValue={selectedSortDir}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                        >
                            <option value="desc">Desc</option>
                            <option value="asc">Asc</option>
                        </select>
                    </div>

                    <div className="flex items-end lg:col-span-2">
                        <button
                            type="submit"
                            className="w-full inline-flex items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
                        >
                            Apply Filter
                        </button>
                    </div>

                    <div className="flex items-end lg:col-span-2">
                        <Link
                            href="/admin/ops/users"
                            className="w-full inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                            Reset
                        </Link>
                    </div>
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
                                    const role = String(item.role || "member").toLowerCase();
                                    const statusClass =
                                        status === "ACTIVE"
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                            : status === "INACTIVE"
                                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                                : "bg-slate-100 text-slate-700 border-slate-200";

                                    return (
                                        <Fragment key={item.u_id}>
                                            <tr className="border-t border-slate-100 text-slate-700">
                                                <td className="px-4 py-3 font-medium">{item.u_id}</td>
                                                <td className="px-4 py-3">{item.name}</td>
                                                <td className="px-4 py-3">{item.email}</td>
                                                <td className="px-4 py-3">
                                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                                                        {role.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass}`}>
                                                        {status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">{item.access_time || 0}</td>
                                            </tr>

                                            <tr className="border-t border-slate-100 bg-slate-50/60">
                                                <td colSpan={6} className="px-4 py-3">
                                                    <details>
                                                        <summary className="inline-flex cursor-pointer list-none items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100">
                                                            Show Actions
                                                        </summary>

                                                        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <form action={updateManagedUserStatusAction} className="flex flex-wrap items-center gap-2">
                                                                    <input type="hidden" name="userId" value={item.u_id} />
                                                                    <input type="hidden" name="returnPath" value={returnPath} />
                                                                    <select
                                                                        name="status"
                                                                        defaultValue={status}
                                                                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                                                                    >
                                                                        <option value="ACTIVE">ACTIVE</option>
                                                                        <option value="INACTIVE">INACTIVE</option>
                                                                        <option value="PENDING">PENDING</option>
                                                                        <option value="LOCKED">LOCKED</option>
                                                                    </select>
                                                                    <button
                                                                        type="submit"
                                                                        className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 transition hover:bg-sky-100"
                                                                    >
                                                                        Save Status
                                                                    </button>
                                                                </form>

                                                                <EditUserModal
                                                                    userId={item.u_id}
                                                                    defaultName={item.name}
                                                                    defaultEmail={item.email}
                                                                    defaultRole={role}
                                                                    returnPath={returnPath}
                                                                    action={editManagedUserDetailAction}
                                                                />

                                                                <form action={deleteManagedUserAction}>
                                                                    <input type="hidden" name="userId" value={item.u_id} />
                                                                    <input type="hidden" name="returnPath" value={returnPath} />
                                                                    <ConfirmDeleteButton
                                                                        message={`Delete account ${item.email}? This also removes related records.`}
                                                                        className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                                                                    />
                                                                </form>
                                                            </div>
                                                        </div>
                                                    </details>
                                                </td>
                                            </tr>
                                        </Fragment>
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
