// My Positions Page
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function getAuthState() {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get("auth")?.value === "true";
    return { isLoggedIn };
}

export default async function MyPositionsPage() {
    const { isLoggedIn } = await getAuthState();

    if (!isLoggedIn) {
        redirect("/login");
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">My Positions</h1>
                <p className="text-gray-600 mt-1">
                    Track your prediction market investments
                </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <div className="text-4xl mb-4">📋</div>
                <p className="text-lg font-medium text-gray-900">No Active Positions</p>
                <p className="text-sm text-gray-600 mt-2">
                    Start trading to see your positions here
                </p>
            </div>
        </div>
    );
}
