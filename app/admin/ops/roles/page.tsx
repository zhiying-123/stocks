import Link from "next/link";
import prisma from "@/lib/prisma";

const QUICK_EMAIL_PREFIXES = ["quick.temp.", "quick.new.", "quick.intermediate."];

function realUserWhere() {
    return {
        NOT: QUICK_EMAIL_PREFIXES.map((prefix) => ({
            email: {
                startsWith: prefix,
            },
        })),
    };
}

const ROLE_NOTES: Record<string, string> = {
    ADMIN: "Full system control including staff governance and sensitive operations.",
    STAFF: "Operational management rights for accounts, moderation, and reporting.",
    MEMBER: "Standard end-user access for trading and personal account operations.",
};

export default async function StaffRolesPage() {
    const users = await prisma.user.findMany({
        where: realUserWhere(),
        select: {
            u_id: true,
            name: true,
            email: true,
            role: true,
            status: true,
        },
        orderBy: {
            u_id: "desc",
        },
        take: 150,
    });

    const roleStats = users.reduce<Record<string, number>>((acc, item) => {
        const key = String(item.role || "member").toUpperCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    const adminUsers = users.filter((item) => String(item.role || "").toLowerCase() === "admin");
    const staffUsers = users.filter((item) => String(item.role || "").toLowerCase() === "staff");

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-linear-to-r from-white via-slate-50 to-white p-7 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Management Zone</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Roles & Permissions</h1>
                <p className="mt-2 text-sm text-slate-600">Review real role distribution and enforce clean access boundaries.</p>

                <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                        href="/admin/ops"
                        className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                        Back to Dashboard
                    </Link>
                    <Link
                        href="/admin/ops/users"
                        className="inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
                    >
                        Open User Management
                    </Link>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {Object.keys(ROLE_NOTES).map((roleKey) => (
                    <article key={roleKey} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{roleKey}</p>
                        <p className="mt-2 text-3xl font-semibold text-slate-900">{roleStats[roleKey] || 0}</p>
                        <p className="mt-2 text-sm text-slate-600">{ROLE_NOTES[roleKey]}</p>
                    </article>
                ))}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Permission Matrix</h2>
                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                            <tr>
                                <th className="px-4 py-3">Capability</th>
                                <th className="px-4 py-3">Member</th>
                                <th className="px-4 py-3">Staff</th>
                                <th className="px-4 py-3">Admin</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ["Use trading features", "Yes", "Yes", "Yes"],
                                ["Access staff dashboard", "No", "Yes", "Yes"],
                                ["Manage user status", "No", "Yes", "Yes"],
                                ["Manage staff permissions", "No", "No", "Yes"],
                                ["Access risk moderation", "No", "Yes", "Yes"],
                            ].map((row) => (
                                <tr key={row[0]} className="border-t border-slate-100 text-slate-700">
                                    <td className="px-4 py-3 font-medium">{row[0]}</td>
                                    <td className="px-4 py-3">{row[1]}</td>
                                    <td className="px-4 py-3">{row[2]}</td>
                                    <td className="px-4 py-3">{row[3]}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Admin Accounts</h3>
                    <ul className="mt-4 space-y-2 text-sm text-slate-700">
                        {adminUsers.length === 0 ? (
                            <li className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500">No admin account found.</li>
                        ) : (
                            adminUsers.map((item) => (
                                <li key={item.u_id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                    <span className="font-medium">{item.name}</span>
                                    <span className="ml-2 text-slate-500">{item.email}</span>
                                </li>
                            ))
                        )}
                    </ul>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Staff Accounts</h3>
                    <ul className="mt-4 space-y-2 text-sm text-slate-700">
                        {staffUsers.length === 0 ? (
                            <li className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500">No staff account found.</li>
                        ) : (
                            staffUsers.map((item) => (
                                <li key={item.u_id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                    <span className="font-medium">{item.name}</span>
                                    <span className="ml-2 text-slate-500">{item.email}</span>
                                </li>
                            ))
                        )}
                    </ul>
                </article>
            </section>
        </div>
    );
}
