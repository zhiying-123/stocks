import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { ensureDefaultPolymarketGroups } from "@/lib/polymarket-groups";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseKeywords(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

async function getAuthedUser() {
  const cookieStore = await cookies();
  const userCookie = cookieStore.get("user")?.value;
  return userCookie ? (JSON.parse(userCookie) as { id?: number }) : null;
}

export async function GET(request: NextRequest) {
  try {
    await ensureDefaultPolymarketGroups(prisma);

    const includeMarkets = request.nextUrl.searchParams.get("includeMarkets") === "1";
    const marketLimit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("marketLimit") || "20")));

    const groups = await prisma.polymarketMarketGroup.findMany({
      orderBy: [{ is_system: "desc" }, { created_at: "asc" }],
    });

    const payload = await Promise.all(
      groups.map(async (group) => {
        const [marketCount, snapshotCount, latestSyncAt, markets] = await Promise.all([
          prisma.polymarketGroupedMarket.count({ where: { group_id: group.group_id } }),
          prisma.polymarketGroupedMarketSnapshot.count({ where: { group_id: group.group_id } }),
          prisma.polymarketGroupedMarketSnapshot.findFirst({
            where: { group_id: group.group_id },
            orderBy: { collected_at: "desc" },
            select: { collected_at: true },
          }),
          includeMarkets
            ? prisma.polymarketGroupedMarket.findMany({
                where: { group_id: group.group_id },
                orderBy: [{ is_closed: "asc" }, { last_seen_at: "desc" }],
                take: marketLimit,
              })
            : Promise.resolve([]),
        ]);

        return {
          ...group,
          keywords: String(group.match_keywords || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          market_count: marketCount,
          snapshot_count: snapshotCount,
          latest_sync_at: latestSyncAt?.collected_at || null,
          markets,
        };
      }),
    );

    return NextResponse.json({ success: true, groups: payload });
  } catch (error) {
    console.error("[POLYMARKET GROUPS GET]", error);
    return NextResponse.json({ error: "Failed to fetch polymarket groups" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = (await request.json()) as {
      name?: string;
      slug?: string;
      sourceUrl?: string;
      keywords?: string[] | string;
    };

    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const slug = slugify(String(body.slug || name));
    if (!slug) {
      return NextResponse.json({ error: "slug is invalid" }, { status: 400 });
    }

    const keywords = parseKeywords(body.keywords);
    if (keywords.length === 0) {
      return NextResponse.json(
        { error: "keywords is required (comma-separated string or array)" },
        { status: 400 },
      );
    }

    const created = await prisma.polymarketMarketGroup.create({
      data: {
        name,
        slug,
        source_url: body.sourceUrl ? String(body.sourceUrl).trim() : null,
        source_type: "KEYWORD",
        match_keywords: keywords.join(","),
        is_system: false,
        created_by_u_id: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      group: {
        ...created,
        keywords,
      },
    });
  } catch (error: unknown) {
    console.error("[POLYMARKET GROUPS POST]", error);

    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "A group with this slug already exists" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to create polymarket group" }, { status: 500 });
  }
}
