// Shared Wallet Page
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import WalletUI from "../h_stocks/wallet/walletUI";

async function getAuthState() {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get("auth")?.value === "true";
    const userCookie = cookieStore.get("user")?.value;
    const user = userCookie ? JSON.parse(userCookie) : null;
    return { isLoggedIn, user };
}

async function getWalletData(userId: number) {
    const wallet = await prisma.userWallet.findUnique({
        where: { u_id: userId },
    });

    // Try to get wallet transactions first
    let walletTransactions: any[] = [];
    try {
        walletTransactions = await prisma.walletTransaction.findMany({
            where: { u_id: userId },
            orderBy: { transaction_date: "desc" },
            take: 50,
        });
    } catch (error) {
        console.log("WalletTransaction table not yet migrated, using StockTransaction");
    }

    // Get stock transactions as fallback
    const stockTransactions = await prisma.stockTransaction.findMany({
        where: { u_id: userId },
        orderBy: { transaction_date: "desc" },
        take: 20,
    });

    // Transform to UI format
    const transactions = walletTransactions.length > 0
        ? walletTransactions.map((tx: any) => ({
            id: tx.transaction_id,
            symbol: tx.symbol || "",
            type: tx.transaction_type,
            quantity: tx.quantity || 0,
            price: tx.price || 0,
            totalAmount: tx.amount,
            currency: tx.currency,
            balanceAfter: tx.balance_after,
            description: tx.description,
            date: tx.transaction_date.toISOString(),
        }))
        : stockTransactions.map((tx: any) => ({
            id: tx.transaction_id,
            symbol: tx.symbol,
            type: tx.transaction_type,
            quantity: tx.quantity,
            price: tx.price,
            totalAmount: tx.total_amount,
            currency: tx.currency,
            date: tx.transaction_date.toISOString(),
        }));

    return {
        wallet: wallet ? {
            balance: Number(wallet.balance),
            currency: wallet.currency,
            updatedAt: wallet.updated_at.toISOString(),
        } : null,
        transactions
    };
}

export default async function WalletPage() {
    const { isLoggedIn, user } = await getAuthState();

    if (!isLoggedIn || !user) {
        redirect("/login");
    }

    const { wallet, transactions } = await getWalletData(user.id);

    return (
        <div className="max-w-7xl mx-auto">
            <WalletUI wallet={wallet} transactions={transactions} />
        </div>
    );
}
