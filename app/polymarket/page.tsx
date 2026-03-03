// Polymarket Main Page
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function getAuthState() {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get("auth")?.value === "true";
    const userCookie = cookieStore.get("user")?.value;
    const user = userCookie ? JSON.parse(userCookie) : null;
    return { isLoggedIn, user };
}

export default async function PolymarketPage() {
    const { isLoggedIn } = await getAuthState();

    if (!isLoggedIn) {
        redirect("/login");
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        Prediction Markets
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Trade on real-world events and earn profits
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Active Markets</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">24</p>
                        </div>
                        <div className="text-3xl">🎯</div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">My Positions</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">0</p>
                        </div>
                        <div className="text-3xl">📋</div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total Volume</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">$0</p>
                        </div>
                        <div className="text-3xl">💰</div>
                    </div>
                </div>
            </div>

            {/* Markets List */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900">Featured Markets</h2>
                </div>
                <div className="p-6">
                    <div className="text-center py-12 text-gray-500">
                        <div className="text-4xl mb-4">🎲</div>
                        <p className="text-lg font-medium">Coming Soon</p>
                        <p className="text-sm mt-2">
                            Prediction markets will be available shortly
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
