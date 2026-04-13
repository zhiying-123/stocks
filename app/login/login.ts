//backend
// app/login/login.ts
"use server";

import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

type AuthUser = {
  u_id: number;
  email: string;
  name: string;
  role: string;
};

export async function createAuthSession(user: AuthUser) {
  const cookieStore = await cookies();

  cookieStore.set("auth", "true", {
    httpOnly: true,
    path: "/",
    maxAge: 3600,
    sameSite: "lax",
  });

  cookieStore.set(
    "user",
    JSON.stringify({
      id: user.u_id,
      email: user.email,
      name: user.name,
      role: user.role,
    }),
    {
      httpOnly: true,
      path: "/",
      maxAge: 3600,
      sameSite: "lax",
    }
  );
}

export async function loginRequest(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return { success: false, message: "User not found" };
  }

  if (user.status === "INACTIVE") {
    return { success: false, message: "Account inactive. Please use Forgot Password to recover your account." };
  }

  if (user.password !== password) {
    // increment access_time
    const current = user.access_time ?? 0;
    const next = current + 1;
    const updates: { access_time: number; status?: string } = { access_time: next };
    if (next >= 3) {
      updates.status = "INACTIVE";
    }

    await prisma.user.update({ where: { u_id: user.u_id }, data: updates });

    if (next >= 3) {
      return { success: false, message: "Account locked due to multiple failed attempts. Please use Forgot Password." };
    }

    return { success: false, message: `Wrong password. You have ${3 - next} attempts left.` };
  }

  // successful login: reset access_time and ensure status active
  await prisma.user.update({
    where: { u_id: user.u_id },
    data: { access_time: 0, status: "ACTIVE" },
  });

  await createAuthSession(user);

  return {
    success: true,
    user: {
      id: user.u_id,
      email: user.email,
      name: user.name,
      role: user.role,
    }
  };
}
