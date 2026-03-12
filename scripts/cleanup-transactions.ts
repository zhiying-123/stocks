// Script to check and clean up duplicate Polymarket transactions
import prisma from '../lib/prisma';

async function cleanupTransactions() {
    try {
        console.log('=== Checking database for duplicate records ===\n');

        // 1. Check PolymarketTransaction table
        const polymarketTx = await prisma.polymarketTransaction.findMany({
            orderBy: { transaction_date: 'desc' },
            take: 20,
        });
        console.log(`Found ${polymarketTx.length} records in PolymarketTransaction table (showing last 20):`);
        polymarketTx.forEach((tx, i) => {
            console.log(`  ${i + 1}. [${tx.transaction_type}] ${tx.market_id} - ${tx.outcome} - ${tx.quantity} shares - ${tx.category || 'No category'}`);
        });

        // 2. Check WalletTransaction table (Polymarket only)
        const walletTx = await prisma.walletTransaction.findMany({
            where: {
                OR: [
                    { transaction_type: 'POLYMARKET_BUY' },
                    { transaction_type: 'POLYMARKET_SELL' }
                ]
            },
            orderBy: { transaction_date: 'desc' },
            take: 20,
        });
        console.log(`\nFound ${walletTx.length} Polymarket records in WalletTransaction table (showing last 20):`);
        walletTx.forEach((tx, i) => {
            console.log(`  ${i + 1}. [${tx.transaction_type}] ${tx.symbol} - ${tx.description} - ${tx.amount} ${tx.currency}`);
        });

        console.log('\n=== Cleanup Options ===');
        console.log('1. Delete ALL PolymarketTransaction records (we now only use WalletTransaction)');
        console.log('2. Delete ALL Polymarket WalletTransaction records (to start fresh)');
        console.log('3. Delete BOTH (complete cleanup)');
        console.log('\nTo proceed, run one of these commands:');
        console.log('  Option 1: Change the script to execute option 1');
        console.log('  Option 2: Change the script to execute option 2');
        console.log('  Option 3: Change the script to execute option 3');

        // Uncomment ONE of these options to execute:

        // OPTION 1: Delete only PolymarketTransaction (recommended)
        const deletedPolymarket = await prisma.polymarketTransaction.deleteMany({});
        console.log(`\n✓ OPTION 1: Deleted ${deletedPolymarket.count} PolymarketTransaction records`);

        // OPTION 2: Delete only WalletTransaction (Polymarket)
        // const deletedWallet = await prisma.walletTransaction.deleteMany({
        //     where: {
        //         OR: [
        //             { transaction_type: 'POLYMARKET_BUY' },
        //             { transaction_type: 'POLYMARKET_SELL' }
        //         ]
        //     }
        // });
        // console.log(`\n✓ OPTION 2: Deleted ${deletedWallet.count} WalletTransaction records (Polymarket)`);

        // OPTION 3: Delete both (complete cleanup)
        // const deletedPolymarket = await prisma.polymarketTransaction.deleteMany({});
        // const deletedWallet = await prisma.walletTransaction.deleteMany({
        //     where: {
        //         OR: [
        //             { transaction_type: 'POLYMARKET_BUY' },
        //             { transaction_type: 'POLYMARKET_SELL' }
        //         ]
        //     }
        // });
        // console.log(`\n✓ OPTION 3: Deleted ${deletedPolymarket.count} PolymarketTransaction + ${deletedWallet.count} WalletTransaction records`);

        console.log('\n✓ Cleanup completed successfully!');
        console.log('New purchases will now only record ONCE in WalletTransaction table.');

    } catch (error) {
        console.error('✗ Error during cleanup:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

cleanupTransactions()
    .catch((error) => {
        console.error('Failed to run cleanup:', error);
        process.exit(1);
    });
