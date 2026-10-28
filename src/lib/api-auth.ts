import { getServerSession } from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { verifyMobileToken } from "@/lib/mobile-auth";

export type ApiUser = { email: string; role: string };

/**
 * Resolves the caller from either the NextAuth web session or the native
 * app's Bearer JWT. Web session wins so existing behaviour is unchanged.
 */
export async function authenticateRequest(req: NextRequest): Promise<ApiUser | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    return { email: session.user.email, role: session.user.role ?? "member" };
  }
  const mobile = await verifyMobileToken(req);
  return mobile ? { email: mobile.email, role: mobile.role } : null;
}
