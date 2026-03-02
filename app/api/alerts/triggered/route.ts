import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET - Fetch recently triggered alerts that user hasn't seen yet
export async function GET(req: NextRequest) {
    try {
        const userCookie = req.cookies.get("user")?.value;
        if (!userCookie) {
            return NextResponse.json({ alerts: [] });
        }
        const user = JSON.parse(userCookie);

        // Get alerts triggered in the last 24 hours that user hasn't dismissed
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const triggeredAlerts = await prisma.priceAlert.findMany({
            where: {
                u_id: user.id,
                is_triggered: true,
                triggered_at: {
                    gte: twentyFourHoursAgo,
                },
            },
            orderBy: {
                triggered_at: 'desc',
            },
            take: 10, // Limit to 10 most recent
        });

        // Format alerts for display
        const formattedAlerts = triggeredAlerts.map(alert => {
            let message = "";
            if (alert.alert_type === "TARGET_PRICE") {
                message = `${alert.condition === "ABOVE" ? "Rose above" : "Fell below"} $${alert.target_price}`;
            } else {
                message = `Changed by ${alert.condition === "ABOVE" ? "+" : "-"}${alert.percentage_change}%`;
            }

            return {
                alert_id: alert.alert_id,
                symbol: alert.symbol,
                message,
                triggered_at: alert.triggered_at?.toISOString(),
                triggered_price: alert.triggered_price || 0,
            };
        });

        return NextResponse.json({ alerts: formattedAlerts });
    } catch (error) {
        console.error("Fetch triggered alerts error:", error);
        return NextResponse.json({ alerts: [] });
    }
}
