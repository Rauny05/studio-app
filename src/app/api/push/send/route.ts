import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { dataGet } from "@/lib/data-store";
import webpush from "web-push";

const KEY = "studio:push:subscriptions";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, body, url } = await req.json();
  if (!title || !body) {
    return NextResponse.json({ error: "title and body required" }, { status: 400 });
  }

  const subscriptions: PushSubscriptionJSON[] = (await dataGet<PushSubscriptionJSON[]>(KEY)) ?? [];
  if (!subscriptions.length) {
    return NextResponse.json({ ok: true, sent: 0, message: "No subscriptions" });
  }

  const payload = JSON.stringify({ title, body, url: url || "/dashboard" });
  const results = await Promise.allSettled(
    subscriptions.map((sub) => webpush.sendNotification(sub as webpush.PushSubscription, payload))
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;

  return NextResponse.json({ ok: true, sent, failed });
}
