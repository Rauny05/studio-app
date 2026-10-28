import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { dataGet, dataSet } from "@/lib/data-store";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { isStaleWrite } from "@/lib/sync-version";
import { notifyNewlyCompletedDeliverables } from "@/lib/activepieces-webhook";
import type { DeliverableRow } from "@/app/api/deliverables/route";

const ALLOWED_KEYS = new Set(["kanban", "todos", "reels", "priority-videos", "cash", "deliverable-overrides", "deliverable-local-rows", "deliverable-hidden"]);

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
    const redisKey = `studio:sync:${key}`;

    // Opt-in optimistic concurrency (native app). Web clients don't send the header.
    const baseUpdatedAt = req.headers.get("x-base-updated-at");
    if (baseUpdatedAt !== null) {
      const current = await dataGet<SyncEnvelope>(redisKey);
      if (isStaleWrite(baseUpdatedAt, current?.updatedAt)) {
        return NextResponse.json({ error: "conflict", current }, { status: 409 });
      }
    }

    // Deliverable completions are registered here — capture prior state so we can
    // detect newly-completed items and notify Activepieces after the write succeeds.
    let previousOverrides: Record<string, DeliverableRow> | null = null;
    if (key === "deliverable-overrides") {
      const previousEnvelope = await dataGet<SyncEnvelope<Record<string, DeliverableRow>>>(redisKey).catch(() => null);
      previousOverrides = previousEnvelope?.data ?? {};
    }

    const envelope: SyncEnvelope = {
      data: body,
      updatedAt: new Date().toISOString(),
    };
    await dataSet(redisKey, envelope);

    if (key === "deliverable-overrides" && previousOverrides) {
      // Body shape varies by caller: either { overrides: {...} } or the raw map itself.
      const newOverrides = (
        body && typeof body === "object" && "overrides" in body
          ? (body as { overrides: Record<string, DeliverableRow> }).overrides
          : body
      ) as Record<string, DeliverableRow>;

      await notifyNewlyCompletedDeliverables(previousOverrides, newOverrides ?? {}).catch((err) => {
        console.error("[sync/deliverable-overrides] Activepieces notification failed:", err);
      });
    }

    return NextResponse.json({ ok: true, updatedAt: envelope.updatedAt });
  } catch (err) {
    console.error(`[sync/${key}] POST failed:`, err);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
}
