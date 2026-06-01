import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getScripts, addScript } from "@/lib/scripts-store";
import { randomUUID } from "crypto";
import type { Script } from "@/lib/scripts-store";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // Also allow internal calls with CRON_SECRET
  const authHeader = req.headers.get("Authorization");
  const isInternal = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!session?.user?.email && !isInternal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const scripts = await getScripts();
    return NextResponse.json({ scripts });
  } catch (err) {
    console.error("[scripts] GET error:", err);
    return NextResponse.json({ error: "Failed to load scripts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Internal-only endpoint — secured by CRON_SECRET
  const authHeader = req.headers.get("Authorization");
  const secret = req.nextUrl.searchParams.get("secret");
  const valid =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    secret === process.env.POLL_SECRET;

  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json() as Omit<Script, "id" | "status" | "approved_at" | "approved_by">;

    if (!body.gmail_message_id || !body.title) {
      return NextResponse.json({ error: "gmail_message_id and title required" }, { status: 400 });
    }

    const script: Script = {
      id: randomUUID(),
      title: body.title,
      docs: (body.docs ?? []),
      sender_name: body.sender_name ?? "",
      sender_email: body.sender_email ?? "",
      received_at: body.received_at ?? new Date().toISOString(),
      status: "pending",
      approved_at: null,
      approved_by: null,
      gmail_message_id: body.gmail_message_id,
    };

    const { added } = await addScript(script);
    return NextResponse.json({ script, added });
  } catch (err) {
    console.error("[scripts] POST error:", err);
    return NextResponse.json({ error: "Failed to add script" }, { status: 500 });
  }
}
