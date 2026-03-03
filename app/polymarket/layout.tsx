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
    const { isLoggedIn } = await getAuthState();

    if (!isLoggedIn) {
        redirect("/login");
    }

    return (
        <div className="max-w-7xl mx-auto">
            {children}
        </div>
    );
}
