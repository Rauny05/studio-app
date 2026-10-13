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
export function parseGoLiveDate(raw: string): string | null {
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
