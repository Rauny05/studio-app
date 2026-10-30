import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/** Returns the signed-in email or a 401 response. Every /api/cc handler goes through this. */
export async function requireUser(): Promise<{ email: string } | NextResponse> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return { email };
}

export function isResponse(x: unknown): x is NextResponse {
  return x instanceof NextResponse;
}
