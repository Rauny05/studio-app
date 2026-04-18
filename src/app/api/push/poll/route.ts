/**
 * Deliverables change poller — call this endpoint on a cron schedule.
 * Compares current sheet hash with last known hash in Redis.
 * If changed → sends push notification to all registered devices.
 *
 * Set up a cron (e.g. cron-job.org) to GET this URL every 10 minutes:
 *   https://rmmedia-studio.vercel.app/api/push/poll?secret=POLL_SECRET
 */
import { NextRequest, NextResponse } from "next/server";

const REDIS_URL = () => process.env.UPSTASH_REDIS_REST_URL!;
const REDIS_TOKEN = () => process.env.UPSTASH_REDIS_REST_TOKEN!;
const HASH_KEY = "studio:deliverables-hash";
const TOKENS_KEY = "studio:push-tokens";
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
  return typeof v === "string" ? v : v ? JSON.stringify(v) : null;
}

async function redisSet(key: string, value: string) {
  await fetch(`${REDIS_URL()}/set/${key}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN()}`, "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}

async function getTokens(): Promise<string[]> {
  const res = await fetch(`${REDIS_URL()}/get/${TOKENS_KEY}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN()}` },
    cache: "no-store",
  });
  const json = await res.json() as { result: unknown };
  let v: unknown = json.result;
  while (typeof v === "string") { try { v = JSON.parse(v); } catch { break; } }
  if (typeof v === "object" && v !== null) return Object.values(v as Record<string, string>);
  return [];
}

async function simpleHash(str: string): Promise<string> {
  // Simple fast hash — just use first 200 chars + length as fingerprint
  return `${str.length}:${str.slice(0, 200)}`;
}

export async function GET(req: NextRequest) {
  // Validate secret to prevent abuse
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.POLL_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch current sheet
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
  const sheetRes = await fetch(sheetUrl, { cache: "no-store" });
  if (!sheetRes.ok) return NextResponse.json({ error: "Sheet fetch failed" }, { status: 502 });

  const csv = await sheetRes.text();
  const currentHash = await simpleHash(csv);
  const lastHash = await redisGet(HASH_KEY);

  if (lastHash === currentHash) {
    return NextResponse.json({ changed: false });
  }

  // Hash changed — save new hash & notify
  await redisSet(HASH_KEY, currentHash);

  // Count new rows (rough: compare row count)
  const currentRows = csv.split("\n").filter(Boolean).length;
  const lastRows = lastHash ? parseInt(lastHash.split(":")[0]) : currentRows;
  const newRows = Math.max(0, currentRows - lastRows - 1); // -1 for header

  const notifTitle = "Deliverables Updated";
  const notifBody = newRows > 0
    ? `${newRows} new deliverable${newRows > 1 ? "s" : ""} added to the sheet`
    : "A deliverable was updated in the sheet";

  // Send to all registered tokens
  const tokens = await getTokens();
  if (tokens.length > 0) {
    const base = req.nextUrl.origin;
    await fetch(`${base}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokens, title: notifTitle, body: notifBody }),
    });
  }

  return NextResponse.json({ changed: true, notified: tokens.length, body: notifBody });
}
