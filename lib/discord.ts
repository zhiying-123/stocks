type SendDiscordAlertInput = {
    question: string;
    conditionText: string;
    currentYesPercent: string;
    userName?: string | null;
    userEmail?: string | null;
};

type SendDiscordMessageInput = {
    title: string;
    lines: string[];
    mention?: boolean;
};

async function sendDiscordContent(content: string) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
        return false;
    }

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

export async function sendDiscordMessage({ title, lines, mention = true }: SendDiscordMessageInput) {
    const mentionText = mention ? process.env.DISCORD_MENTION || "" : "";
    const content = [mentionText, title, ...lines].filter(Boolean).join("\n");
    return sendDiscordContent(content);
}

export async function sendDiscordAlert({
    question,
    conditionText,
    currentYesPercent,
    userName,
    userEmail,
}: SendDiscordAlertInput) {
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

    return sendDiscordContent(content);
}
