import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { fetchStockQuote } from "@/app/h_stocks/stocks/stock";

// GET - Fetch user's alerts
export async function GET(req: NextRequest) {
    try {
        const userCookie = req.cookies.get("user")?.value;
        if (!userCookie) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }
        const user = JSON.parse(userCookie);

        const alerts = await prisma.priceAlert.findMany({
            where: { u_id: user.id },
            orderBy: [
                { is_active: 'desc' },
                { created_at: 'desc' }
            ],
        });

        return NextResponse.json({ alerts });
    } catch (error) {
        console.error("Fetch alerts error:", error);
        return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
    }
}

// POST - Create new alert
export async function POST(req: NextRequest) {
    try {
        const userCookie = req.cookies.get("user")?.value;
        if (!userCookie) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }
        const user = JSON.parse(userCookie);

        const { symbol, alertType, condition, targetPrice, percentageChange } = await req.json();

        // Validation
        if (!symbol || !alertType || !condition) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        if (alertType === "TARGET_PRICE" && (!targetPrice || targetPrice <= 0)) {
            return NextResponse.json({ error: "Invalid target price" }, { status: 400 });
        }

        if (alertType === "PERCENTAGE_CHANGE" && (!percentageChange || percentageChange <= 0)) {
            return NextResponse.json({ error: "Invalid percentage change" }, { status: 400 });
        }

        // Get current price for reference
        const quote = await fetchStockQuote(symbol);
        const currentPrice = quote?.c;

        if (!currentPrice) {
            return NextResponse.json({ error: "Unable to fetch current stock price" }, { status: 400 });
        }

        // Create alert
        const alert = await prisma.priceAlert.create({
            data: {
                u_id: user.id,
                symbol: symbol.toUpperCase(),
                alert_type: alertType,
                condition,
                target_price: alertType === "TARGET_PRICE" ? targetPrice : null,
                percentage_change: alertType === "PERCENTAGE_CHANGE" ? percentageChange : null,
                reference_price: currentPrice,
                is_active: true,
                is_triggered: false,
                notified: false,
            },
        });

        return NextResponse.json({ success: true, alert });
    } catch (error) {
        console.error("Create alert error:", error);
        return NextResponse.json({ error: "Failed to create alert" }, { status: 500 });
    }
}

// DELETE - Delete an alert
export async function DELETE(req: NextRequest) {
    try {
        const userCookie = req.cookies.get("user")?.value;
        if (!userCookie) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }
        const user = JSON.parse(userCookie);

        const { searchParams } = new URL(req.url);
        const alertId = searchParams.get("alertId");

        if (!alertId) {
            return NextResponse.json({ error: "Alert ID required" }, { status: 400 });
        }

        // Verify ownership before deleting
        const alert = await prisma.priceAlert.findUnique({
            where: { alert_id: parseInt(alertId) },
        });

        if (!alert || alert.u_id !== user.id) {
            return NextResponse.json({ error: "Alert not found or unauthorized" }, { status: 404 });
        }

        await prisma.priceAlert.delete({
            where: { alert_id: parseInt(alertId) },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete alert error:", error);
        return NextResponse.json({ error: "Failed to delete alert" }, { status: 500 });
    }
}

// PATCH - Update alert status (activate/deactivate)
export async function PATCH(req: NextRequest) {
    try {
        const userCookie = req.cookies.get("user")?.value;
        if (!userCookie) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }
        const user = JSON.parse(userCookie);

        const { alertId, isActive } = await req.json();

        if (!alertId || typeof isActive !== "boolean") {
            return NextResponse.json({ error: "Invalid request" }, { status: 400 });
        }

        // Verify ownership
        const alert = await prisma.priceAlert.findUnique({
            where: { alert_id: alertId },
        });

        if (!alert || alert.u_id !== user.id) {
            return NextResponse.json({ error: "Alert not found or unauthorized" }, { status: 404 });
        }

        // Update status
        const updatedAlert = await prisma.priceAlert.update({
            where: { alert_id: alertId },
            data: { is_active: isActive },
        });

        return NextResponse.json({ success: true, alert: updatedAlert });
    } catch (error) {
        console.error("Update alert error:", error);
        return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
    }
}
