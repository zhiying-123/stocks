// API Route: Update User Name
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const isLoggedIn = cookieStore.get("auth")?.value === "true";
        const userCookie = cookieStore.get("user")?.value;
        
        if (!isLoggedIn || !userCookie) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const user = JSON.parse(userCookie);
        const { name } = await request.json();

        if (!name || typeof name !== 'string' || !name.trim()) {
            return NextResponse.json(
                { error: "Invalid name" },
                { status: 400 }
            );
        }

        // Update user name in database
        const updatedUser = await prisma.user.update({
            where: { u_id: user.id },
            data: { name: name.trim() }
        });

        // Update cookie with new user data
        const updatedUserData = {
            id: updatedUser.u_id,
            email: updatedUser.email,
            name: updatedUser.name,
            role: updatedUser.role
        };

        const response = NextResponse.json({
            success: true,
            user: updatedUserData
        });

        response.cookies.set("user", JSON.stringify(updatedUserData), {
            httpOnly: false,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7, // 7 days
        });

        return response;

    } catch (error) {
        console.error("Update name error:", error);
        return NextResponse.json(
            { error: "Failed to update name" },
            { status: 500 }
        );
    }
}
