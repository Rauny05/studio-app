import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { loadUsers } from "@/lib/users-store";
import { ADMIN_EMAIL } from "@/app/api/auth/[...nextauth]/route";

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "fallback-secret-change-me"
);

// Token valid for 90 days — long-lived for a personal native app
const EXPIRY = "90d";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { passcode, email } = body as { passcode?: string; email?: string };

    if (!passcode) {
      return NextResponse.json({ error: "Passcode required" }, { status: 400 });
    }

    const expectedCode = process.env.APP_ACCESS_CODE;
    if (!expectedCode) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    if (passcode.trim() !== expectedCode.trim()) {
      return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
    }

    // Determine user info
    let userEmail = email?.toLowerCase().trim() ?? ADMIN_EMAIL;
    let userName = "RM Studio User";
    let role = "viewer";

    if (userEmail === ADMIN_EMAIL) {
      userName = "Raunaq";
      role = "admin";
    } else {
      const users = await loadUsers();
      const found = users.find((u) => u.email === userEmail);
      if (found) {
        userName = found.name ?? userEmail;
      } else {
        // Anonymous passcode user — use the admin identity for personal use
        userEmail = ADMIN_EMAIL;
        userName = "Raunaq";
        role = "admin";
      }
    }

    // Sign a JWT
    const token = await new SignJWT({
      email: userEmail,
      name: userName,
      role,
      sub: userEmail,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(EXPIRY)
      .sign(SECRET);

    return NextResponse.json({
      token,
      user: { name: userName, email: userEmail, role },
    });
  } catch (err) {
    console.error("[mobile/auth] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
