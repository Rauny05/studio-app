/**
 * Deliverables change poller.
 * Called on a cron schedule (GitHub Actions every 10 min).
 * Compares current sheet CSV hash with last known hash in Redis.
 * If changed → sends push via ntfy.sh to all subscribed devices.
 */
import { NextRequest, NextResponse } from "next/server";

const REDIS_URL = () => process.env.UPSTASH_REDIS_REST_URL!;
const REDIS_TOKEN = () => process.env.UPSTASH_REDIS_REST_TOKEN!;
const HASH_KEY = "studio:deliverables-hash";
const ROWS_KEY = "studio:deliverables-rowcount";
const SHEET_ID = "1PImkkw3DEsbZ8Vaveqmc-nyPkP_xQhoAGfesPeE1_fY";
const SHEET_GID = "1182035153";

async function redisGet(key: string): Promise<string | null> {
  const res = await fetch(`${REDIS_URL()}/get/${key}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN()}` },
    cache: "no-store",
  });
  const json = await res.json() as { result: unknown };
  let v: unknown = json.result;
  while (typeof v === "string") { try { v = JSON.parse(v); } catch { break; } }
  return typeof v === "string" ? v : v != null ? String(v) : null;
}

async function redisSet(key: string, value: string) {
  await fetch(`${REDIS_URL()}/set/${key}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN()}`, "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}

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

async function sendNtfy(title: string, body: string, tag: string) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return;
  await fetch(`https://ntfy.sh/${topic}`, {
    method: "POST",
    headers: {
      "Title": title,
      "Tags": tag,
      "Priority": "high",
      "Click": "https://rmmedia-studio.vercel.app/deliverables",
    },
    body,
  });
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.POLL_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sheetUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
  const sheetRes = await fetch(sheetUrl, { cache: "no-store" });
  if (!sheetRes.ok) return NextResponse.json({ error: "Sheet fetch failed" }, { status: 502 });

  const csv = await sheetRes.text();
  const rows = csv.split("\n").filter(Boolean);
  const currentHash = `${rows.length}:${csv.slice(0, 300)}`;
  const lastHash = await redisGet(HASH_KEY);
  const lastRows = parseInt((await redisGet(ROWS_KEY)) ?? "0", 10);

  if (lastHash === currentHash) {
    return NextResponse.json({ changed: false });
  }

  // Save new state
  await redisSet(HASH_KEY, currentHash);
  await redisSet(ROWS_KEY, String(rows.length));

  // Determine what changed
  const newRows = Math.max(0, rows.length - lastRows - 1);
  let title: string;
  let body: string;
  let tag: string;

  if (lastHash === null) {
    // First run — baseline only, no notification
    return NextResponse.json({ changed: true, action: "baseline_set" });
  } else if (newRows > 0) {
    title = "New Deliverable Added";
    body = `${newRows} new deliverable${newRows > 1 ? "s were" : " was"} added to the sheet`;
    tag = "memo";
  } else {
    title = "Deliverable Updated";
    body = "A deliverable was updated in the sheet";
    tag = "pencil";
  }

  // Try FCM first (in-app push), fall back to ntfy.sh
  const tokens = await getTokens();
  let fcmSent = 0;
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
    } catch { /* fall through to ntfy */ }
  }

  // ntfy.sh as fallback or supplement
  await sendNtfy(title, body, tag);

  return NextResponse.json({ changed: true, title, body, fcmSent, ntfy: true });
}
