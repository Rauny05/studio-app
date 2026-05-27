/**
 * Go-live date reminder cron job.
 * Called daily at 08:00 IST (02:30 UTC) via Vercel Cron.
 * Sends push notifications for deliverables going live today or tomorrow.
 */
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { dataGet } from "@/lib/data-store";
import type { DeliverableRow } from "@/app/api/deliverables/route";

const PUSH_SUBS_KEY = "studio:push:subscriptions";
const OVERRIDES_KEY = "studio:sync:deliverable-overrides";
const SHEET_ID      = "1PImkkw3DEsbZ8Vaveqmc-nyPkP_xQhoAGfesPeE1_fY";
const SHEET_GID     = "1182035153";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseCSVRows(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next  = text[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') { field += '"'; i++; }
      else if (char === '"') { inQuotes = false; }
      else field += char;
    } else {
      if (char === '"')  { inQuotes = true; }
      else if (char === ",") { current.push(field); field = ""; }
      else if (char === "\n") { current.push(field); field = ""; rows.push(current); current = []; }
      else if (char !== "\r") field += char;
    }
  }
  if (current.length > 0 || field) { current.push(field); rows.push(current); }
  return rows;
}

// Determine which deliverables on a row are "video" type (reel/video/short/yt/event)
function videoDeliverables(row: DeliverableRow): string[] {
  return row.deliverables
    .filter((d) => /reel|video|short|yt\b|event/i.test(d.label))
    .map((d) => d.label);
}

async function sendNtfy(title: string, body: string) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return;
  await fetch(`https://ntfy.sh/${topic}`, {
    method: "POST",
    headers: {
      Title: title,
      Tags: "calendar",
      Priority: "high",
      Click: "https://rmmedia-studio.vercel.app/deliverables",
    },
    body,
  }).catch(() => {});
}

async function sendWebPush(subs: PushSubscriptionJSON[], payload: object) {
  if (!subs.length) return { sent: 0, failed: 0 };
  const str = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subs.map((s) => webpush.sendNotification(s as webpush.PushSubscription, str)),
  );
  return {
    sent:   results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
  };
}

export async function GET(req: NextRequest) {
  // Allow POLL_SECRET query param OR Vercel's built-in CRON_SECRET header
  const secret = req.nextUrl.searchParams.get("secret");
  const cronHeader = req.headers.get("authorization")?.replace("Bearer ", "");
  const validSecret = process.env.POLL_SECRET || process.env.CRON_SECRET;

  if (secret !== validSecret && cronHeader !== validSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── 1. Determine today / tomorrow in IST (UTC+5:30) ─────────────────────
  const nowUtc  = new Date();
  const istOff  = 5.5 * 60 * 60 * 1000;
  const nowIst  = new Date(nowUtc.getTime() + istOff);
  const todayStr    = toDateStr(nowIst);
  const tomorrowIst = new Date(nowIst.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = toDateStr(tomorrowIst);

  // ── 2. Load overrides from Redis (contains goLiveDate) ───────────────────
  const envelope = await dataGet<{ data: Record<string, DeliverableRow> }>(OVERRIDES_KEY).catch(() => null);
  const overrides: Record<string, DeliverableRow> = envelope?.data ?? {};

  // ── 3. Load sheet rows to get brand names ────────────────────────────────
  let sheetRows: DeliverableRow[] = [];
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const text = await res.text();
      const rows = parseCSVRows(text);
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const pnNo  = (row[0] ?? "").trim();
        const brand = (row[1] ?? "").trim();
        if (!brand) continue;
        const id = pnNo || `row-${i}`;
        // minimal row shape — just enough for override merging
        sheetRows.push({ id, pnNo, brand } as DeliverableRow);
      }
    }
  } catch { /* non-fatal */ }

  // Build merged list: start with overrides (which have goLiveDate), fill in brand from sheet if needed
  const all: DeliverableRow[] = Object.values(overrides).map((ov) => {
    const sheet = sheetRows.find((r) => r.id === ov.id);
    return { ...sheet, ...ov };
  });

  // ── 4. Find rows going live today / tomorrow ─────────────────────────────
  type Bucket = { row: DeliverableRow; label: string };
  const today:    Bucket[] = [];
  const tomorrow: Bucket[] = [];

  for (const row of all) {
    if (!row.goLiveDate || !row.brand) continue;
    const vids = videoDeliverables(row);
    const label = vids.length > 0 ? vids.slice(0, 2).join(" + ") : row.brand;

    if (row.goLiveDate === todayStr)    today.push({ row, label });
    if (row.goLiveDate === tomorrowStr) tomorrow.push({ row, label });
  }

  if (today.length === 0 && tomorrow.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "Nothing going live today or tomorrow" });
  }

  // ── 5. Build notification messages ───────────────────────────────────────
  const notifications: { title: string; body: string; url: string }[] = [];

  for (const { row, label } of today) {
    notifications.push({
      title: `🚀 ${row.brand} goes live today`,
      body:  label !== row.brand ? `${label} · ${todayStr}` : todayStr,
      url:   "/deliverables",
    });
  }

  for (const { row, label } of tomorrow) {
    const dateDisplay = tomorrowIst.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    notifications.push({
      title: `📅 ${row.brand} goes live tomorrow`,
      body:  label !== row.brand ? `${label} · ${dateDisplay}` : dateDisplay,
      url:   "/deliverables",
    });
  }

  // ── 6. Send web push to all subscribers ──────────────────────────────────
  const subs: PushSubscriptionJSON[] = (await dataGet<PushSubscriptionJSON[]>(PUSH_SUBS_KEY)) ?? [];
  let totalSent = 0;

  for (const notif of notifications) {
    const { sent } = await sendWebPush(subs, notif);
    totalSent += sent;
    // Small delay between notifications so they don't stack instantly
    await new Promise((r) => setTimeout(r, 300));
  }

  // ── 7. ntfy.sh fallback (one summary message) ────────────────────────────
  if (notifications.length === 1) {
    await sendNtfy(notifications[0].title, notifications[0].body);
  } else {
    const summary = notifications.map((n) => n.title.replace(/^[🚀📅]\s*/, "")).join(" | ");
    await sendNtfy(`📅 ${notifications.length} go-live reminders`, summary);
  }

  return NextResponse.json({
    ok: true,
    sent: totalSent,
    today: today.length,
    tomorrow: tomorrow.length,
    notifications: notifications.map((n) => ({ title: n.title, body: n.body })),
  });
}
