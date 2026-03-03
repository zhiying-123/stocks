// Polymarket Analytics Page
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function getAuthState() {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get("auth")?.value === "true";
    return { isLoggedIn };
}

export default async function AnalyticsPage() {
    const { isLoggedIn } = await getAuthState();

    if (!isLoggedIn) {
        redirect("/login");
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Market Analytics</h1>
                <p className="text-gray-600 mt-1">
                    Insights and trends across prediction markets
                </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <div className="text-4xl mb-4">📊</div>
                <p className="text-lg font-medium text-gray-900">Analytics Coming Soon</p>
                <p className="text-sm text-gray-600 mt-2">
                    Advanced market analytics will be available shortly
                </p>
            </div>
        </div>
    );
}
