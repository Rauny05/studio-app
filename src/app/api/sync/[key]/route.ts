import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { dataGet, dataSet } from "@/lib/data-store";
import { verifyMobileToken } from "@/lib/mobile-auth";

const ALLOWED_KEYS = new Set(["kanban", "todos", "reels", "priority-videos", "cash", "deliverable-overrides", "deliverable-local-rows"]);

interface SyncEnvelope<T = unknown> {
  data: T;
  updatedAt: string;
}

async function authenticate(req: NextRequest): Promise<string | null> {
  // 1. NextAuth session (web)
  const session = await getServerSession(authOptions);
  if (session?.user?.email) return session.user.email;

  // 2. Mobile JWT
  const mobile = await verifyMobileToken(req);
  if (mobile?.email) return mobile.email;

  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const email = await authenticate(req);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key } = await params;
  if (!ALLOWED_KEYS.has(key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  try {
    const redisKey = `studio:sync:${key}`;
    const envelope = await dataGet<SyncEnvelope>(redisKey);
    if (!envelope) {
      return NextResponse.json({ data: null, updatedAt: null });
    }
    return NextResponse.json(envelope);
  } catch (err) {
    console.error(`[sync/${key}] GET failed:`, err);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const email = await authenticate(req);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key } = await params;
  if (!ALLOWED_KEYS.has(key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const envelope: SyncEnvelope = {
      data: body,
      updatedAt: new Date().toISOString(),
    };
    const redisKey = `studio:sync:${key}`;
    await dataSet(redisKey, envelope);
    return NextResponse.json({ ok: true, updatedAt: envelope.updatedAt });
  } catch (err) {
    console.error(`[sync/${key}] POST failed:`, err);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
}
