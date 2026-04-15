import { NextRequest, NextResponse } from "next/server";
import type { DeliverableRow } from "@/app/api/deliverables/route";

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL ?? "";

export async function POST(req: NextRequest) {
  const row: DeliverableRow = await req.json();

  if (!APPS_SCRIPT_URL) {
    return NextResponse.json(
      { error: "APPS_SCRIPT_URL not configured", setup: true },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pnNo: row.pnNo,
        brand: row.brand,
        deliverables: row.deliverables
          .map((d) => `${d.label} - ${d.status}`)
          .join("\n"),
        emailSent: row.emailSent ? "Yes" : "No",
        advance50: row.advance50 ? "Yes" : "No",
        payment100: row.payment100 ? "Yes" : "No",
        invoiceNumber: row.invoiceNumber,
        note: row.note,
      }),
    });

    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    return NextResponse.json({ ok: true, result: json });
  } catch (err) {
    console.error("Sync error:", err);
    return NextResponse.json({ error: "Failed to reach Apps Script" }, { status: 502 });
  }
}
