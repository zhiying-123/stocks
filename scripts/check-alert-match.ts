import "dotenv/config";
import prisma from "../lib/prisma";

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

function parsePair(value: unknown): [number, number] | null {
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

async function main() {
  const alertId = Number(process.argv[2]);
  if (!Number.isInteger(alertId) || alertId <= 0) {
    throw new Error("Usage: npx tsx scripts/check-alert-match.ts <alertId>");
  }

  const alert = await prisma.polymarketPriceAlert.findUnique({ where: { alert_id: alertId } });
  if (!alert) {
    console.log(JSON.stringify({ alertId, found: false, reason: "Alert not found" }));
    return;
  }

  const response = await fetch("https://gamma-api.polymarket.com/events?limit=500&offset=0&closed=false", {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const data = await response.json();

  let marketFound: { yes: number; no: number; question: string } | null = null;

  if (Array.isArray(data)) {
    for (const event of data) {
      if (!Array.isArray(event?.markets)) continue;

      for (const market of event.markets) {
        const pair = parsePair(market?.outcomePrices);
        if (!pair) continue;

        const conditionId = String(market?.conditionId || "").trim();
        const clobIds = parseStringArray(market?.clobTokenIds)
          .map((id) => id.trim())
          .filter(Boolean);
        const candidateIds = new Set([conditionId, ...clobIds].filter(Boolean));
        if (!candidateIds.has(alert.market_id)) continue;

        marketFound = {
          yes: pair[0],
          no: pair[1],
          question: String(market?.question || event?.title || alert.market_id),
        };
        break;
      }

      if (marketFound) break;
    }
  }

  if (!marketFound) {
    console.log(JSON.stringify({ alertId, found: true, inPriceMap: false, market_id: alert.market_id }, null, 2));
    return;
  }

  const current = alert.outcome === "NO" ? marketFound.no : marketFound.yes;
  const matched = alert.direction === "ABOVE" ? current >= alert.target_price : current <= alert.target_price;

  console.log(
    JSON.stringify(
      {
        alertId,
        found: true,
        inPriceMap: true,
        market_id: alert.market_id,
        question: marketFound.question,
        direction: alert.direction,
        target_price: alert.target_price,
        current,
        matched,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
