import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { ensureDefaultPolymarketGroups, syncPolymarketGroups } from "@/lib/polymarket-groups";

async function getAuthedUser() {
  const cookieStore = await cookies();
  const userCookie = cookieStore.get("user")?.value;
  return userCookie ? (JSON.parse(userCookie) as { id?: number }) : null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    await ensureDefaultPolymarketGroups(prisma);

    const body = (await request.json().catch(() => ({}))) as {
      groupId?: number;
      slug?: string;
      includeSystemOnly?: boolean;
    };

    const groupId = body.groupId != null ? Number(body.groupId) : null;
    const slug = body.slug ? String(body.slug).trim() : null;

    const whereClause = body.includeSystemOnly
      ? { is_system: true }
      : groupId
        ? { group_id: groupId }
        : slug
          ? { slug }
          : {};

    const groups = await prisma.polymarketMarketGroup.findMany({
      where: whereClause,
      orderBy: [{ is_system: "desc" }, { created_at: "asc" }],
    });

    if (groups.length === 0) {
      return NextResponse.json({ error: "No groups found to sync" }, { status: 404 });
    }

    const result = await syncPolymarketGroups(prisma, groups);

    return NextResponse.json({
      success: true,
      synced_group_count: groups.length,
      ...result,
    });
  } catch (error) {
    console.error("[POLYMARKET GROUP SYNC POST]", error);
    return NextResponse.json({ error: "Failed to sync polymarket groups" }, { status: 500 });
  }
}
