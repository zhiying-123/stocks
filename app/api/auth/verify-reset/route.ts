import { NextResponse } from 'next/server';
import { verifyResetCode } from '@/lib/resetStore';

export async function POST(req: Request) {
    const { email, code } = await req.json();
    if (!email || !code) return NextResponse.json({ success: false, message: 'Email and code required' }, { status: 400 });

    const ok = verifyResetCode(email, code);
    if (!ok) return NextResponse.json({ success: false, message: 'Invalid or expired code' }, { status: 400 });

    return NextResponse.json({ success: true });
}
