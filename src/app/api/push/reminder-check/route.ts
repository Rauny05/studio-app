/**
 * Custom reminder check cron.
 * Runs every 15 minutes via Vercel Cron.
 * Fires notifications for any reminder due within the current 15-min window.
 */
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { dataGet, dataSet } from "@/lib/data-store";
import type { Reminder } from "@/app/api/reminders/route";

const KEY = "studio:reminders";
const PUSH_KEY = "studio:push:subscriptions";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

async function sendNtfy(title: string, body: string) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return;
  await fetch(`https://ntfy.sh/${topic}`, {
    method: "POST",
    headers: { Title: title, Priority: "high", "Content-Type": "text/plain" },
    body,
  }).catch(() => {});
}

async function sendWebPush(title: string, body: string, url: string) {
  const subs = (await dataGet<PushSubscriptionJSON[]>(PUSH_KEY)) ?? [];
  if (!subs.length) return;
  const payload = JSON.stringify({ title, body, url });
  await Promise.allSettled(
    subs.map((s) => webpush.sendNotification(s as webpush.PushSubscription, payload))
  );
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const authHeader = req.headers.get("Authorization");
  const valid =
    secret === process.env.POLL_SECRET ||
    authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Current IST time
  const IST_OFF = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(Date.now() + IST_OFF);
  const todayStr = nowIST.toISOString().slice(0, 10);
  const nowMinutes = nowIST.getUTCHours() * 60 + nowIST.getUTCMinutes();
  const WINDOW = 15; // minutes

  const reminders = (await dataGet<Reminder[]>(KEY)) ?? [];
  const due = reminders.filter((r) => {
    if (r.sent) return false;
    if (r.date !== todayStr) return false;
    const [h, m] = r.time.split(":").map(Number);
    const rMin = h * 60 + m;
    return nowMinutes >= rMin && nowMinutes < rMin + WINDOW;
  });

  if (!due.length) {
    return NextResponse.json({ ok: true, fired: 0 });
  }

  for (const r of due) {
    const label = r.deliverableLabel || r.brand || "Deliverable";
    const brand = r.brand ? `${r.brand} — ` : "";
    const title = `⏰ Reminder: ${label}`;
    const body = `${brand}${r.date} at ${r.time} IST`;
    await Promise.all([
      sendWebPush(title, body, "/deliverables"),
      sendNtfy(title, body),
    ]);
  }

  // Mark fired reminders as sent
  const updated = reminders.map((r) =>
    due.find((d) => d.id === r.id) ? { ...r, sent: true } : r
  );
  await dataSet(KEY, updated);

  return NextResponse.json({ ok: true, fired: due.length });
}
