import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/cc/server/auth";
import { gget } from "@/cc/server/google";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
interface Thread { id: string; messages?: { id: string; labelIds?: string[]; snippet?: string; internalDate?: string; payload?: { headers?: { name: string; value: string }[]; mimeType?: string; body?: { data?: string }; parts?: Part[] } }[] }
interface Part { mimeType?: string; body?: { data?: string }; parts?: Part[] }

const QUERIES: Record<string, string> = {
  important: "is:important in:inbox newer_than:14d",
  unread: "is:unread in:inbox newer_than:14d",
  followup: "in:sent older_than:3d newer_than:21d -in:chats",
  recent: "in:inbox newer_than:7d",
};
const hdr = (m: NonNullable<Thread["messages"]>[number], n: string) => m.payload?.headers?.find((h) => h.name.toLowerCase() === n)?.value ?? "";

function plain(p?: Part): string {
  if (!p) return "";
  if (p.mimeType === "text/plain" && p.body?.data) return Buffer.from(p.body.data, "base64url").toString("utf8");
  for (const c of p.parts ?? []) { const t = plain(c); if (t) return t; }
  return "";
}

export async function GET(req: NextRequest) {
  const u = await requireUser(); if (isResponse(u)) return u;
  const sp = req.nextUrl.searchParams;
  const threadId = sp.get("thread");

  if (threadId) {
    if (!/^[\w]+$/.test(threadId)) return NextResponse.json({ error: "bad_id" }, { status: 400 });
    const r = await gget<Thread>(`${API}/threads/${threadId}?format=full`);
    if (r.conn !== "ok" || !r.data) return NextResponse.json({ conn: r.conn, detail: r.detail });
    // bodies are returned to the viewer only, never stored; truncated
    const messages = (r.data.messages ?? []).map((m) => ({
      id: m.id, from: hdr(m, "from"), date: hdr(m, "date"),
      text: plain(m.payload as Part).slice(0, 6000) || m.snippet || "",
    }));
    return NextResponse.json({ conn: "ok", subject: hdr(r.data.messages![0], "subject"), messages, link: `https://mail.google.com/mail/u/0/#all/${threadId}` });
  }

  const view = sp.get("view") ?? "important";
  const q = view === "search" ? (sp.get("q") ?? "").slice(0, 200) : QUERIES[view];
  if (!q) return NextResponse.json({ error: "bad_view" }, { status: 400 });
  const list = await gget<{ threads?: { id: string }[] }>(`${API}/threads?maxResults=15&q=${encodeURIComponent(q)}`);
  if (list.conn !== "ok") return NextResponse.json({ conn: list.conn, detail: list.detail, threads: [] });

  const ids = (list.data?.threads ?? []).map((t) => t.id);
  const metas = await Promise.all(ids.map((id) =>
    gget<Thread>(`${API}/threads/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`)));
  const threads = metas.flatMap((r, i) => {
    const msgs = r.data?.messages; if (!msgs?.length) return [];
    const last = msgs[msgs.length - 1];
    return [{
      id: ids[i], subject: hdr(msgs[0], "subject") || "(no subject)", from: hdr(last, "from"), snippet: last.snippet ?? "",
      date: last.internalDate ? new Date(Number(last.internalDate)).toISOString() : "",
      unread: msgs.some((m) => m.labelIds?.includes("UNREAD")), count: msgs.length,
      link: `https://mail.google.com/mail/u/0/#all/${ids[i]}`,
    }];
  });
  return NextResponse.json({ conn: "ok", view, threads });
}
