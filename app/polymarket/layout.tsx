// Polymarket Module Layout
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function getAuthState() {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get("auth")?.value === "true";
    return { isLoggedIn };
}

export default async function PolymarketLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Auth checks are handled by individual page components to support callbackUrls

    return (
        <div className="min-h-screen bg-white">
            {children}
        </div>
    );
}
