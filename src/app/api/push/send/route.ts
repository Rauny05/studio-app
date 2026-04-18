/**
 * Send a push notification to all registered devices via FCM.
 * Called by the deliverables poller when sheet changes are detected.
 * Requires FIREBASE_SERVER_KEY env var.
 */
import { NextRequest, NextResponse } from "next/server";

const FCM_URL = "https://fcm.googleapis.com/fcm/send";

export async function POST(req: NextRequest) {
  const serverKey = process.env.FIREBASE_SERVER_KEY;
  if (!serverKey) return NextResponse.json({ error: "FIREBASE_SERVER_KEY not set" }, { status: 500 });

  const { tokens, title, body } = await req.json() as {
    tokens: string[];
    title: string;
    body: string;
  };

  if (!tokens?.length) return NextResponse.json({ sent: 0 });

  const results = await Promise.allSettled(
    tokens.map((token) =>
      fetch(FCM_URL, {
        method: "POST",
        headers: {
          Authorization: `key=${serverKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: token,
          notification: { title, body, sound: "default" },
          data: { route: "/deliverables" },
          priority: "high",
        }),
      })
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return NextResponse.json({ sent, total: tokens.length });
}
