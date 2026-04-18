import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const REDIS_URL = () => process.env.UPSTASH_REDIS_REST_URL!;
const REDIS_TOKEN = () => process.env.UPSTASH_REDIS_REST_TOKEN!;
const TOKENS_KEY = "studio:push-tokens";

async function getTokens(): Promise<Record<string, string>> {
  const res = await fetch(`${REDIS_URL()}/get/${TOKENS_KEY}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN()}` },
    cache: "no-store",
  });
  const json = await res.json() as { result: unknown };
  if (!json.result) return {};
  let v: unknown = json.result;
  while (typeof v === "string") { try { v = JSON.parse(v); } catch { break; } }
  return (typeof v === "object" && v !== null ? v : {}) as Record<string, string>;
}

async function saveTokens(tokens: Record<string, string>) {
  await fetch(`${REDIS_URL()}/set/${TOKENS_KEY}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN()}`, "Content-Type": "application/json" },
    body: JSON.stringify(tokens),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await req.json() as { token: string };
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const tokens = await getTokens();
  tokens[session.user.email] = token;
  await saveTokens(tokens);

  return NextResponse.json({ ok: true });
}

export async function GET() {
  // Returns all tokens (admin use — for sending notifications)
  const tokens = await getTokens();
  return NextResponse.json({ tokens });
}
