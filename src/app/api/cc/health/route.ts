import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/cc/server/auth";
import { classifyHttp, embeddableFromHeaders, type ProbeResult } from "@/cc/lib/health";

const cache = new Map<string, { at: number; r: ProbeResult }>();
const TTL = 60_000;

function blocked(u: URL): boolean {
  const h = u.hostname;
  return !/^https?:$/.test(u.protocol) || h === "169.254.169.254" || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h.endsWith(".internal");
}

async function probe(url: string, localOnly: boolean, origin: string): Promise<ProbeResult> {
  let u: URL;
  try { u = new URL(url); } catch { return { status: "not_configured", reason: "invalid url" }; }
  if (blocked(u)) return { status: "not_configured", reason: "blocked address" };
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(u.hostname);
  // A deployed server cannot see the user's machine; that is "unknown", not "offline".
  if (isLocal && process.env.VERCEL) return { status: "unknown", reason: "local-only app, unreachable from the server" };
  const key = url;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.r;
  const t0 = Date.now();
  let r: ProbeResult;
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(6000), cache: "no-store", headers: { "user-agent": "rm-command-center-healthcheck" } });
    r = {
      status: classifyHttp(res.status), httpStatus: res.status, ms: Date.now() - t0,
      embeddable: embeddableFromHeaders({ xfo: res.headers.get("x-frame-options"), csp: res.headers.get("content-security-policy") }, origin),
    };
  } catch (e) {
    r = { status: localOnly || isLocal ? "offline" : classifyHttp(null, "network"), ms: Date.now() - t0, reason: e instanceof Error ? e.name : "failed" };
  }
  cache.set(key, { at: Date.now(), r });
  return r;
}

export async function POST(req: NextRequest) {
  const u = await requireUser(); if (isResponse(u)) return u;
  const body = (await req.json().catch(() => null)) as { apps?: { id: string; url?: string | null; localOnly?: boolean }[] } | null;
  const apps = body?.apps?.slice(0, 80);
  if (!apps) return NextResponse.json({ error: "bad_body" }, { status: 400 });
  const origin = req.nextUrl.origin;
  const out: Record<string, ProbeResult & { checkedAt: string }> = {};
  const queue = [...apps];
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let a = queue.shift(); a; a = queue.shift()) {
      const r = a.url ? await probe(a.url, !!a.localOnly, origin) : { status: "not_configured" as const, reason: "no url" };
      out[a.id] = { ...r, checkedAt: new Date().toISOString() };
    }
  }));
  return NextResponse.json({ results: out });
}
