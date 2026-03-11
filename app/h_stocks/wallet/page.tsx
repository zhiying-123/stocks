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

    const wallet = await prisma.userWallet.findUnique({ where: { u_id: user.id } });

    // Get all wallet transactions (DEPOSIT, WITHDRAW, and STOCK/POLYMARKET transactions)
    const walletTransactions = await prisma.walletTransaction.findMany({
        where: { u_id: user.id },
        orderBy: { transaction_date: "desc" },
    });

    console.log("[WALLET PAGE] Found", walletTransactions.length, "wallet transactions");

    // Get stock transactions (for backward compatibility with old data)
    const stockTransactions = await prisma.stockTransaction.findMany({
        where: { u_id: user.id },
        orderBy: { transaction_date: "desc" },
    });

    // Get polymarket transactions (for backward compatibility)
    let polymarketTransactions: any[] = [];
    try {
        polymarketTransactions = await prisma.polymarketTransaction.findMany({
            where: { u_id: user.id },
            orderBy: { transaction_date: "desc" },
        });
    } catch (error) {
        console.log("PolymarketTransaction table not available");
    }

    // Create a set of transaction IDs that already exist in WalletTransaction
    const walletTxKeys = new Set(
        walletTransactions
            .filter(tx => tx.symbol) // Only consider wallet transactions with symbols
            .map(tx => `${tx.transaction_type}-${tx.symbol}-${new Date(tx.transaction_date).getTime()}`)
    );

    // Transform wallet transactions
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
            const key = `STOCK_${tx.transaction_type.toUpperCase()}-${tx.symbol}-${new Date(tx.transaction_date).getTime()}`;
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

    // Transform polymarket transactions (only include those not in WalletTransaction)
    const mappedPolyTx = polymarketTransactions
        .filter((tx: any) => {
            const key = `POLYMARKET_${tx.transaction_type.toUpperCase()}-${tx.market_id}-${new Date(tx.transaction_date).getTime()}`;
            return !walletTxKeys.has(key);
        })
        .map((tx: any) => ({
            id: `p-${tx.transaction_id}`,
            symbol: tx.market_id || "",
            type: `POLYMARKET_${tx.transaction_type.toUpperCase()}`,
            quantity: tx.quantity,
            price: tx.price,
            totalAmount: tx.total_amount,
            currency: tx.currency,
            description: `${tx.outcome} shares`,
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
        transactions,
    };
}

export default async function WalletPage() {
    const { wallet, transactions } = await getWalletData();

    return <WalletUI wallet={wallet} transactions={transactions} />;
}
