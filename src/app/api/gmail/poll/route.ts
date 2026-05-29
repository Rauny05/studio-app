import { NextRequest, NextResponse } from "next/server";
import { fetchNewScriptEmails } from "@/lib/gmail";
import { addScript } from "@/lib/scripts-store";
import { randomUUID } from "crypto";

/**
 * GET /api/gmail/poll
 * Cron job — runs every 60s to poll Gmail for new "scripts to check" emails.
 * Secured by CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const isInternal = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isVercelCron && !isInternal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Poll last 2 minutes (Gmail poll interval matches cron frequency)
    const emails = await fetchNewScriptEmails();
    let added = 0;

    for (const email of emails) {
      const result = await addScript({
        id: randomUUID(),
        title: email.title,
        doc_url: email.doc_url ?? null,
        sender_name: email.sender_name,
        sender_email: email.sender_email,
        received_at: email.received_at,
        status: "pending",
        approved_at: null,
        approved_by: null,
        gmail_message_id: email.gmail_message_id,
      });
      if (result.added) added++;
    }

    console.log(`[gmail/poll] checked ${emails.length} emails, added ${added} new scripts`);
    return NextResponse.json({ ok: true, checked: emails.length, added });
  } catch (err) {
    console.error("[gmail/poll] error:", err);
    return NextResponse.json({ error: "Poll failed" }, { status: 500 });
  }
}
