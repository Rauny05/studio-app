import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/cc/server/auth";
import { NotConfigured, readState, STATE_KEYS, writeState, type StateKey } from "@/cc/server/state";

const MAX_BYTES = 1_000_000;
const valid = (k: string): k is StateKey => (STATE_KEYS as readonly string[]).includes(k);

export async function GET(_: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const u = await requireUser(); if (isResponse(u)) return u;
  const { key } = await params;
  if (!valid(key)) return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  try { return NextResponse.json({ envelope: await readState(key) }); }
  catch (e) {
    if (e instanceof NotConfigured) return NextResponse.json({ error: "not_configured" }, { status: 501 });
    return NextResponse.json({ error: "storage_error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const u = await requireUser(); if (isResponse(u)) return u;
  const { key } = await params;
  if (!valid(key)) return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  const text = await req.text();
  if (text.length > MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  if (!body || typeof body !== "object" || !("data" in body)) return NextResponse.json({ error: "bad_shape" }, { status: 400 });
  try { const env = await writeState(key, (body as { data: unknown }).data); return NextResponse.json({ ok: true, updatedAt: env.updatedAt }); }
  catch (e) {
    if (e instanceof NotConfigured) return NextResponse.json({ error: "not_configured" }, { status: 501 });
    return NextResponse.json({ error: "storage_error" }, { status: 500 });
  }
}
