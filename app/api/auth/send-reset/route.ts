import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { setResetCode } from '@/lib/resetStore';

// Note: install nodemailer in your project to enable real email sending:
// npm install nodemailer
let nodemailer: any;
try {
    // dynamically import so route still works if nodemailer isn't installed
    // during development the package may be absent and we'll fallback to console.log
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    nodemailer = require('nodemailer');
} catch (e) {
    nodemailer = null;
}


export async function POST(req: Request) {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ success: false, message: 'Email is required' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });

    // generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setResetCode(email, code, 15 * 60);

    // If nodemailer is installed and we have either SMTP_* envs or EMAIL_USER/EMAIL_PASS, try to send real email
    if (nodemailer && (process.env.SMTP_HOST || (process.env.EMAIL_USER && process.env.EMAIL_PASS) || process.env.SMTP_USER)) {
        try {
            const emailUser = process.env.EMAIL_USER;
            const emailPass = process.env.EMAIL_PASS;

            const host = process.env.SMTP_HOST || (emailUser && emailUser.endsWith('@gmail.com') ? 'smtp.gmail.com' : process.env.SMTP_HOST || 'smtp.gmail.com');
            const port = Number(process.env.SMTP_PORT) || 587;
            const secure = process.env.SMTP_SECURE === 'true';

            const auth = process.env.SMTP_USER
                ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
                : (emailUser && emailPass ? { user: emailUser, pass: emailPass } : undefined);

            const transporter = nodemailer.createTransport({ host, port, secure, auth });

            // verify connection / authentication before sending
            try {
                await transporter.verify();
            } catch (verifyErr: any) {
                console.error('SMTP verify failed:', verifyErr?.message ?? verifyErr);
                return NextResponse.json({ success: false, message: 'SMTP verify failed', detail: verifyErr?.message ?? String(verifyErr) }, { status: 500 });
            }

            const from = process.env.SMTP_FROM || (emailUser ? `${emailUser}` : 'no-reply@zyuniversity.local');
            const subject = 'ZY University — Password reset code';
            const text = `Your password reset code is: ${code}\n\nIf you didn't request this, ignore this email.`;

            try {
                await transporter.sendMail({ from, to: email, subject, text });
                return NextResponse.json({ success: true, message: 'Reset code sent to your email.' });
            } catch (sendErr: any) {
                console.error('Failed to send email via SMTP:', sendErr?.message ?? sendErr);
                return NextResponse.json({ success: false, message: 'Failed to send email via SMTP', detail: sendErr?.message ?? String(sendErr) }, { status: 500 });
            }
        } catch (err: any) {
            console.error('Unexpected error preparing SMTP transporter, falling back to console.log:', err?.message ?? err);
            // fall through to console.log fallback
        }
    }
    // If nodemailer is available but SMTP not configured, use Ethereal test account so developer can preview
    if (nodemailer) {
        try {
            // if SMTP not configured, create a test account
            if (!process.env.SMTP_HOST) {
                const testAccount = await nodemailer.createTestAccount();
                const transporter = nodemailer.createTransport({
                    host: testAccount.smtp.host,
                    port: testAccount.smtp.port,
                    secure: testAccount.smtp.secure,
                    auth: { user: testAccount.user, pass: testAccount.pass },
                });

                const from = process.env.SMTP_FROM || 'no-reply@zyuniversity.local';
                const subject = 'ZY University — Password reset code';
                const text = `Your password reset code is: ${code}\n\nIf you didn't request this, ignore this email.`;

                const info = await transporter.sendMail({ from, to: email, subject, text });
                const preview = nodemailer.getTestMessageUrl(info);
                console.log('Ethereal preview URL:', preview);
                return NextResponse.json({ success: true, message: 'Reset code sent (preview available)', previewUrl: preview });
            }
        } catch (err: any) {
            console.error('Ethereal fallback failed:', err?.message ?? err);
        }
    }

    // Final fallback: log code to server console for dev/testing
    console.log(`Password reset code for ${email}: ${code}`);

    return NextResponse.json({ success: true, message: 'Reset code sent (check server logs in dev)' });
}
