import "dotenv/config";
import prisma from "../lib/prisma";

function buildCheckUrls() {
  const appUrlRaw = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const appUrl = appUrlRaw.replace(/\/$/, "");
  const secret = process.env.POLYMARKET_ALERT_CRON_SECRET || process.env.CRON_SECRET;
  const withSecret = (url: string) => (secret ? `${url}?secret=${encodeURIComponent(secret)}` : url);

  return [
    withSecret(`${appUrl}/api/polymarket/alerts/check`),
    withSecret("http://localhost:3000/api/polymarket/alerts/check"),
    withSecret("http://localhost:3001/api/polymarket/alerts/check"),
  ];
}

async function triggerChecker() {
  const urls = Array.from(new Set(buildCheckUrls()));
  let lastError: unknown = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, { method: "GET" });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        return { url, payload };
      }
      lastError = new Error(`Checker failed (${response.status}) at ${url}: ${JSON.stringify(payload)}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Failed to trigger checker: ${String(lastError)}`);
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    throw new Error("Usage: npx tsx scripts/test-auto-buy-for-user.ts <email>");
  }

  const startedAt = new Date();

  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    select: {
      u_id: true,
      email: true,
      name: true,
    },
  });

  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  const activeAutoBuyAlerts = await prisma.$queryRaw<Array<{
    alert_id: number;
    market_id: string;
    outcome: string;
    direction: string;
    target_price: number;
    auto_buy_quantity: number | null;
    is_active: boolean;
    created_at: Date;
  }>>`
    SELECT
      "alert_id",
      "market_id",
      "outcome",
      "direction",
      "target_price",
      "auto_buy_quantity",
      "is_active",
      "created_at"
    FROM "PolymarketPriceAlert"
    WHERE "u_id" = ${user.u_id}
      AND "is_active" = true
      AND "auto_buy_enabled" = true
      AND COALESCE("auto_buy_quantity", 0) > 0
    ORDER BY "created_at" DESC
  `;

  const checker = await triggerChecker();

  const triggeredAfterRun = await prisma.$queryRaw<Array<{
    alert_id: number;
    market_id: string;
    outcome: string;
    auto_buy_quantity: number | null;
    triggered_at: Date | null;
    auto_buy_executed_at: Date | null;
    is_active: boolean;
  }>>`
    SELECT
      "alert_id",
      "market_id",
      "outcome",
      "auto_buy_quantity",
      "triggered_at",
      "auto_buy_executed_at",
      "is_active"
    FROM "PolymarketPriceAlert"
    WHERE "u_id" = ${user.u_id}
      AND "triggered_at" IS NOT NULL
      AND "triggered_at" >= ${startedAt}
    ORDER BY "triggered_at" DESC
  `;

  const buysAfterRun = await prisma.polymarketTransaction.findMany({
    where: {
      u_id: user.u_id,
      transaction_type: "BUY",
      transaction_date: {
        gte: startedAt,
      },
    },
    orderBy: {
      transaction_date: "desc",
    },
    take: 10,
  });

  console.log(
    JSON.stringify(
      {
        success: true,
        user,
        startedAt,
        activeAutoBuyAlertsCount: activeAutoBuyAlerts.length,
        activeAutoBuyAlerts,
        checker,
        triggeredAfterRunCount: triggeredAfterRun.length,
        triggeredAfterRun,
        buysAfterRunCount: buysAfterRun.length,
        buysAfterRun,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("TEST_AUTO_BUY_FOR_USER_FAILED", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
