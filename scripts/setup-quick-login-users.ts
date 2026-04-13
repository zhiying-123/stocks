import "dotenv/config";
import prisma from "../lib/prisma";

const POLYMARKET_API = "https://gamma-api.polymarket.com/events?limit=50&offset=0&closed=false";

type QuickAccountConfig = {
  key: "new" | "intermediate";
  index: number;
  email: string;
  name: string;
  watchlistStocks: string[];
};

function getQuickPoolSize() {
  const raw = Number(process.env.QUICK_LOGIN_POOL_SIZE || 20);
  if (!Number.isFinite(raw) || raw < 1) return 20;
  return Math.floor(raw);
}

function getQuickEmailDomain() {
  return (process.env.QUICK_LOGIN_EMAIL_DOMAIN || "hstocks.local").toLowerCase();
}

function buildPoolEmail(type: "new" | "intermediate", index: number) {
  const domain = getQuickEmailDomain();
  return `quick.${type}.${index}@${domain}`;
}

function normalizeSymbolList(symbols: string[]) {
  return Array.from(
    new Set(
      symbols
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}

async function getPolymarketConditionIds(limit: number): Promise<string[]> {
  try {
    const response = await fetch(POLYMARKET_API, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Polymarket fetch failed (${response.status})`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("Polymarket response is not an array");
    }

    const ids = new Set<string>();
    for (const event of data) {
      if (!Array.isArray(event?.markets)) continue;
      for (const market of event.markets) {
        const id = String(market?.conditionId || "").trim();
        if (!id) continue;
        ids.add(id);
        if (ids.size >= limit) {
          return Array.from(ids);
        }
      }
    }

    return Array.from(ids);
  } catch (error) {
    console.warn("[setup-quick-login-users] Failed to fetch polymarket IDs, using fallback list.", error);
    const fallback = (process.env.QUICK_LOGIN_POLYMARKET_IDS || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    return fallback.slice(0, limit);
  }
}

async function upsertQuickUser(config: QuickAccountConfig, password: string, polymarketIds: string[]) {
  const user = await prisma.user.upsert({
    where: { email: config.email },
    update: {
      name: config.name,
      password,
      role: "member",
      status: "ACTIVE",
      access_time: config.index - 1,
    },
    create: {
      email: config.email,
      name: config.name,
      password,
      role: "member",
      status: "ACTIVE",
      access_time: config.index - 1,
    },
  });

  await prisma.userWallet.upsert({
    where: { u_id: user.u_id },
    update: {
      balance: config.key === "new" ? 2500 : 12500,
      currency: "MYR",
    },
    create: {
      u_id: user.u_id,
      balance: config.key === "new" ? 2500 : 12500,
      currency: "MYR",
    },
  });

  if (config.key === "new") {
    await prisma.stockWatchlist.deleteMany({ where: { u_id: user.u_id } });
    await prisma.polymarketWatchlist.deleteMany({ where: { u_id: user.u_id } });
    return {
      email: config.email,
      userId: user.u_id,
      stockWatchlist: 0,
      polymarketWatchlist: 0,
    };
  }

  const stockSymbols = normalizeSymbolList(config.watchlistStocks);

  await prisma.stockWatchlist.deleteMany({ where: { u_id: user.u_id } });
  if (stockSymbols.length > 0) {
    await prisma.stockWatchlist.createMany({
      data: stockSymbols.map((symbol) => ({ u_id: user.u_id, symbol })),
      skipDuplicates: true,
    });
  }

  await prisma.polymarketWatchlist.deleteMany({ where: { u_id: user.u_id } });
  if (polymarketIds.length > 0) {
    await prisma.polymarketWatchlist.createMany({
      data: polymarketIds.map((market_id) => ({ u_id: user.u_id, market_id })),
      skipDuplicates: true,
    });
  }

  return {
    email: config.email,
    userId: user.u_id,
    stockWatchlist: stockSymbols.length,
    polymarketWatchlist: polymarketIds.length,
  };
}

async function main() {
  const quickPassword = process.env.QUICK_LOGIN_USER_PASSWORD || "quick12345";
  const poolSize = getQuickPoolSize();

  const configs: QuickAccountConfig[] = [];
  for (let i = 1; i <= poolSize; i += 1) {
    configs.push({
      key: "new",
      index: i,
      email: buildPoolEmail("new", i),
      name: `New User ${i}`,
      watchlistStocks: [],
    });
    configs.push({
      key: "intermediate",
      index: i,
      email: buildPoolEmail("intermediate", i),
      name: `Intermediate User ${i}`,
      watchlistStocks: ["AAPL", "NVDA", "TSLA", "MSFT"],
    });
  }

  const polymarketIds = await getPolymarketConditionIds(4);

  const results = [];
  for (const config of configs) {
    const result = await upsertQuickUser(config, quickPassword, polymarketIds);
    results.push(result);
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        message: "Quick login users are ready.",
        poolSize,
        emailDomain: getQuickEmailDomain(),
        accounts: results,
        polymarketIdsUsed: polymarketIds,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("SETUP_QUICK_LOGIN_USERS_FAILED", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
