import "dotenv/config";
import prisma from "../lib/prisma";

async function main() {
    const email = process.argv[2]?.trim().toLowerCase();
    if (!email) {
        throw new Error("Usage: npx tsx scripts/verify-user-polymarket-alerts.ts <email>");
    }

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
        console.log(JSON.stringify({ found: false, email }, null, 2));
        return;
    }

    const alerts = await prisma.polymarketPriceAlert.findMany({
        where: { u_id: user.u_id },
        orderBy: { created_at: "desc" },
        take: 30,
        select: {
            alert_id: true,
            market_id: true,
            outcome: true,
            direction: true,
            target_price: true,
            source: true,
            is_active: true,
            created_at: true,
        },
    });

    const watchlist = await prisma.polymarketWatchlist.findMany({
        where: { u_id: user.u_id },
        orderBy: { added_at: "desc" },
        take: 30,
        select: {
            watchlist_id: true,
            market_id: true,
            added_at: true,
        },
    });

    console.log(
        JSON.stringify(
            {
                found: true,
                user,
                alertCount: alerts.length,
                watchlistCount: watchlist.length,
                alerts,
                watchlist,
            },
            null,
            2,
        ),
    );
}

main()
    .catch((error) => {
        console.error("VERIFY_USER_POLYMARKET_ALERTS_FAILED", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
