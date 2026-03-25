import "dotenv/config";
import prisma from "../lib/prisma";

async function main() {
  const alertId = Number(process.argv[2]);
  if (!Number.isInteger(alertId) || alertId <= 0) {
    throw new Error("Usage: npx tsx scripts/check-alert-state.ts <alertId>");
  }

  const alert = await prisma.$queryRaw<Array<{
    alert_id: number;
    u_id: number;
    market_id: string;
    is_active: boolean;
    triggered_at: Date | null;
    auto_buy_enabled: boolean;
    auto_buy_quantity: number | null;
    auto_buy_executed_at: Date | null;
  }>>`
    SELECT
      "alert_id",
      "u_id",
      "market_id",
      "is_active",
      "triggered_at",
      "auto_buy_enabled",
      "auto_buy_quantity",
      "auto_buy_executed_at"
    FROM "PolymarketPriceAlert"
    WHERE "alert_id" = ${alertId}
    LIMIT 1
  `;

  if (!alert[0]) {
    console.log(JSON.stringify({ alertId, found: false }, null, 2));
    return;
  }

  const row = alert[0];
  const trades = await prisma.polymarketTransaction.findMany({
    where: {
      u_id: row.u_id,
      market_id: row.market_id,
      transaction_type: "BUY",
    },
    orderBy: {
      transaction_date: "desc",
    },
    take: 5,
  });

  console.log(JSON.stringify({
    alert: row,
    latestBuyTrades: trades,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
