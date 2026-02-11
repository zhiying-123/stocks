// H-Stocks Investment Platform Layout
import Link from "next/link";
import { cookies } from "next/headers";
import { investmentRoutes } from "./h_s_routes";
import LogoutButton from "../logout/LogoutButton";

// ==================== Auth State ====================
async function getAuthState() {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get("auth")?.value === "true";
    const userCookie = cookieStore.get("user")?.value;
    const user = userCookie ? JSON.parse(userCookie) : null;
    return { isLoggedIn, user };
}

// ==================== Investment Platform Layout ====================
export default async function HStocksLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user } = await getAuthState();

    return (
        <div className="min-h-screen bg-[#f8f9fb] text-gray-900">
            {/* Header with depth */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="max-w-350 mx-auto px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Left: Back + Brand */}
                        <div className="flex items-center gap-5">
                            <Link
                                href="/"
                                className="flex items-center gap-1.5 text-gray-400 hover:text-gray-900 transition-all group"
                            >
                                <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                <span className="text-sm font-medium">Back to Home</span>
                            </Link>

                            <div className="h-6 w-px bg-gray-200" />

                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center shadow-md">
                                    <span className="text-white font-bold text-sm tracking-tight">H</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[15px] font-bold text-gray-900 leading-tight tracking-tight">H-Stocks</span>
                                    <span className="text-[10px] text-gray-400 font-medium leading-tight">INVESTMENT</span>
                                </div>
                            </div>
                        </div>

                        {/* Center: Navigation */}
                        <nav className="hidden md:flex items-center bg-gray-100/80 rounded-xl p-1">
                            {investmentRoutes.map((route) => (
                                <Link
                                    key={route.path}
                                    href={route.path}
                                    className="px-5 py-2 text-[13px] text-gray-500 hover:text-gray-900 hover:bg-white rounded-lg transition-all font-semibold hover:shadow-sm"
                                >
                                    {route.label}
                                </Link>
                            ))}
                        </nav>

                        {/* Right: User */}
                        <div className="flex items-center gap-3">
                            {user && (
                                <>
                                    <div className="flex items-center gap-3 pl-3 pr-1 py-1 rounded-full bg-gray-50 border border-gray-200/80">
                                        <span className="text-[13px] font-medium text-gray-600">{user.name || user.email}</span>
                                        <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-white text-xs font-bold ring-2 ring-white">
                                            {(user.name || user.email).charAt(0).toUpperCase()}
                                        </div>
                                    </div>
                                    <LogoutButton />
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-350 mx-auto px-8 py-8">
                {children}
            </main>
        </div>
    );
}
