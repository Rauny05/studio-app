import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { dataGet, dataSet } from "@/lib/data-store";

/**
 * Stores APNs device tokens for the native iOS app.
 * Delivery is NOT implemented here: it needs an Apple Push key (.p8), Key ID
 * and Team ID configured server-side. See ios/README.md.
 */
const KEY = "studio:apns-tokens";
type Tokens = Record<string, { token: string; env: "sandbox" | "production"; updatedAt: string }[]>;

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token, env } = (await req.json()) as { token?: string; env?: string };
  if (!token || !/^[0-9a-fA-F]{32,200}$/.test(token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }
  const environment = env === "production" ? "production" : "sandbox";

  const all = (await dataGet<Tokens>(KEY)) ?? {};
  const mine = (all[user.email] ?? []).filter((t) => t.token !== token);
  mine.push({ token, env: environment, updatedAt: new Date().toISOString() });
  all[user.email] = mine.slice(-5); // cap devices per user
  await dataSet(KEY, all);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = req.nextUrl.searchParams.get("token");
  const all = (await dataGet<Tokens>(KEY)) ?? {};
  all[user.email] = (all[user.email] ?? []).filter((t) => t.token !== token);
  await dataSet(KEY, all);
  return NextResponse.json({ ok: true });
}
