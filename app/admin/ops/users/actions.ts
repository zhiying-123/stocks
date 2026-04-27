"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Role = "member" | "staff" | "admin";
type Status = "ACTIVE" | "INACTIVE" | "PENDING" | "LOCKED";

const ALLOWED_STATUSES: Status[] = ["ACTIVE", "INACTIVE", "PENDING", "LOCKED"];

function normalizeRole(input: string): Role | null {
  const role = input.trim().toLowerCase();
  if (role === "member" || role === "staff" || role === "admin") return role;
  return null;
}

function normalizeStatus(input: string): Status | null {
  const status = input.trim().toUpperCase() as Status;
  if (ALLOWED_STATUSES.includes(status)) return status;
  return null;
}

function getRedirectUrl(op: "success" | "error", note: string) {
  return `/admin/ops/users?op=${encodeURIComponent(op)}&note=${encodeURIComponent(note)}`;
}

function getReturnBase(formData: FormData) {
  const returnPath = String(formData.get("returnPath") || "").trim();
  if (!returnPath.startsWith("/admin/ops/users")) {
    return "/admin/ops/users";
  }
  return returnPath;
}

function getReturnUrl(formData: FormData, op: "success" | "error", note: string) {
  const base = getReturnBase(formData);
  const url = new URL(base, "http://localhost");
  url.searchParams.set("op", op);
  url.searchParams.set("note", note);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

async function assertStaffAccess() {
  const cookieStore = await cookies();
  const isLoggedIn = cookieStore.get("auth")?.value === "true";
  const userCookie = cookieStore.get("user")?.value;

  if (!isLoggedIn || !userCookie) {
    redirect("/login");
  }

  let sessionUser: { id?: number | string; role?: string } | null = null;
  try {
    sessionUser = JSON.parse(userCookie);
  } catch {
    redirect("/login");
  }

  const role = String(sessionUser?.role || "").toLowerCase();
  if (role !== "staff" && role !== "admin") {
    redirect("/");
  }

  return {
    id: Number(sessionUser?.id || 0),
    role,
  };
}

export async function createManagedUserAction(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const userEmail = String(formData.get("userEmail") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const roleRaw = String(formData.get("role") || "member");
  const notifyTarget = String(formData.get("notifyTarget") || "login").trim().toLowerCase();
  const customNotifyEmail = String(formData.get("customNotifyEmail") || "").trim().toLowerCase();

  if (!name || !userEmail || !password) {
    redirect(getRedirectUrl("error", "Please fill in name, user email, and password."));
  }

  if (!EMAIL_REGEX.test(userEmail)) {
    redirect(getRedirectUrl("error", "Please enter a valid user email address."));
  }

  if (password.length < 6) {
    redirect(getRedirectUrl("error", "Password must be at least 6 characters."));
  }

  const role = normalizeRole(roleRaw);
  if (!role) {
    redirect(getRedirectUrl("error", "Role must be member or staff."));
  }

  const existing = await prisma.user.findUnique({ where: { email: userEmail } });
  if (existing) {
    redirect(getRedirectUrl("error", "This email is already registered."));
  }

  const created = await prisma.user.create({
    data: {
      name,
      email: userEmail,
      password,
      role,
      status: "ACTIVE",
      access_time: 0,
    },
  });

  let notifyEmail = "";
  if (notifyTarget === "custom") {
    notifyEmail = customNotifyEmail;
  } else {
    const cookieStore = await cookies();
    const rawUser = cookieStore.get("user")?.value;
    if (rawUser) {
      try {
        const parsed = JSON.parse(rawUser) as { email?: string };
        notifyEmail = String(parsed.email || "").trim().toLowerCase();
      } catch {
        notifyEmail = "";
      }
    }
  }

  if (!notifyEmail || !EMAIL_REGEX.test(notifyEmail)) {
    redirect(getRedirectUrl("error", "User created, but notification email is invalid. Choose another email target."));
  }

  try {
    await sendEmail({
      to: notifyEmail,
      subject: `New ${role.toUpperCase()} account created`,
      text: `A new account has been created.\n\nName: ${created.name}\nEmail: ${created.email}\nRole: ${String(created.role).toUpperCase()}\nPassword: ${password}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #111827;">
          <h2 style="margin-bottom: 8px;">New Account Created</h2>
          <p style="margin-top: 0; color: #4b5563;">A user account has been created from Staff Console.</p>
          <table style="border-collapse: collapse; margin-top: 12px;">
            <tr><td style="padding: 4px 10px 4px 0; color: #6b7280;">Name</td><td style="padding: 4px 0; font-weight: 600;">${created.name}</td></tr>
            <tr><td style="padding: 4px 10px 4px 0; color: #6b7280;">Email</td><td style="padding: 4px 0; font-weight: 600;">${created.email}</td></tr>
            <tr><td style="padding: 4px 10px 4px 0; color: #6b7280;">Role</td><td style="padding: 4px 0; font-weight: 600;">${String(created.role).toUpperCase()}</td></tr>
            <tr><td style="padding: 4px 10px 4px 0; color: #6b7280;">Password</td><td style="padding: 4px 0; font-weight: 600;">${password}</td></tr>
          </table>
        </div>
      `,
    });
  } catch (error) {
    console.error("[ADMIN_CREATE_USER_EMAIL_FAILED]", error);
    redirect(getRedirectUrl("error", `User created, but failed to send email to ${notifyEmail}. Check SMTP config.`));
  }

  redirect(getRedirectUrl("success", `User ${created.email} created and email sent to ${notifyEmail}.`));
}

export async function updateManagedUserStatusAction(formData: FormData) {
  await assertStaffAccess();

  const userId = Number(formData.get("userId") || 0);
  const statusRaw = String(formData.get("status") || "");
  const status = normalizeStatus(statusRaw);

  if (!userId || !status) {
    redirect(getReturnUrl(formData, "error", "Invalid user ID or status."));
  }

  const existing = await prisma.user.findUnique({ where: { u_id: userId } });
  if (!existing) {
    redirect(getReturnUrl(formData, "error", "User not found."));
  }

  await prisma.user.update({
    where: { u_id: userId },
    data: { status },
  });

  redirect(getReturnUrl(formData, "success", `Status updated for ${existing.email}.`));
}

export async function editManagedUserDetailAction(formData: FormData) {
  await assertStaffAccess();

  const userId = Number(formData.get("userId") || 0);
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const roleRaw = String(formData.get("role") || "");
  const role = normalizeRole(roleRaw);

  if (!userId || !name || !email || !role) {
    redirect(getReturnUrl(formData, "error", "Please provide valid name, email, and role."));
  }

  if (!EMAIL_REGEX.test(email)) {
    redirect(getReturnUrl(formData, "error", "Please provide a valid email."));
  }

  const existing = await prisma.user.findUnique({ where: { u_id: userId } });
  if (!existing) {
    redirect(getReturnUrl(formData, "error", "User not found."));
  }

  const duplicate = await prisma.user.findFirst({
    where: {
      email,
      NOT: { u_id: userId },
    },
    select: { u_id: true },
  });

  if (duplicate) {
    redirect(getReturnUrl(formData, "error", "That email is already in use by another account."));
  }

  await prisma.user.update({
    where: { u_id: userId },
    data: {
      name,
      email,
      role,
    },
  });

  redirect(getReturnUrl(formData, "success", `Updated profile for ${email}.`));
}

export async function deleteManagedUserAction(formData: FormData) {
  const session = await assertStaffAccess();

  const userId = Number(formData.get("userId") || 0);
  if (!userId) {
    redirect(getReturnUrl(formData, "error", "Invalid user ID."));
  }

  if (session.id && session.id === userId) {
    redirect(getReturnUrl(formData, "error", "You cannot delete your own account."));
  }

  const existing = await prisma.user.findUnique({
    where: { u_id: userId },
    select: { email: true },
  });

  if (!existing) {
    redirect(getReturnUrl(formData, "error", "User not found."));
  }

  await prisma.$transaction([
    prisma.walletTransaction.deleteMany({ where: { u_id: userId } }),
    prisma.stockAutoTrader.deleteMany({ where: { u_id: userId } }),
    prisma.stockHolding.deleteMany({ where: { u_id: userId } }),
    prisma.stockTransaction.deleteMany({ where: { u_id: userId } }),
    prisma.stockWatchlist.deleteMany({ where: { u_id: userId } }),
    prisma.userWallet.deleteMany({ where: { u_id: userId } }),
    prisma.polymarketHolding.deleteMany({ where: { u_id: userId } }),
    prisma.polymarketTransaction.deleteMany({ where: { u_id: userId } }),
    prisma.polymarketWatchlist.deleteMany({ where: { u_id: userId } }),
    prisma.polymarketComment.deleteMany({ where: { u_id: userId } }),
    prisma.polymarketPriceAlert.deleteMany({ where: { u_id: userId } }),
    prisma.polymarketMarketGroup.updateMany({
      where: { created_by_u_id: userId },
      data: { created_by_u_id: null },
    }),
    prisma.user.delete({ where: { u_id: userId } }),
  ]);

  redirect(getReturnUrl(formData, "success", `Deleted user ${existing.email}.`));
}
