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
    embed?: {
        title?: string;
        url?: string;
        description?: string;
        color?: number;
        fields?: Array<{ name: string; value: string; inline?: boolean }>;
        footerText?: string;
        timestamp?: string;
    };
};

type DiscordWebhookPayload = {
    content?: string;
    embeds?: Array<{
        title?: string;
        url?: string;
        description?: string;
        color?: number;
        fields?: Array<{ name: string; value: string; inline?: boolean }>;
        footer?: { text: string };
        timestamp?: string;
    }>;
};

export async function sendDiscordPayload(payload: DiscordWebhookPayload) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
        return false;
    }

    const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Discord webhook failed: ${response.status} ${errorText}`);
    }

    return true;
}

export async function sendDiscordMessage({ title, lines, mention = true, embed }: SendDiscordMessageInput) {
    const mentionText = mention ? process.env.DISCORD_MENTION || "" : "";

    if (embed) {
        const webhookEmbed = {
            title: embed.title || title,
            url: embed.url,
            description: embed.description,
            color: embed.color,
            fields: embed.fields,
            footer: embed.footerText ? { text: embed.footerText } : undefined,
            timestamp: embed.timestamp,
        };

        return sendDiscordPayload({
            content: mentionText || undefined,
            embeds: [webhookEmbed],
        });
    }

    const content = [mentionText, title, ...lines].filter(Boolean).join("\n");
    return sendDiscordPayload({ content });
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

    return sendDiscordPayload({ content });
}
