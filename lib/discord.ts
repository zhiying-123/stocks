type SendDiscordAlertInput = {
    question: string;
    conditionText: string;
    currentYesPercent: string;
    userName?: string | null;
    userEmail?: string | null;
};

export async function sendDiscordAlert({
    question,
    conditionText,
    currentYesPercent,
    userName,
    userEmail,
}: SendDiscordAlertInput) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
        return false;
    }

    const mention = process.env.DISCORD_MENTION || "";
    const reachedText = `Reached: YES is now ${currentYesPercent}%`;
    const userLabel = userName || userEmail ? `\n👤 User: ${userName || "Unknown"}${userEmail ? ` (${userEmail})` : ""}` : "";

    const content = [
        mention,
        "🔔 **Polymarket Price Alert Triggered**",
        `📌 Market: ${question}`,
        `🎯 Your condition: ${conditionText}`,
        `✅ ${reachedText}`,
        userLabel,
    ].filter(Boolean).join("\n");

    const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Discord webhook failed: ${response.status} ${errorText}`);
    }

    return true;
}
