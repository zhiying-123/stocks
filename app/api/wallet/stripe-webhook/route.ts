// Stripe Webhook Handler
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";

function getStripe() {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    return new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2026-01-28.clover",
    });
}

// This is your Stripe webhook secret (you'll need to add this to .env after setting up webhook in Stripe dashboard)
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

export async function POST(req: NextRequest) {
    try {
        const body = await req.text();
        const signature = req.headers.get("stripe-signature");

        if (!signature) {
            return NextResponse.json({ error: "No signature" }, { status: 400 });
        }

        let event: Stripe.Event;

        try {
            // Verify webhook signature
            const stripe = getStripe();
            event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        } catch (err: any) {
            console.error("[WEBHOOK SIGNATURE ERROR]", err.message);
            return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
        }

        // Handle the event
        if (event.type === "checkout.session.completed") {
            const session = event.data.object as Stripe.Checkout.Session;
            const metadata = session.metadata;

            if (metadata && metadata.type === "topup") {
                const userId = parseInt(metadata.userId);
                const amount = parseFloat(metadata.amount);
                const currency = metadata.currency;

                console.log("[STRIPE WEBHOOK] Processing top-up:", { userId, amount, currency });

                // Update wallet balance
                const wallet = await prisma.userWallet.findUnique({
                    where: { u_id: userId },
                });

                if (wallet) {
                    await prisma.userWallet.update({
                        where: { u_id: userId },
                        data: {
                            balance: {
                                increment: amount,
                            },
                            updated_at: new Date(),
                        },
                    });

                    console.log("[STRIPE WEBHOOK] Wallet updated successfully");
                } else {
                    console.error("[STRIPE WEBHOOK] Wallet not found for user:", userId);
                }
            } else if (metadata && metadata.type === "withdrawal") {
                // Handle withdrawal (payout) confirmation
                const userId = parseInt(metadata.userId);
                const amount = parseFloat(metadata.amount);

                console.log("[STRIPE WEBHOOK] Processing withdrawal:", { userId, amount });

                // Wallet balance was already deducted when withdrawal was initiated
                // This is just confirmation that the payout was successful
            }
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("[STRIPE WEBHOOK ERROR]", error);
        return NextResponse.json(
            { error: "Webhook handler failed" },
            { status: 500 }
        );
    }
}
