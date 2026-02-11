import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyResetCode } from '@/lib/resetStore';

export async function POST(req: Request) {
    const { email, code, newPassword, confirmPassword } = await req.json();
    if (!email || !code || !newPassword || !confirmPassword) {
        return NextResponse.json({ success: false, message: 'Missing fields' }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
        return NextResponse.json({ success: false, message: 'Passwords do not match' }, { status: 400 });
    }

    // verify code
    const ok = verifyResetCode(email, code);
    if (!ok) return NextResponse.json({ success: false, message: 'Invalid or expired code' }, { status: 400 });

    // password rules for reset: must be >=8 chars and include letters and numbers
    const hasLetter = /[A-Za-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    if (newPassword.length < 8 || !hasLetter || !hasNumber) {
        return NextResponse.json({ success: false, message: 'Password must be at least 8 characters and include letters and numbers' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });

    await prisma.user.update({
        where: { u_id: user.u_id },
        data: { password: newPassword, access_time: 0, status: 'ACTIVE' },
    });

    return NextResponse.json({ success: true, message: 'Password reset successful' });
}
