import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function parseUserCookie(raw: string | undefined) {
    if (!raw) return null;
    try {
        return JSON.parse(raw) as { role?: string };
    } catch {
        return null;
    }
}

export function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    // Skip Next internals and static assets.
    if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/api") ||
        pathname === "/favicon.ico" ||
        pathname.includes(".")
    ) {
        return NextResponse.next();
    }

    const isLoggedIn = request.cookies.get("auth")?.value === "true";
    const user = parseUserCookie(request.cookies.get("user")?.value);
    const role = String(user?.role || "").toLowerCase();
    const isStaff = role === "staff" || role === "admin";

    if (!isLoggedIn) {
        return NextResponse.next();
    }

    if (isStaff) {
        const staffAllowedPaths = pathname.startsWith("/admin") || pathname.startsWith("/logout");
        if (!staffAllowedPaths) {
            return NextResponse.redirect(new URL("/admin/ops", request.url));
        }
        return NextResponse.next();
    }

    // Members should not access staff pages.
    if (pathname.startsWith("/admin")) {
        return NextResponse.redirect(new URL("/h_stocks", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/:path*"],
};
