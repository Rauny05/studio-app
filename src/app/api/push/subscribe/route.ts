import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { dataGet, dataSet } from "@/lib/data-store";

const KEY = "studio:push:subscriptions";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscription = await req.json();
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  // Load existing, deduplicate by endpoint, append new
  const existing: PushSubscriptionJSON[] = (await dataGet<PushSubscriptionJSON[]>(KEY)) ?? [];
  const deduped = existing.filter((s) => s.endpoint !== subscription.endpoint);
  await dataSet(KEY, [...deduped, subscription]);

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { endpoint } = await req.json();
  const existing: PushSubscriptionJSON[] = (await dataGet<PushSubscriptionJSON[]>(KEY)) ?? [];
  await dataSet(KEY, existing.filter((s) => s.endpoint !== endpoint));

  return NextResponse.json({ ok: true });
}
