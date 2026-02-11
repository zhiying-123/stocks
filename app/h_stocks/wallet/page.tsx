// Wallet Page - Server Component
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import WalletUI from "./walletUI";

export const dynamic = 'force-dynamic';

async function getWalletData() {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get("auth")?.value === "true";
    const userCookie = cookieStore.get("user")?.value;
    const user = userCookie ? JSON.parse(userCookie) : null;

    // Require login for wallet access
    if (!isLoggedIn || !user?.id) {
        redirect('/login');
    }

    console.log("[WALLET PAGE] Fetching wallet for user ID:", user.id);

    const [wallet, transactions] = await Promise.all([
        prisma.userWallet.findUnique({ where: { u_id: user.id } }),
        prisma.stockTransaction.findMany({
            where: { u_id: user.id },
            orderBy: { transaction_date: 'desc' },
            take: 20,
        }),
    ]);

    return {
        wallet: wallet ? {
            balance: Number(wallet.balance),
            currency: wallet.currency,
            updatedAt: wallet.updated_at.toISOString(),
        } : null,
        transactions: transactions.map(t => ({
            id: t.transaction_id,
            symbol: t.symbol,
            type: t.transaction_type,
            quantity: t.quantity,
            price: Number(t.price),
            totalAmount: Number(t.total_amount),
            currency: t.currency,
            date: t.transaction_date.toISOString(),
        })),
    };
}

export default async function WalletPage() {
    const { wallet, transactions } = await getWalletData();

    return <WalletUI wallet={wallet} transactions={transactions} />;
}
