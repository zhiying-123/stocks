// H-Stocks Investment Platform Layout
import Link from "next/link";
import { cookies } from "next/headers";
import { investmentRoutes } from "./h_s_routes";
import LogoutButton from "../logout/LogoutButton";
import AlertNotificationProvider from "../components/AlertNotificationProvider";

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
        <AlertNotificationProvider>
            <div className="min-h-screen bg-gray-50">
                {/* Top Navigation Bar - with backdrop blur */}
                <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 shadow-sm">
                    <div className="max-w-7xl mx-auto px-6 py-4">
                        <div className="flex items-center justify-between">
                            {/* Logo */}
                            <Link href="/" className="flex items-center gap-2 text-xl font-bold text-gray-900 hover:text-gray-700 transition-colors">
                                <span className="text-2xl">📈</span>
                                <span>H-Stocks</span>
                            </Link>

                            {/* Navigation Links */}
                            <div className="flex items-center gap-1">
                                {investmentRoutes.map((route) => (
                                    <Link
                                        key={route.path}
                                        href={route.path}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 rounded-lg transition-all"
                                    >
                                        <span>{route.icon}</span>
                                        <span>{route.label}</span>
                                    </Link>
                                ))}
                            </div>

                            {/* User Info & Logout */}
                            <div className="flex items-center gap-4">
                                {user && (
                                    <div className="flex items-center gap-2 text-sm text-gray-700">
                                        <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                            {(user.name || user.email).charAt(0).toUpperCase()}
                                        </div>
                                        <span className="font-medium">{user.name || user.email}</span>
                                    </div>
                                )}
                                {user && <LogoutButton />}
                            </div>
                        </div>
                    </div>
                </nav>

                {/* Main Content */}
                <main className="max-w-7xl mx-auto px-6 py-8">
                    {children}
                </main>
            </div>
        </AlertNotificationProvider>
    );
}
