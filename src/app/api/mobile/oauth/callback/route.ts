import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { loadUsers } from "@/lib/users-store";
import { ADMIN_EMAIL } from "@/app/api/auth/[...nextauth]/route";

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "fallback-secret-change-me"
);
const CALLBACK_URL = "https://rmmedia-studio.vercel.app/api/mobile/oauth/callback";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect("rmstudio://auth?error=cancelled");
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: CALLBACK_URL,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json() as { access_token?: string; error?: string };
    if (!tokens.access_token) {
      console.error("[mobile/oauth/callback] Token exchange failed:", tokens);
      return NextResponse.redirect("rmstudio://auth?error=token_failed");
    }

    // Get user info from Google
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const googleUser = await userRes.json() as { email?: string; name?: string };

    if (!googleUser.email) {
      return NextResponse.redirect("rmstudio://auth?error=no_email");
    }

    const email = googleUser.email.toLowerCase().trim();

    // Check authorisation
    let role: "admin" | "member" = "member";
    let name = googleUser.name ?? email;

    if (email === ADMIN_EMAIL) {
      role = "admin";
      name = "Raunaq";
    } else {
      const users = await loadUsers();
      const found = users.find((u) => u.email === email);
      if (!found) {
        return NextResponse.redirect("rmstudio://auth?error=unauthorized");
      }
      name = found.name ?? email;
      role = found.role;
    }

    // Sign 90-day mobile JWT
    const mobileToken = await new SignJWT({ email, name, role, sub: email })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("90d")
      .sign(SECRET);

    // Deep-link back into the app with the token
    return NextResponse.redirect(
      `rmstudio://auth?token=${encodeURIComponent(mobileToken)}`
    );
  } catch (err) {
    console.error("[mobile/oauth/callback] error:", err);
    return NextResponse.redirect("rmstudio://auth?error=server_error");
  }
}
