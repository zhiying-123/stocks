"use server";

import prisma from "@/lib/prisma";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Role = "member" | "staff";

function normalizeRole(input?: string): Role | null {
  if (!input) return "member";
  const normalized = input.trim().toLowerCase();
  if (normalized === "member" || normalized === "staff") {
    return normalized;
  }
  return null;
}

export async function registerRequest(
  name: string,
  email: string,
  password: string,
  confirmPassword: string,
  requestedRole?: string
) {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  const role = normalizeRole(requestedRole);

  if (!cleanName || !cleanEmail || !password || !confirmPassword) {
    return { success: false, message: "Please fill in all fields." };
  }

  if (!EMAIL_REGEX.test(cleanEmail)) {
    return { success: false, message: "Please enter a valid email address." };
  }

  if (cleanName.length < 2) {
    return { success: false, message: "Name must be at least 2 characters." };
  }

  if (password.length < 6) {
    return { success: false, message: "Password must be at least 6 characters." };
  }

  if (password !== confirmPassword) {
    return { success: false, message: "Passwords do not match." };
  }

  if (!role) {
    return { success: false, message: "Invalid role. Supported roles are member and staff." };
  }

  if (role === "staff") {
    return { success: false, message: "Staff registration is not available yet. Please register as member first." };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: cleanEmail },
  });

  if (existingUser) {
    if (existingUser.status === "INACTIVE") {
      return {
        success: false,
        message: "Account inactive. Please use Forgot Password to recover your account.",
      };
    }

    return { success: false, message: "Email already registered. Please sign in." };
  }

  await prisma.user.create({
    data: {
      name: cleanName,
      email: cleanEmail,
      password,
      role: "member",
      status: "ACTIVE",
      access_time: 0,
    },
  });

  return {
    success: true,
    message: "Account created successfully. Redirecting to Sign In...",
  };
}
