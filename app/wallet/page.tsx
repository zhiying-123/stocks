// Shared Wallet Page
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import WalletUI from "../h_stocks/wallet/walletUI";

export const dynamic = 'force-dynamic';

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

    // Get all wallet transactions (DEPOSIT and WITHDRAW only)
    const walletTransactions = await prisma.walletTransaction.findMany({
        where: {
            u_id: userId,
            OR: [
                { transaction_type: 'DEPOSIT' },
                { transaction_type: 'WITHDRAW' }
            ]
        },
        orderBy: { transaction_date: "desc" },
    });

    console.log("[WALLET PAGE] Found", walletTransactions.length, "wallet transactions (deposit/withdraw) for user", userId);

    // Get stock transactions (for backward compatibility with old data)
    const stockTransactions = await prisma.stockTransaction.findMany({
        where: { u_id: userId },
        orderBy: { transaction_date: "desc" },
    });

    // Get polymarket transactions
    let polymarketTransactions: any[] = [];
    try {
        polymarketTransactions = await prisma.polymarketTransaction.findMany({
            where: { u_id: userId },
            orderBy: { transaction_date: "desc" },
        });
        console.log("[WALLET PAGE] Found", polymarketTransactions.length, "polymarket transactions for user", userId);
    } catch (error) {
        console.log("PolymarketTransaction table not available");
    }

    // Create a set of transaction IDs that already exist in WalletTransaction
    // Use a simpler key that matches by type, symbol, and date (rounded to second)
    const walletTxKeys = new Set(
        walletTransactions.map(tx => {
            const dateKey = Math.floor(new Date(tx.transaction_date).getTime() / 1000); // Round to second
            return `${tx.transaction_type}-${tx.symbol || 'null'}-${dateKey}`;
        })
    );

    // Transform wallet transactions (DEPOSIT and WITHDRAW only)
    const mappedWalletTx = walletTransactions.map((tx: any) => ({
        id: `w-${tx.transaction_id}`,
        symbol: tx.symbol || "",
        type: tx.transaction_type,
        quantity: tx.quantity || 0,
        price: tx.price || 0,
        totalAmount: tx.amount,
        currency: tx.currency,
        balanceAfter: tx.balance_after,
        description: tx.description,
        date: tx.transaction_date.toISOString(),
    }));

    // Transform stock transactions (only include those not in WalletTransaction)
    const mappedStockTx = stockTransactions
        .filter((tx: any) => {
            const dateKey = Math.floor(new Date(tx.transaction_date).getTime() / 1000);
            const key = `STOCK_${tx.transaction_type.toUpperCase()}-${tx.symbol}-${dateKey}`;
            return !walletTxKeys.has(key);
        })
        .map((tx: any) => ({
            id: `s-${tx.transaction_id}`,
            symbol: tx.symbol,
            type: `STOCK_${tx.transaction_type.toUpperCase()}`,
            quantity: tx.quantity,
            price: tx.price,
            totalAmount: tx.total_amount,
            currency: tx.currency,
            date: tx.transaction_date.toISOString(),
        }));

    // Transform polymarket transactions
    const mappedPolyTx = polymarketTransactions.map((tx: any) => ({
        id: `p-${tx.transaction_id}`,
        symbol: tx.market_id || "",
        type: `POLYMARKET_${tx.transaction_type.toUpperCase()}`,
        quantity: tx.quantity,
        price: tx.price,
        totalAmount: tx.total_amount,
        currency: tx.currency,
        category: tx.category,
        outcome: tx.outcome,
        date: tx.transaction_date.toISOString(),
    }));

    // Merge all transactions and sort by date
    const transactions = [...mappedWalletTx, ...mappedStockTx, ...mappedPolyTx]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 100); // Limit to 100 most recent

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
