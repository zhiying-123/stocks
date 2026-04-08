import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sendDiscordMessage } from '@/lib/discord';

type ShareBacktestPayload = {
    title?: string;
    lines?: string[];
};

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
        const sent = await sendDiscordMessage({
            title,
            lines: [...lines.slice(0, 18), requesterLine],
            mention: false,
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
