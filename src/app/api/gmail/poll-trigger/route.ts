import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchNewScriptEmails } from "@/lib/gmail";
import { addScript } from "@/lib/scripts-store";
import { randomUUID } from "crypto";

/**
 * POST /api/gmail/poll-trigger
 * Client-facing: lets authenticated users manually trigger a Gmail poll.
 * Rate limited by session auth (no cron secret needed).
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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

    return NextResponse.json({ ok: true, checked: emails.length, added });
  } catch (err) {
    console.error("[gmail/poll-trigger] error:", err);
    return NextResponse.json({ error: "Poll failed" }, { status: 500 });
  }
}
