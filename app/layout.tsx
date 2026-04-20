// Trading Platform Root Layout
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import MainNav from "./components/MainNav";
import { cookies } from "next/headers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trading Platform - Stocks & Predictions",
  description: "Trade stocks and prediction markets in one unified platform",
};

async function getAuthState() {
  const cookieStore = await cookies();
  const isLoggedIn = cookieStore.get("auth")?.value === "true";
  const userCookie = cookieStore.get("user")?.value;
  const user = userCookie ? JSON.parse(userCookie) : null;
  return { isLoggedIn, user };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { isLoggedIn, user } = await getAuthState();
  const userName = isLoggedIn && user ? (user.name || user.email) : undefined;
  const role = String(user?.role || "").toLowerCase();
  const isStaff = role === "staff" || role === "admin";

  return (
    <html lang="en" className="overflow-x-hidden">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 overflow-x-hidden`}
      >
        {isLoggedIn && !isStaff && <MainNav userName={userName} />}
        <main className={`${isLoggedIn ? "p-6" : ""}`}>
          {children}
        </main>
      </body>
    </html>
  );
}
