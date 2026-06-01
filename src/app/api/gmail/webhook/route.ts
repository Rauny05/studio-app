import { NextRequest, NextResponse } from "next/server";
import { parsePubSubPayload, fetchMessagesSinceHistory } from "@/lib/gmail";
import { addScript } from "@/lib/scripts-store";
import { randomUUID } from "crypto";

/**
 * POST /api/gmail/webhook
 * Receives Gmail Pub/Sub push notifications.
 * Fetches new messages since the historyId and adds them to the scripts store.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = parsePubSubPayload(body);

    if (!parsed) {
      return NextResponse.json({ ok: true }); // Acknowledge even if malformed
    }

    const emails = await fetchMessagesSinceHistory(parsed.historyId);

    for (const email of emails) {
      await addScript({
        id: randomUUID(),
        title: email.title,
        docs: email.docs.map((d, i) => ({ id: `${randomUUID()}-${i}`, name: d.name, doc_url: d.doc_url, status: "pending" as const, approved_at: null, approved_by: null })),
        sender_name: email.sender_name,
        sender_email: email.sender_email,
        received_at: email.received_at,
        status: "pending",
        approved_at: null,
        approved_by: null,
        gmail_message_id: email.gmail_message_id,
      });
    }

    return NextResponse.json({ ok: true, processed: emails.length });
  } catch (err) {
    console.error("[gmail/webhook] error:", err);
    // Always return 200 to Pub/Sub to avoid retry storms
    return NextResponse.json({ ok: true });
  }
}
