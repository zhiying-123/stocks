type SendEmailInput = {
    to: string;
    subject: string;
    text: string;
    html?: string;
};

let nodemailerModule: any = null;

function getNodemailer() {
    if (nodemailerModule) return nodemailerModule;

    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        nodemailerModule = require('nodemailer');
        return nodemailerModule;
    } catch {
        return null;
    }
}

export async function sendEmail({ to, subject, text, html }: SendEmailInput) {
    const nodemailer = getNodemailer();
    if (!nodemailer) {
        throw new Error('nodemailer is not installed');
    }

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    const host = process.env.SMTP_HOST || (emailUser && emailUser.endsWith('@gmail.com') ? 'smtp.gmail.com' : 'smtp.gmail.com');
    const port = Number(process.env.SMTP_PORT) || 587;
    const secure = process.env.SMTP_SECURE === 'true';

    const auth = process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : (emailUser && emailPass ? { user: emailUser, pass: emailPass } : undefined);

    if (!auth?.user || !auth?.pass) {
        throw new Error('Email SMTP credentials are missing');
    }

    const transporter = nodemailer.createTransport({ host, port, secure, auth });
    const from = process.env.SMTP_FROM || emailUser || auth.user;

    await transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
    });
}
