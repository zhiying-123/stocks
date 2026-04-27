import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sendDiscordMessage } from '@/lib/discord';

type ShareBacktestPayload = {
    title?: string;
    lines?: string[];
};

function extractLineValue(lines: string[], prefix: string) {
    const lowerPrefix = prefix.toLowerCase();
    const raw = lines.find((line) => line.toLowerCase().startsWith(lowerPrefix));
    if (!raw) return '';
    return raw.slice(prefix.length).trim();
}

function extractBulletValue(lines: string[], prefix: string) {
    const lowerPrefix = prefix.toLowerCase();
    const raw = lines.find((line) => line.toLowerCase().startsWith(lowerPrefix));
    if (!raw) return '';
    return raw.slice(prefix.length).trim();
}

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const userCookie = cookieStore.get('user')?.value;
        const user = userCookie ? JSON.parse(userCookie) as { id?: number; name?: string; email?: string } : null;

        if (!user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = (await request.json()) as ShareBacktestPayload;
        const title = String(body.title || '').trim();
        const lines = Array.isArray(body.lines)
            ? body.lines.map((line) => String(line || '').trim()).filter(Boolean)
            : [];

        if (!title) {
            return NextResponse.json({ error: 'title is required' }, { status: 400 });
        }

        if (lines.length === 0) {
            return NextResponse.json({ error: 'lines is required' }, { status: 400 });
        }

        const requesterLine = `Requested by: ${user.name || user.email || `User ${user.id}`}`;
        const generatedAt = extractLineValue(lines, 'Generated (UTC):');
        const market = extractLineValue(lines, 'Market:');
        const detailPage = extractLineValue(lines, 'Detail Page:');
        const window = extractBulletValue(lines, '- Window:');
        const setup = extractBulletValue(lines, '- Setup:');
        const netPnl = extractBulletValue(lines, '- Net PnL:');
        const finalEquity = extractBulletValue(lines, '- Final Equity:');
        const vsBuyHold = extractBulletValue(lines, '- Vs Buy & Hold:');
        const trades = extractBulletValue(lines, '- Trades:');
        const maxDrawdown = extractBulletValue(lines, '- Max Drawdown:');

        const descriptionParts = [
            generatedAt ? `Generated: ${generatedAt}` : '',
            market ? `Market: ${market}` : '',
            window ? `Window: ${window}` : '',
            setup ? `Setup: ${setup}` : '',
            detailPage && detailPage !== 'N/A' ? `[Open Detail Page](${detailPage})` : '',
        ].filter(Boolean);

        const fields: Array<{ name: string; value: string; inline?: boolean }> = [];
        if (netPnl) fields.push({ name: 'Net PnL', value: netPnl, inline: true });
        if (finalEquity) fields.push({ name: 'Final Equity', value: finalEquity, inline: true });
        if (vsBuyHold) fields.push({ name: 'Vs Buy & Hold', value: vsBuyHold, inline: true });
        if (trades) fields.push({ name: 'Trades', value: trades, inline: false });
        if (maxDrawdown) fields.push({ name: 'Max Drawdown', value: maxDrawdown, inline: true });

        const sent = await sendDiscordMessage({
            title,
            lines: [...lines.slice(0, 18), requesterLine],
            mention: true,
            embed: {
                title,
                url: detailPage && detailPage !== 'N/A' ? detailPage : undefined,
                description: descriptionParts.join('\n'),
                color: 0x22c55e,
                fields,
                footerText: requesterLine,
                timestamp: new Date().toISOString(),
            },
        });

        if (!sent) {
            return NextResponse.json({ error: 'Discord webhook is not configured (DISCORD_WEBHOOK_URL missing)' }, { status: 400 });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to share backtest report';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
