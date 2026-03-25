import "dotenv/config";
import prisma from "../lib/prisma";

const EXCHANGE_RATES_TO_USD: Record<string, number> = {
  USD: 1,
  MYR: 4.5,
  SGD: 1.35,
};

const TEST_ALERT_IDS = [14, 15, 16];
const TEST_TRANSACTION_IDS = [22, 23, 24];

async function main() {
  const alertsBefore = await prisma.polymarketPriceAlert.findMany({
    where: { alert_id: { in: TEST_ALERT_IDS } },
    orderBy: { alert_id: "asc" },
  });

  const transactionsBefore = await prisma.polymarketTransaction.findMany({
    where: { transaction_id: { in: TEST_TRANSACTION_IDS } },
    orderBy: { transaction_id: "asc" },
  });

  const summary = await prisma.$transaction(async (tx) => {
    const refundedByUser: Record<number, number> = {};

    for (const polyTx of transactionsBefore) {
      const wallet = await tx.userWallet.findUnique({ where: { u_id: polyTx.u_id } });
      if (!wallet) {
        continue;
      }

      const rate = EXCHANGE_RATES_TO_USD[wallet.currency] || 1;
      const refund = Number(polyTx.total_amount) * rate;

      await tx.userWallet.update({
        where: { u_id: polyTx.u_id },
        data: {
          balance: Number(wallet.balance) + refund,
          updated_at: new Date(),
        },
      });

      refundedByUser[polyTx.u_id] = (refundedByUser[polyTx.u_id] || 0) + refund;

      const holding = await tx.polymarketHolding.findUnique({
        where: {
          u_id_market_id_outcome: {
            u_id: polyTx.u_id,
            market_id: polyTx.market_id,
            outcome: polyTx.outcome,
          },
        },
      });

      if (holding) {
        const newQty = Number(holding.quantity) - Number(polyTx.quantity);
        if (newQty <= 0) {
          await tx.polymarketHolding.delete({
            where: {
              u_id_market_id_outcome: {
                u_id: polyTx.u_id,
                market_id: polyTx.market_id,
                outcome: polyTx.outcome,
              },
            },
          });
        } else {
          await tx.polymarketHolding.update({
            where: {
              u_id_market_id_outcome: {
                u_id: polyTx.u_id,
                market_id: polyTx.market_id,
                outcome: polyTx.outcome,
              },
            },
            data: {
              quantity: newQty,
              updated_at: new Date(),
            },
          });
        }
      }
    }

    const deletedTransactions = await tx.polymarketTransaction.deleteMany({
      where: { transaction_id: { in: TEST_TRANSACTION_IDS } },
    });

    const deletedAlerts = await tx.polymarketPriceAlert.deleteMany({
      where: { alert_id: { in: TEST_ALERT_IDS } },
    });

    return {
      deletedAlerts: deletedAlerts.count,
      deletedTransactions: deletedTransactions.count,
      refundedByUser,
    };
  });

  const alertsAfter = await prisma.polymarketPriceAlert.findMany({
    where: { alert_id: { in: TEST_ALERT_IDS } },
  });

  const transactionsAfter = await prisma.polymarketTransaction.findMany({
    where: { transaction_id: { in: TEST_TRANSACTION_IDS } },
  });

  console.log(
    JSON.stringify(
      {
        success: true,
        lookedUpAlerts: alertsBefore.map((a) => a.alert_id),
        lookedUpTransactions: transactionsBefore.map((t) => t.transaction_id),
        cleanupResult: summary,
        remainingAlerts: alertsAfter.length,
        remainingTransactions: transactionsAfter.length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("CLEANUP_AUTO_BUY_EXPERIMENT_FAILED", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
