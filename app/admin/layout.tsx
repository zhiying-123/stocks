import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LogoutButton from "../logout/LogoutButton";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  const displayName = user.name || user.email || "Staff";

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 to-gray-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/admin/ops" className="text-lg font-semibold tracking-tight text-slate-900">
              Staff Console
            </Link>
            <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 sm:inline-flex">
              {String(user.role || "staff").toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <p className="hidden text-sm text-slate-600 md:block">{displayName}</p>
            <LogoutButton className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100" />
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[240px_1fr]">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <nav className="space-y-1">
            <Link href="/admin/ops" className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
              Dashboard
            </Link>
            <Link href="/admin/ops/users" className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
              User Management
            </Link>
            <Link href="/admin/ops/roles" className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
              Roles & Permissions
            </Link>
            <Link href="/admin/ops/risk" className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
              Risk & Reports
            </Link>
            <Link href="/admin/ops/users/analytics" className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
              User Analytics
            </Link>
          </nav>
        </aside>

        <main>{children}</main>
      </div>
    </div>
  );
}
