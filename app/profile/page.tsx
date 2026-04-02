// Profile Page
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LogoutButton from "../logout/LogoutButton";
import prisma from "@/lib/prisma";
import ProfileUI from "@/app/profile/profileUI";

async function getAuthState() {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get("auth")?.value === "true";
    const userCookie = cookieStore.get("user")?.value;
    const user = userCookie ? JSON.parse(userCookie) : null;
    return { isLoggedIn, user };
}

async function getTradingStats(userId: number) {
    // Get stock transactions count
    const stockTrades = await prisma.stockTransaction.count({
        where: { u_id: userId }
    });

    // Get polymarket transactions count (when table exists)
    let polymarketTrades = 0;
    // TODO: Add polymarket transaction count when table is ready

    return {
        stockTrades,
        polymarketTrades,
        totalTrades: stockTrades + polymarketTrades
    };
}

export default async function ProfilePage() {
    const { isLoggedIn, user } = await getAuthState();

    if (!isLoggedIn || !user) {
        redirect("/login");
    }

    const stats = await getTradingStats(user.id);
    const userInitial = (user?.name || user?.email || "?").charAt(0).toUpperCase();

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 rounded-3xl border border-gray-200 bg-gradient-to-br from-white via-slate-50 to-gray-100 shadow-sm p-7 md:p-8">
                    <div className="flex flex-col md:flex-row md:items-center gap-5">
                        <div className="w-20 h-20 rounded-2xl bg-gray-900 text-white text-3xl font-bold flex items-center justify-center shadow-md">
                            {userInitial}
                        </div>

                        <div className="flex-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Profile</p>
                            <h1 className="text-3xl font-semibold text-gray-900 mt-1 tracking-tight">
                                {user?.name || "User"}
                            </h1>
                            <p className="text-sm text-gray-600 mt-1">{user?.email}</p>

                            <div className="mt-4 flex flex-wrap gap-2">
                                <span className="px-3 py-1 rounded-full bg-gray-900 text-white text-xs font-semibold">
                                    {user?.role || "STUDENT"}
                                </span>
                                <span className="px-3 py-1 rounded-full bg-white border border-gray-300 text-xs font-semibold text-gray-700">
                                    Verified Account
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-white shadow-sm p-6 flex flex-col justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Session</p>
                        <p className="text-lg font-semibold text-gray-900 mt-2">Manage access</p>
                        <p className="text-sm text-gray-600 mt-1">You can safely sign out from here anytime.</p>
                    </div>
                    <div className="mt-5">
                        <LogoutButton className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 bg-gray-900 text-white text-sm font-semibold hover:bg-black transition-colors" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/80">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-gray-700">Account Details</h3>
                    </div>
                    <div className="p-6">
                        <ProfileUI
                            userId={user.id}
                            initialName={user?.name || ""}
                            email={user?.email || ""}
                        />
                    </div>
                </div>

                <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/80">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-gray-700">Trading Activity</h3>
                    </div>
                    <div className="p-6 space-y-3">
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-500">Stock Trades</p>
                                <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.stockTrades}</p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center">
                                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-500">Polymarket Trades</p>
                                <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.polymarketTrades}</p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center">
                                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-gray-900 bg-gray-900 p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-300">Total Trades</p>
                                <p className="text-2xl font-semibold text-white mt-1">{stats.totalTrades}</p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
