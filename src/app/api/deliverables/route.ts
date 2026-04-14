import { NextResponse } from "next/server";

const SHEET_ID = "1PImkkw3DEsbZ8Vaveqmc-nyPkP_xQhoAGfesPeE1_fY";
const SHEET_GID = "1182035153"; // "copy of 2025 Apr Onwards" — DO NOT touch master sheet

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        current.push(field);
        field = "";
      } else if (char === "\n") {
        current.push(field);
        field = "";
        rows.push(current);
        current = [];
      } else if (char === "\r") {
        // skip \r
      } else {
        field += char;
      }
    }
  }

  if (current.length > 0 || field) {
    current.push(field);
    rows.push(current);
  }

  return rows;
}

export interface DeliverableItem {
  label: string;
  status: "Pending" | "Completed";
}

export interface DeliverableRow {
  id: string;
  pnNo: string;
  brand: string;
  deliverables: DeliverableItem[];
  poc: string;
  pocName: string;
  pocCompany: string;
  emailSent: boolean;
  advance50: boolean;
  payment100: boolean;
  invoiceNumber: string;
  note: string;
  paymentStep: 0 | 1 | 2 | 3;
  overallStatus: "pending" | "in-progress" | "awaiting-payment" | "done";
  month: string;
}

const MONTH_MAP: Record<string, string> = {
  ja: "Jan", fe: "Feb", ma: "Mar", ap: "Apr",
  my: "May", ju: "Jun", jl: "Jul", au: "Aug",
  se: "Sep", oc: "Oct", no: "Nov", de: "Dec",
};

function parseMonth(pnNo: string): string {
  const match = pnNo.match(/^([a-z]{2})(\d{2})-/i);
  if (!match) return "";
  const prefix = match[1].toLowerCase();
  const year = `20${match[2]}`;
  return `${MONTH_MAP[prefix] ?? prefix} ${year}`;
}

function parseDeliverables(raw: string): DeliverableItem[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => ({
      label: line.replace(/\s*-\s*(Pending|Completed)\s*$/i, "").trim(),
      status: /completed/i.test(line) ? "Completed" : "Pending",
    }));
}

function parsePOC(raw: string): { name: string; company: string } {
  const parts = raw.split(" - ");
  return {
    name: parts[0]?.trim() ?? raw,
    company: parts.slice(1).join(" - ").trim(),
  };
}

function computeOverallStatus(
  deliverables: DeliverableItem[],
  payment100: boolean
): DeliverableRow["overallStatus"] {
  if (!deliverables.length) return "pending";
  const allDone = deliverables.every((d) => d.status === "Completed");
  if (allDone && payment100) return "done";
  if (allDone) return "awaiting-payment";
  if (deliverables.some((d) => d.status === "Completed")) return "in-progress";
  return "pending";
}

export async function GET() {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch sheet" }, { status: 502 });
    }

    const text = await res.text();
    const rows = parseCSV(text);
    const dataRows: DeliverableRow[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 3) continue;

      const pnNo = (row[0] ?? "").trim();
      if (!pnNo || !/^[a-z]{2}\d{2}-\d+/i.test(pnNo)) continue;

      const brand = (row[1] ?? "").trim();
      if (!brand) continue;

      const delRaw = (row[2] ?? "").trim();
      const pocRaw = (row[3] ?? "").trim();
      const emailSent = (row[4] ?? "").trim().toLowerCase() === "yes";
      const advance50 = (row[5] ?? "").trim().toLowerCase() === "yes";
      const payment100 = (row[6] ?? "").trim().toLowerCase() === "yes";
      const invoiceNumber = (row[7] ?? "").trim();
      const note = (row[8] ?? "").trim();

      const { name: pocName, company: pocCompany } = parsePOC(pocRaw);
      const deliverables = parseDeliverables(delRaw);
      const paymentStep = (payment100 ? 3 : advance50 ? 2 : emailSent ? 1 : 0) as 0 | 1 | 2 | 3;

      dataRows.push({
        id: pnNo,
        pnNo,
        brand,
        deliverables,
        poc: pocRaw,
        pocName,
        pocCompany,
        emailSent,
        advance50,
        payment100,
        invoiceNumber,
        note,
        paymentStep,
        overallStatus: computeOverallStatus(deliverables, payment100),
        month: parseMonth(pnNo),
      });
    }

    return NextResponse.json({ deliverables: dataRows });
  } catch (err) {
    console.error("Deliverables error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
