import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { dataGet, dataSet } from "@/lib/data-store";
import { Reminder } from "../route";

const KEY = "studio:reminders";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await authenticateRequest(req);
  if (user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const reminders = (await dataGet<Reminder[]>(KEY)) ?? [];
  await dataSet(KEY, reminders.filter((r) => r.id !== id));
  return NextResponse.json({ ok: true });
}
