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
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Profile Hero */}
            <div className="relative rounded-2xl bg-gray-900 p-8 md:p-10 overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/3 rounded-full -translate-y-1/2 translate-x-1/4" />
                <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-white/2 rounded-full translate-y-1/2" />

                <div className="relative flex flex-col md:flex-row md:items-center gap-6">
                    {/* Avatar */}
                    <div className="w-24 h-24 rounded-2xl bg-white flex items-center justify-center text-gray-900 text-4xl font-bold shadow-xl">
                        {userInitial}
                    </div>

                    {/* User Info */}
                    <div className="flex-1">
                        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-2">
                            {user?.name || "User"}
                        </h1>
                        <p className="text-gray-400 text-sm mb-4">
                            {user?.email}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <span className="px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold border border-white/20">
                                {user?.role || "STUDENT"}
                            </span>
                            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                                Active
                            </span>
                        </div>
                    </div>

                    {/* Logout Button */}
                    <div className="md:self-start">
                        <LogoutButton />
                    </div>
                </div>
            </div>

            {/* Account Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Account Information Card */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-5 rounded-full bg-gray-900" />
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                                Account Details
                            </h3>
                        </div>
                    </div>
                    <div className="p-6">
                        <ProfileUI
                            userId={user.id}
                            initialName={user?.name || ""}
                            email={user?.email || ""}
                        />
                    </div>
                </div>

                {/* Trading Stats Card */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-5 rounded-full bg-gray-900" />
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                                Trading Activity
                            </h3>
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Stock Trades</p>
                                    <p className="text-2xl font-bold text-blue-900 mt-1">{stats.stockTrades}</p>
                                </div>
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 rounded-xl bg-purple-50 border border-purple-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Polymarket Trades</p>
                                    <p className="text-2xl font-bold text-purple-900 mt-1">{stats.polymarketTrades}</p>
                                </div>
                                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Total Trades</p>
                                    <p className="text-2xl font-bold text-emerald-900 mt-1">{stats.totalTrades}</p>
                                </div>
                                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
