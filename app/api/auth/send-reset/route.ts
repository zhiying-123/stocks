import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { setResetCode } from '@/lib/resetStore';
import { sendEmail } from '@/lib/email';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
    const body = await req.json();
    const email = String(body?.email || '').trim().toLowerCase();

    if (!email) {
        return NextResponse.json({ success: false, message: 'Email is required' }, { status: 400 });
    }

    if (!EMAIL_REGEX.test(email)) {
        return NextResponse.json({ success: false, message: 'Please enter a valid email address' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Return generic success for privacy; only send email for existing users.
    if (!user) {
        return NextResponse.json({ success: true, message: 'If the account exists, a verification code has been sent.' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setResetCode(email, code, 15 * 60);

    try {
        await sendEmail({
            to: email,
            subject: 'H-Stocks password reset verification code',
            text: `Your verification code is ${code}. It expires in 15 minutes.`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #111827;">
                    <h2 style="margin-bottom: 8px;">Password Reset Verification</h2>
                    <p style="margin-top: 0; color: #4b5563;">Use this code to reset your H-Stocks password:</p>
                    <div style="font-size: 28px; letter-spacing: 6px; font-weight: 700; margin: 20px 0;">${code}</div>
                    <p style="color: #4b5563;">This code expires in 15 minutes.</p>
                    <p style="color: #6b7280; font-size: 12px;">If you did not request this, you can ignore this email.</p>
                </div>
            `,
        });

        return NextResponse.json({ success: true, message: 'Verification code sent to your Gmail.' });
    } catch (error) {
        console.error('[SEND_RESET_CODE_FAILED]', error);
        return NextResponse.json({ success: false, message: 'Failed to send verification code email. Check Gmail SMTP configuration.' }, { status: 500 });
    }
}
