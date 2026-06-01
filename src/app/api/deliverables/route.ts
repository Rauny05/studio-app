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
  id?: string;
  label: string;
  type?: string;
  status: "Pending" | "Completed";
  completedAt?: string;
  completedBy?: string;
  publishedUrl?: string;
  emailDrafted?: boolean;
}

export interface ActivityEntry {
  type: "deliverable_completed" | "email_generated" | "url_added";
  message: string;
  deliverableId?: string;
  deliverableLabel?: string;
  createdAt: string;
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
  goLiveDate?: string;       // YYYY-MM-DD
  activityLog?: ActivityEntry[];
}

const MONTH_MAP: Record<string, string> = {
  ja: "Jan", fe: "Feb", ma: "Mar", ap: "Apr",
  my: "May", ju: "Jun", jl: "Jul", au: "Aug",
  se: "Sep", oc: "Oct", no: "Nov", de: "Dec",
};

function parseMonth(pnNo: string): string {
  // Handles: ap25-1, apr25-1, ap2025-1, APR25-001, etc.
  const match = pnNo.match(/^([a-z]{2,4})(\d{2,4})-/i);
  if (!match) return "";
  const prefix = match[1].slice(0, 2).toLowerCase();
  const yearRaw = match[2];
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  return `${MONTH_MAP[prefix] ?? match[1]} ${year}`;
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

const MONTH_NAMES: Record<string, number> = {
  january:1,february:2,march:3,april:4,may:5,june:6,
  july:7,august:8,september:9,october:10,november:11,december:12,
  jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
};

function toISODate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function inferYear(day: number, month: number): number {
  const now = new Date();
  const thisYear = now.getFullYear();
  const candidate = new Date(thisYear, month - 1, day);
  return candidate < new Date(now.getTime() - 86_400_000) ? thisYear + 1 : thisYear;
}

/**
 * Parse any go-live date string into YYYY-MM-DD.
 * Handles: "4th June Thu", "12 Jun 2025", "Jun 12", DD/MM/YYYY, YYYY-MM-DD.
 * Infers current/next year when no year is given.
 */
function parseGoLiveDate(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // DD/MM/YYYY — always treat as day-first (Indian/UK format)
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    let [, d, m, y] = slashMatch;
    if (y.length === 2) y = `20${y}`;
    return toISODate(parseInt(y, 10), parseInt(m, 10), parseInt(d, 10));
  }

  // Strip ordinal suffixes (1st→1, 2nd→2, 4th→4) and day-of-week names
  const cleaned = trimmed
    .replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, "$1")
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const dayMatch   = cleaned.match(/\b(\d{1,2})\b/);
  const yearMatch  = cleaned.match(/\b(20\d{2})\b/);
  const monthMatch = cleaned.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/i
  );

  if (dayMatch && monthMatch) {
    const day   = parseInt(dayMatch[1], 10);
    const month = MONTH_NAMES[monthMatch[1].toLowerCase()];
    const year  = yearMatch ? parseInt(yearMatch[1], 10) : inferYear(day, month);
    return toISODate(year, month, day);
  }

  // Last resort: native Date parse
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) {
    return toISODate(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  return null;
}

export async function GET(req: import("next/server").NextRequest) {
  // Accept both NextAuth session and mobile JWT
  const { getServerSession } = await import("next-auth");
  const { authOptions } = await import("@/app/api/auth/[...nextauth]/route");
  const { verifyMobileToken } = await import("@/lib/mobile-auth");

  const session = await getServerSession(authOptions);
  const mobile = session?.user?.email ? null : await verifyMobileToken(req);

  if (!session?.user?.email && !mobile?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch sheet (HTTP ${res.status})` }, { status: 502 });
    }

    const text = await res.text();

    // If Google redirected to a login page, the body will be HTML not CSV
    if (text.trimStart().startsWith("<!DOCTYPE") || text.trimStart().startsWith("<html")) {
      return NextResponse.json(
        { error: "sheet_private", message: "The Google Sheet is private. Share it as 'Anyone with the link → Viewer'." },
        { status: 403 }
      );
    }
    const rows = parseCSV(text);
    const dataRows: DeliverableRow[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 2) continue;

      const pnNo = (row[0] ?? "").trim();
      const brand = (row[1] ?? "").trim();

      // Skip rows with no usable data
      if (!pnNo && !brand) continue;
      // Skip clearly empty / header-like rows
      if (!brand) continue;

      const delRaw = (row[2] ?? "").trim();
      const pocRaw = (row[3] ?? "").trim();
      const goLiveDateRaw = (row[4] ?? "").trim();
      const emailSent = (row[5] ?? "").trim().toLowerCase() === "yes";
      const advance50 = (row[6] ?? "").trim().toLowerCase() === "yes";
      const payment100 = (row[7] ?? "").trim().toLowerCase() === "yes";
      const invoiceNumber = (row[8] ?? "").trim();
      const note = (row[9] ?? "").trim();

      const { name: pocName, company: pocCompany } = parsePOC(pocRaw);
      const deliverables = parseDeliverables(delRaw);
      const paymentStep = (payment100 ? 3 : advance50 ? 2 : emailSent ? 1 : 0) as 0 | 1 | 2 | 3;

      // Parse go live date — accepts DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, or "12 Jun 2025"
      const goLiveDate = parseGoLiveDate(goLiveDateRaw);

      dataRows.push({
        id: pnNo || `row-${i}`,
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
        ...(goLiveDate ? { goLiveDate } : {}),
      });
    }

    return NextResponse.json({ deliverables: dataRows });
  } catch (err) {
    console.error("Deliverables error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
