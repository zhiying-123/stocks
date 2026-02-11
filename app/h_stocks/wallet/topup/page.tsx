// Top Up Page - Server Component
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import TopUpUI from "./topUpUI";

export const dynamic = 'force-dynamic';

async function getWalletBalance() {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get("user")?.value;
    const user = userCookie ? JSON.parse(userCookie) : null;

    if (!user?.id) return { balance: null, currency: "MYR" };

    const wallet = await prisma.userWallet.findUnique({
        where: { u_id: user.id },
    });

    return {
        balance: wallet?.balance ? Number(wallet.balance) : null,
        currency: wallet?.currency ?? "MYR",
    };
}

export default async function TopUpPage() {
    const { balance, currency } = await getWalletBalance();

    // If wallet not activated, redirect to wallet page
    if (balance === null) {
        redirect('/h_stocks/wallet');
    }

    return <TopUpUI currentBalance={balance} currency={currency} />;
}
