import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import MarketAnalysisUI from "./MarketAnalysisUI";

async function getAuthState() {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get("auth")?.value === "true";
    return { isLoggedIn };
}

export default async function MarketAnalysisPage({ params }: { params: Promise<{ tokenId: string }> }) {
    const { isLoggedIn } = await getAuthState();

    if (!isLoggedIn) {
        redirect("/login");
    }

    const resolvedParams = await params;
    const tokenId = decodeURIComponent(resolvedParams.tokenId);

    return <MarketAnalysisUI tokenId={tokenId} />;
}
