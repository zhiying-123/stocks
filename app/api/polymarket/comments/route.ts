import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

async function getUser() {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get("auth")?.value === "true";
    const userCookie = cookieStore.get("user")?.value;
    const user = userCookie ? JSON.parse(userCookie) : null;
    return { isLoggedIn, user };
}

// GET /api/polymarket/comments?marketId=xxx
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const marketId = searchParams.get("marketId");

    if (!marketId) {
        return NextResponse.json({ error: "marketId required" }, { status: 400 });
    }

    try {
        const comments = await prisma.polymarketComment.findMany({
            where: { market_id: marketId },
            orderBy: { created_at: "desc" },
            take: 50,
        });
        return NextResponse.json({ comments });
    } catch (error) {
        console.error("Error fetching comments:", error);
        return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
    }
}

// POST /api/polymarket/comments
export async function POST(req: NextRequest) {
    const { isLoggedIn, user } = await getUser();
    if (!isLoggedIn || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user?.u_id ?? user?.id;
    if (!userId) {
        return NextResponse.json({ error: "Invalid user session" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { marketId, content, sentiment } = body;

        if (!marketId || !content?.trim()) {
            return NextResponse.json({ error: "marketId and content required" }, { status: 400 });
        }

        if (content.trim().length > 500) {
            return NextResponse.json({ error: "Comment too long (max 500 chars)" }, { status: 400 });
        }

        const validSentiments = ["bullish", "bearish", "neutral"];
        const safeSentiment = validSentiments.includes(sentiment) ? sentiment : "neutral";

        const comment = await prisma.polymarketComment.create({
            data: {
                u_id: userId,
                market_id: marketId,
                user_name: user.name || "Anonymous",
                content: content.trim(),
                sentiment: safeSentiment,
            },
        });

        return NextResponse.json({ comment });
    } catch (error) {
        console.error("Error creating comment:", error);
        return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
    }
}

// DELETE /api/polymarket/comments?commentId=xxx
export async function DELETE(req: NextRequest) {
    const { isLoggedIn, user } = await getUser();
    if (!isLoggedIn || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user?.u_id ?? user?.id;
    if (!userId) {
        return NextResponse.json({ error: "Invalid user session" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("commentId");

    if (!commentId) {
        return NextResponse.json({ error: "commentId required" }, { status: 400 });
    }

    try {
        const comment = await prisma.polymarketComment.findUnique({
            where: { comment_id: parseInt(commentId) },
        });

        if (!comment) {
            return NextResponse.json({ error: "Comment not found" }, { status: 404 });
        }

        // Only the author can delete their own comment
        if (comment.u_id !== userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await prisma.polymarketComment.delete({
            where: { comment_id: parseInt(commentId) },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting comment:", error);
        return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
    }
}
