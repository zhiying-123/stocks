import "dotenv/config";
import prisma from "../lib/prisma";

const POLYMARKET_API = "https://gamma-api.polymarket.com";

function parseStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parsePricePair(value: unknown): [number, number] | null {
  let prices = value;
  if (typeof prices === "string") {
    try {
      prices = JSON.parse(prices);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(prices) || prices.length < 2) return null;

  const yes = Number(prices[0]);
  const no = Number(prices[1]);
  if (!Number.isFinite(yes) || !Number.isFinite(no)) return null;

  return [yes, no];
}

async function getOneOpenMarket() {
  const response = await fetch(`${POLYMARKET_API}/events?limit=50&offset=0&closed=false`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch markets: ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Polymarket events response is not an array");
  }

  for (const event of data) {
    if (!Array.isArray(event?.markets)) continue;

    for (const market of event.markets) {
      const parsedPrices = parsePricePair(market?.outcomePrices);
      if (!parsedPrices) continue;
      if (parsedPrices[0] <= 0 || parsedPrices[0] >= 1) continue;

      const clobIds = parseStringArray(market?.clobTokenIds);
      const tokenId = clobIds[0]?.trim() || String(market?.conditionId || "").trim();
      if (!tokenId) continue;

      return {
        marketId: tokenId,
        question: String(market?.question || event?.title || tokenId),
        yesPrice: parsedPrices[0],
      };
    }
  }

  throw new Error("No open market with valid price found");
}

function getCheckUrls() {
  const appUrlRaw = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.VERCEL_URL;
  if (!appUrlRaw) {
    throw new Error("Missing NEXT_PUBLIC_APP_URL (or APP_URL / VERCEL_URL) for online checker URL");
  }
  const normalizedAppUrl = appUrlRaw.startsWith("http") ? appUrlRaw : `https://${appUrlRaw}`;
  const appUrl = normalizedAppUrl.replace(/\/$/, "");
  const secret = process.env.POLYMARKET_ALERT_CRON_SECRET || process.env.CRON_SECRET;
  const withSecret = (url: string) => (secret ? `${url}?secret=${encodeURIComponent(secret)}` : url);

  return [withSecret(`${appUrl}/api/polymarket/alerts/check`)];
}

async function main() {
  const testStartedAt = new Date();

  const wallet = await prisma.userWallet.findFirst({
    orderBy: { u_id: "asc" },
    select: {
      u_id: true,
      balance: true,
      currency: true,
    },
  });

  if (!wallet) {
    throw new Error("No user with wallet found for experiment");
  }

  const user = await prisma.user.findUnique({
    where: { u_id: wallet.u_id },
    select: {
      u_id: true,
      email: true,
      name: true,
    },
  });

  if (!user) {
    throw new Error(`User not found for wallet user_id=${wallet.u_id}`);
  }

  const market = await getOneOpenMarket();
  const testQuantity = 1;

  const created = await prisma.$queryRaw<Array<{ alert_id: number }>>`
    INSERT INTO "PolymarketPriceAlert"
      ("u_id", "market_id", "outcome", "direction", "target_price", "auto_buy_enabled", "auto_buy_quantity", "source", "is_active", "created_at", "updated_at")
    VALUES
      (${user.u_id}, ${market.marketId}, 'YES', 'BELOW', 1.0, true, ${testQuantity}, 'DIRECT|EMAIL,DISCORD', true, NOW(), NOW())
    RETURNING "alert_id"
  `;

  const alertId = created[0]?.alert_id;
  if (!alertId) {
    throw new Error("Failed to create test alert");
  }

  let checkResponse: { url: string; payload: unknown } | null = null;
  let lastError: unknown = null;

  const checkUrls = Array.from(new Set(getCheckUrls()));
  for (const url of checkUrls) {
    try {
      const response = await fetch(url, { method: "GET" });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        checkResponse = { url, payload };
        break;
      }
      lastError = new Error(`Check API failed (${response.status}) at ${url}: ${JSON.stringify(payload)}`);
    } catch (error) {
      lastError = error;
    }
  }

  if (!checkResponse) {
    throw new Error(`Failed to trigger check API. Last error: ${String(lastError)}`);
  }

  const alertRow = await prisma.$queryRaw<Array<{
    alert_id: number;
    is_active: boolean;
    triggered_at: Date | null;
    auto_buy_enabled: boolean;
    auto_buy_quantity: number | null;
    auto_buy_executed_at: Date | null;
  }>>`
    SELECT
      "alert_id",
      "is_active",
      "triggered_at",
      "auto_buy_enabled",
      "auto_buy_quantity",
      "auto_buy_executed_at"
    FROM "PolymarketPriceAlert"
    WHERE "alert_id" = ${alertId}
    LIMIT 1
  `;

  const newTrades = await prisma.polymarketTransaction.findMany({
    where: {
      u_id: user.u_id,
      market_id: market.marketId,
      transaction_type: "BUY",
      transaction_date: {
        gte: testStartedAt,
      },
    },
    orderBy: {
      transaction_date: "desc",
    },
    take: 3,
  });

  console.log(
    JSON.stringify(
      {
        success: true,
        testUser: {
          id: user.u_id,
          email: user.email,
          name: user.name,
          walletBalance: wallet.balance,
          walletCurrency: wallet.currency,
        },
        market,
        alertId,
        checkResponse,
        alertRow: alertRow[0] || null,
        newTrades,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("AUTO_BUY_EXPERIMENT_FAILED", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
