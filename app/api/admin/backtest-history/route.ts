import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

async function checkAdminAuth() {
  const cookieStore = await cookies();
  const isLoggedIn = cookieStore.get("auth")?.value === "true";
  const userCookie = cookieStore.get("user")?.value;

  let user = null;
  if (userCookie) {
    try {
      user = JSON.parse(userCookie);
    } catch (parseError) {
      console.error("Failed to parse user cookie:", parseError);
      return null;
    }
  }

  if (!isLoggedIn || !user?.id) {
    return null;
  }

  const role = String(user.role || "").toLowerCase();
  if (role !== "staff" && role !== "admin") {
    return null;
  }

  return user;
}

export async function GET(req: NextRequest) {
  const user = await checkAdminAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    const marketId = url.searchParams.get("marketId");
    const groupName = url.searchParams.get("groupName");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    const where: any = {};
    if (marketId) where.market_id = { contains: marketId };
    if (groupName) where.group_name = { contains: groupName };

    // Handle date range filtering correctly — validate YYYY-MM-DD format first
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (startDate && !dateRegex.test(startDate)) {
      return NextResponse.json({ error: "Invalid startDate format. Use YYYY-MM-DD" }, { status: 400 });
    }
    if (endDate && !dateRegex.test(endDate)) {
      return NextResponse.json({ error: "Invalid endDate format. Use YYYY-MM-DD" }, { status: 400 });
    }

    if (startDate || endDate) {
      where.executed_at = {};
      if (startDate) where.executed_at.gte = new Date(startDate);
      if (endDate) where.executed_at.lte = new Date(endDate);
    }

    const [results, total] = await Promise.all([
      prisma.backtestHistory.findMany({
        where,
        orderBy: { executed_at: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.backtestHistory.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      results,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("GET backtest history error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch backtest history";
    // Return the error message temporarily to aid debugging
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await checkAdminAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const {
      market_id,
      clob_token_id,
      market_name,
      group_name,
      net_pnl,
      return_pct,
      trades_count,
      start_date,
      end_date,
      initial_cash,
      final_equity,
      vs_buy_hold,
      max_drawdown,
    } = body;

    const result = await prisma.backtestHistory.create({
      data: {
        market_id,
        clob_token_id,
        market_name,
        group_name,
        net_pnl,
        return_pct,
        trades_count,
        start_date,
        end_date,
        initial_cash,
        final_equity,
        vs_buy_hold,
        max_drawdown,
      },
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("POST backtest history error:", error);
    return NextResponse.json({ error: "Failed to save backtest history" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await checkAdminAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const idParam = url.searchParams.get("id") || url.searchParams.get("ids");

    if (!idParam) {
      // Try to read body for DELETE with JSON body { ids: [1,2,3] }
      try {
        const body = await req.json().catch(() => ({}));
        const idsFromBody = body?.ids;
        if (!Array.isArray(idsFromBody) || idsFromBody.length === 0) {
          return NextResponse.json({ error: "Missing id(s) parameter" }, { status: 400 });
        }

        const ids = idsFromBody.map((v: any) => parseInt(v, 10)).filter(Boolean);
        await prisma.backtestHistory.deleteMany({ where: { id: { in: ids } } });
        return NextResponse.json({ success: true, deleted: ids.length });
      } catch (err) {
        return NextResponse.json({ error: "Missing id(s) parameter" }, { status: 400 });
      }
    }

    const ids = idParam.split(",").map((s) => parseInt(s.trim(), 10)).filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ error: "Invalid id parameter" }, { status: 400 });
    }

    await prisma.backtestHistory.deleteMany({ where: { id: { in: ids } } });

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error("DELETE backtest history error:", error);
    return NextResponse.json({ error: "Failed to delete backtest history" }, { status: 500 });
  }
}
