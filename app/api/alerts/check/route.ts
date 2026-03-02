import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { fetchStockQuote } from "@/app/h_stocks/stocks/stock";
import nodemailer from "nodemailer";

// Email configuration
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT || "587"),
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

async function sendAlertEmail(userEmail: string, userName: string, alert: any, currentPrice: number) {
    try {
        let message = "";
        if (alert.alert_type === "TARGET_PRICE") {
            message = `${alert.symbol} has ${alert.condition === "ABOVE" ? "risen above" : "fallen below"} your target price of $${alert.target_price}. Current price: $${currentPrice}`;
        } else {
            const changePercent = alert.percentage_change;
            message = `${alert.symbol} has changed by ${alert.condition === "ABOVE" ? "more than +" : "more than -"}${changePercent}%. Current price: $${currentPrice}`;
        }

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: userEmail,
            subject: `🔔 Price Alert Triggered: ${alert.symbol}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #1f2937;">Price Alert Triggered</h2>
                    <p>Hi ${userName},</p>
                    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #059669;">${alert.symbol}</h3>
                        <p style="font-size: 16px; color: #374151;">${message}</p>
                        <p style="font-size: 14px; color: #6b7280; margin-bottom: 0;">
                            Alert created at: $${alert.reference_price}
                        </p>
                    </div>
                    <p style="color: #6b7280; font-size: 14px;">
                        This is an automated notification from H-Stocks Platform.
                    </p>
                </div>
            `,
        });
    } catch (error) {
        console.error("Failed to send alert email:", error);
    }
}

// POST - Check all active alerts and trigger if conditions met
export async function POST(req: NextRequest) {
    try {
        // Optional: Add authentication or cron secret to prevent unauthorized access
        const authHeader = req.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET || "your-secret-key";
        
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch all active, non-triggered alerts
        const activeAlerts = await prisma.priceAlert.findMany({
            where: {
                is_active: true,
                is_triggered: false,
            },
        });

        if (activeAlerts.length === 0) {
            return NextResponse.json({ message: "No active alerts to check" });
        }

        // Group alerts by symbol to minimize API calls
        const symbolGroups = new Map<string, any[]>();
        activeAlerts.forEach(alert => {
            const existing = symbolGroups.get(alert.symbol) || [];
            existing.push(alert);
            symbolGroups.set(alert.symbol, existing);
        });

        const triggeredAlerts: any[] = [];
        const errors: any[] = [];

        // Check each symbol's alerts
        for (const [symbol, alerts] of symbolGroups.entries()) {
            try {
                const quote = await fetchStockQuote(symbol);
                const currentPrice = quote?.c;

                if (!currentPrice) {
                    errors.push({ symbol, error: "Failed to fetch price" });
                    continue;
                }

                // Check each alert for this symbol
                for (const alert of alerts) {
                    let shouldTrigger = false;

                    if (alert.alert_type === "TARGET_PRICE" && alert.target_price) {
                        if (alert.condition === "ABOVE" && currentPrice >= alert.target_price) {
                            shouldTrigger = true;
                        } else if (alert.condition === "BELOW" && currentPrice <= alert.target_price) {
                            shouldTrigger = true;
                        }
                    } else if (alert.alert_type === "PERCENTAGE_CHANGE" && alert.reference_price && alert.percentage_change) {
                        const changePercent = ((currentPrice - alert.reference_price) / alert.reference_price) * 100;
                        
                        if (alert.condition === "ABOVE" && changePercent >= alert.percentage_change) {
                            shouldTrigger = true;
                        } else if (alert.condition === "BELOW" && changePercent <= -alert.percentage_change) {
                            shouldTrigger = true;
                        }
                    }

                    if (shouldTrigger) {
                        // Update alert as triggered
                        await prisma.priceAlert.update({
                            where: { alert_id: alert.alert_id },
                            data: {
                                is_triggered: true,
                                triggered_at: new Date(),
                                triggered_price: currentPrice,
                            },
                        });

                        // Get user email for notification
                        const user = await prisma.user.findUnique({
                            where: { u_id: alert.u_id },
                        });

                        if (user?.email) {
                            await sendAlertEmail(user.email, user.name, alert, currentPrice);
                            
                            // Mark as notified
                            await prisma.priceAlert.update({
                                where: { alert_id: alert.alert_id },
                                data: { notified: true },
                            });
                        }

                        triggeredAlerts.push({
                            alert_id: alert.alert_id,
                            symbol: alert.symbol,
                            currentPrice,
                        });
                    }
                }
            } catch (error) {
                console.error(`Error checking alerts for ${symbol}:`, error);
                errors.push({ symbol, error: String(error) });
            }
        }

        return NextResponse.json({
            success: true,
            checkedAlerts: activeAlerts.length,
            triggeredAlerts: triggeredAlerts.length,
            triggered: triggeredAlerts,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error) {
        console.error("Check alerts error:", error);
        return NextResponse.json({ error: "Failed to check alerts" }, { status: 500 });
    }
}
