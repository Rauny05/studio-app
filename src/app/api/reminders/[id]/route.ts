import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { dataGet, dataSet } from "@/lib/data-store";
import { Reminder } from "../route";

const KEY = "studio:reminders";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const reminders = (await dataGet<Reminder[]>(KEY)) ?? [];
  await dataSet(KEY, reminders.filter((r) => r.id !== params.id));
  return NextResponse.json({ ok: true });
}
