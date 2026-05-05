import { jwtVerify } from "jose";
import { NextRequest } from "next/server";

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "fallback-secret-change-me"
);

export type MobileUser = {
  email: string;
  name: string;
  role: string;
};

/**
 * Verifies the `Authorization: Bearer <token>` header from the mobile app.
 * Returns the decoded user payload or null if invalid/missing.
 */
export async function verifyMobileToken(req: NextRequest): Promise<MobileUser | null> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;

  const token = auth.slice(7).trim();
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (!payload.email || !payload.sub) return null;

    return {
      email: String(payload.email),
      name: String(payload.name ?? payload.email),
      role: String(payload.role ?? "viewer"),
    };
  } catch {
    return null;
  }
}

/**
 * Returns the authenticated user from either:
 * 1. NextAuth session (web)
 * 2. Mobile JWT Bearer token (native app)
 */
export async function getMobileOrSessionUser(
  req: NextRequest,
  sessionEmail: string | null | undefined
): Promise<{ email: string; role: string } | null> {
  if (sessionEmail) {
    return { email: sessionEmail, role: "user" };
  }
  return verifyMobileToken(req);
}
