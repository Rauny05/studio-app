/**
 * Instant push trigger — called directly by Google Apps Script onEdit.
 * Sends FCM + ntfy immediately without hash comparison.
 */
import { NextRequest, NextResponse } from "next/server";

const REDIS_URL = () => process.env.UPSTASH_REDIS_REST_URL!;
const REDIS_TOKEN = () => process.env.UPSTASH_REDIS_REST_TOKEN!;

async function getTokens(): Promise<string[]> {
  const res = await fetch(`${REDIS_URL()}/get/studio:push-tokens`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN()}` },
    cache: "no-store",
  });
  const json = await res.json() as { result: unknown };
  let v: unknown = json.result;
  while (typeof v === "string") { try { v = JSON.parse(v); } catch { break; } }
  if (typeof v === "object" && v !== null) return Object.values(v as Record<string, string>);
  return [];
}

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.POLL_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { title = "Deliverables Updated", body = "A change was made in the sheet" } =
    await req.json().catch(() => ({})) as { title?: string; body?: string };

  const tokens = await getTokens();
  let fcmSent = 0;

  // FCM — in-app push
  if (tokens.length > 0 && process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const base = req.nextUrl.origin;
      const res = await fetch(`${base}/api/push/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens, title, body }),
      });
      const json = await res.json() as { sent: number };
      fcmSent = json.sent ?? 0;
    } catch { /* continue */ }
  }

  // ntfy — backup
  const topic = process.env.NTFY_TOPIC;
  if (topic) {
    await fetch(`https://ntfy.sh/${topic}`, {
      method: "POST",
      headers: {
        "Title": title,
        "Tags": "bell",
        "Priority": "high",
        "Click": "https://rmmedia-studio.vercel.app/deliverables",
      },
      body,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, fcmSent, tokens: tokens.length });
}
