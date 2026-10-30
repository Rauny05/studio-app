import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/cc/server/auth";
import { gget } from "@/cc/server/google";

interface GEvent { id: string; summary?: string; location?: string; htmlLink?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; attendees?: unknown[] }

export async function GET(req: NextRequest) {
  const u = await requireUser(); if (isResponse(u)) return u;
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from"), to = sp.get("to");
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return NextResponse.json({ error: "bad_range" }, { status: 400 });
  // IST day boundaries (+05:30) so "today" is the studio's today
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=100&timeZone=Asia%2FKolkata&timeMin=${encodeURIComponent(from + "T00:00:00+05:30")}&timeMax=${encodeURIComponent(to + "T23:59:59+05:30")}`;
  const r = await gget<{ items?: GEvent[] }>(url);
  if (r.conn !== "ok") return NextResponse.json({ conn: r.conn, detail: r.detail, events: [] });
  const events = (r.data?.items ?? []).map((e) => ({
    id: e.id, title: e.summary ?? "(untitled)", location: e.location, link: e.htmlLink,
    start: e.start?.dateTime ?? e.start?.date, end: e.end?.dateTime ?? e.end?.date, allDay: !e.start?.dateTime,
    meeting: (e.attendees?.length ?? 0) > 0,
  }));
  return NextResponse.json({ conn: "ok", events });
}
