"use server";

import prisma from "@/lib/prisma";
import { createAuthSession } from "../login";
import { redirect } from "next/navigation";

type QuickUserType = "new" | "intermediate";

function getEmailDomain() {
  return (process.env.QUICK_LOGIN_EMAIL_DOMAIN || "hstocks.local").toLowerCase();
}

function getPoolPrefix(type: QuickUserType) {
  return type === "new" ? "quick.new." : "quick.intermediate.";
}

function buildTemporaryEmail(type: QuickUserType) {
  const domain = getEmailDomain();
  const rand = Math.random().toString(36).slice(2, 8);
  const stamp = Date.now().toString(36);
  return `quick.temp.${type}.${stamp}${rand}@${domain}`;
}

async function getRoundRobinPoolUser(type: QuickUserType) {
  const prefix = getPoolPrefix(type);

  const poolUser = await prisma.user.findFirst({
    where: {
      email: { startsWith: prefix },
      status: "ACTIVE",
    },
    orderBy: [{ access_time: "asc" }, { u_id: "asc" }],
    select: {
      u_id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      access_time: true,
      password: true,
    },
  });

  if (!poolUser) {
    return null;
  }

  await prisma.user.update({
    where: { u_id: poolUser.u_id },
    data: {
      access_time: (poolUser.access_time ?? 0) + 1,
      status: "ACTIVE",
    },
  });

  return poolUser;
}

async function createTemporaryUserFromPool(type: QuickUserType, poolUserId: number, password: string) {
  const temporaryEmail = buildTemporaryEmail(type);

  const createdUser = await prisma.user.create({
    data: {
      email: temporaryEmail,
      name: type === "new" ? "Quick New User" : "Quick Intermediate User",
      password,
      role: "member",
      status: "ACTIVE",
      access_time: 0,
    },
    select: {
      u_id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  const poolWallet = await prisma.userWallet.findUnique({
    where: { u_id: poolUserId },
    select: {
      balance: true,
      currency: true,
    },
  });

  await prisma.userWallet.create({
    data: {
      u_id: createdUser.u_id,
      balance: poolWallet?.balance ?? (type === "new" ? 2500 : 12500),
      currency: poolWallet?.currency || "MYR",
    },
  });

  if (type === "intermediate") {
    const [stockWatchlist, polymarketWatchlist] = await Promise.all([
      prisma.stockWatchlist.findMany({
        where: { u_id: poolUserId },
        select: { symbol: true },
      }),
      prisma.polymarketWatchlist.findMany({
        where: { u_id: poolUserId },
        select: { market_id: true },
      }),
    ]);

    if (stockWatchlist.length > 0) {
      await prisma.stockWatchlist.createMany({
        data: stockWatchlist.map((item) => ({
          u_id: createdUser.u_id,
          symbol: item.symbol,
        })),
        skipDuplicates: true,
      });
    }

    if (polymarketWatchlist.length > 0) {
      await prisma.polymarketWatchlist.createMany({
        data: polymarketWatchlist.map((item) => ({
          u_id: createdUser.u_id,
          market_id: item.market_id,
        })),
        skipDuplicates: true,
      });
    }
  }

  return createdUser;
}

export async function loginAsQuickUser(formData: FormData) {
  const rawType = String(formData.get("userType") || "").trim().toLowerCase();
  const userType: QuickUserType | null = rawType === "new" || rawType === "intermediate" ? rawType : null;

  if (!userType) {
    redirect("/login/quick?error=invalid-user-type");
  }

  let poolUser: Awaited<ReturnType<typeof getRoundRobinPoolUser>>;
  try {
    poolUser = await getRoundRobinPoolUser(userType);
  } catch (error) {
    console.error("[quick-login] failed to fetch pool user", error);
    redirect("/login/quick?error=server-error");
  }

  if (!poolUser) {
    redirect("/login/quick?error=missing-user");
  }

  try {
    const tempPassword = process.env.QUICK_LOGIN_USER_PASSWORD || "quick12345";
    const temporaryUser = await createTemporaryUserFromPool(userType, poolUser.u_id, tempPassword);

    await createAuthSession({
      u_id: temporaryUser.u_id,
      email: temporaryUser.email,
      name: temporaryUser.name,
      role: temporaryUser.role,
    });
  } catch (error) {
    console.error("[quick-login] failed to create temporary user session", error);
    redirect("/login/quick?error=server-error");
  }

  redirect("/h_stocks");
}
