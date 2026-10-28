import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { dataGet, dataSet } from "@/lib/data-store";
import { randomUUID } from "crypto";

const KEY = "studio:reminders";

export interface Reminder {
  id: string;
  deliverableId: string;  // pnNo
  deliverableLabel: string;
  brand: string;
  date: string;   // YYYY-MM-DD (IST)
  time: string;   // HH:MM (IST, 24-hr)
  sent: boolean;
  createdAt: string;
}

async function requireAdmin(req: NextRequest) {
  const user = await authenticateRequest(req);
  return user?.role === "admin" ? user : null;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const reminders = (await dataGet<Reminder[]>(KEY)) ?? [];
  return NextResponse.json({ reminders });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const { deliverableId, deliverableLabel, brand, date, time } = body;
  if (!date || !time) {
    return NextResponse.json({ error: "date and time required" }, { status: 400 });
  }
  const reminders = (await dataGet<Reminder[]>(KEY)) ?? [];
  const reminder: Reminder = {
    id: randomUUID(),
    deliverableId: deliverableId ?? "",
    deliverableLabel: deliverableLabel ?? "",
    brand: brand ?? "",
    date,
    time,
    sent: false,
    createdAt: new Date().toISOString(),
  };
  reminders.push(reminder);
  await dataSet(KEY, reminders);
  return NextResponse.json({ reminder });
}
