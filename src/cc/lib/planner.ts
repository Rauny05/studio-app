/**
 * Tasks + date logic. Pure and dependency-free so it runs under the node test runner.
 * Dates are calendar dates ("YYYY-MM-DD") in the studio timezone (Asia/Kolkata).
 * A task's `due` (deadline) is independent of `plannedDate/plannedStart/duration` (working time).
 */

export const STUDIO_TZ = "Asia/Kolkata";

export type TaskStatus = "todo" | "doing" | "done" | "dropped";
export type Priority = 0 | 1 | 2 | 3; // 0 none, 1 low, 2 medium, 3 high
export type Recurrence = "none" | "daily" | "weekdays" | "weekly" | "monthly";

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  due?: string;
  plannedDate?: string;
  plannedStart?: string; // HH:MM
  durationMin?: number;
  recurrence: Recurrence;
  category?: string;
  project?: string;
  client?: string;
  deliverableId?: string;
  shootId?: string;
  source: "cc" | "gmail" | "ai" | "shoot";
  sourceRef?: string; // e.g. Gmail thread id
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  history: { at: string; text: string }[];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Calendar date in the studio timezone for an instant. */
export function dateInTZ(now: Date, tz: string = STUDIO_TZ): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return p; // en-CA => YYYY-MM-DD
}

export function timeInTZ(now: Date, tz: string = STUDIO_TZ): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const h = parts.find((x) => x.type === "hour")?.value ?? "00";
  const m = parts.find((x) => x.type === "minute")?.value ?? "00";
  return `${h === "24" ? "00" : h}:${m}`;
}

function parts(d: string): [number, number, number] {
  const [y, m, day] = d.split("-").map(Number);
  return [y, m, day];
}

export function addDays(d: string, n: number): string {
  const [y, m, day] = parts(d);
  const t = new Date(Date.UTC(y, m - 1, day + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function addMonths(d: string, n: number): string {
  const [y, m, day] = parts(d);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-${pad(Math.min(day, last))}`;
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(d: string): number {
  const [y, m, day] = parts(d);
  return new Date(Date.UTC(y, m - 1, day)).getUTCDay();
}

export function startOfWeek(d: string): string {
  const wd = weekday(d);
  return addDays(d, -((wd + 6) % 7)); // Monday
}

export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000);
}

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export interface ParsedDate { date?: string; time?: string; rest: string }

/** Pull a date and optional time out of free text ("call brand friday 4pm"). */
export function parseNaturalDate(text: string, today: string): ParsedDate {
  let rest = ` ${text} `;
  let date: string | undefined;
  let time: string | undefined;

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = rest.match(re);
    if (m) { fn(m); rest = rest.replace(re, " "); }
  };

  // time: 4pm, 4:30pm, 16:30
  take(/\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s?(am|pm)\b/i, (m) => {
    let h = Number(m[1]) % 12; if (/pm/i.test(m[3])) h += 12;
    time = `${pad(h)}:${m[2] ?? "00"}`;
  });
  if (!time) take(/\s(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/, (m) => { time = `${pad(Number(m[1]))}:${m[2]}`; });

  take(/\s(?:on\s+)?(\d{4}-\d{2}-\d{2})\b/, (m) => { date = m[1]; });
  if (!date) take(/\s(today|tonight|tod)\b/i, () => { date = today; });
  if (!date) take(/\s(tomorrow|tmrw|tom)\b/i, () => { date = addDays(today, 1); });
  if (!date) take(/\sin\s+(\d{1,3})\s*(day|days|d|week|weeks|w)\b/i, (m) => {
    date = addDays(today, Number(m[1]) * (/^w/i.test(m[2]) ? 7 : 1));
  });
  if (!date) take(/\s(?:next\s+)?(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/i, (m) => {
    const target = WEEKDAYS.indexOf(m[1].toLowerCase());
    const cur = weekday(today);
    let delta = (target - cur + 7) % 7;
    if (delta === 0) delta = 7; // same weekday means next week
    date = addDays(today, delta);
  });
  if (!date) take(/\s(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i, (m) => {
    const [y] = parts(today);
    let cand = `${y}-${pad(MONTHS.indexOf(m[2].toLowerCase()) + 1)}-${pad(Number(m[1]))}`;
    if (cand < today) cand = `${y + 1}${cand.slice(4)}`;
    date = cand;
  });

  return { date, time, rest: rest.replace(/\s+/g, " ").trim() };
}

export interface QuickCapture {
  title: string;
  due?: string;
  plannedDate?: string;
  plannedStart?: string;
  durationMin?: number;
  priority: Priority;
  tags: string[];
  project?: string;
  recurrence: Recurrence;
}

/**
 * Syntax: `title tomorrow 4pm !high #tag @project 45m every day`
 * `due:`/`by` marks a deadline; a bare date is the planned working day.
 */
export function parseQuickCapture(input: string, today: string): QuickCapture {
  let s = ` ${input} `;
  const out: QuickCapture = { title: "", priority: 0, tags: [], recurrence: "none" };

  s = s.replace(/\s!(high|h|3)\b/i, () => { out.priority = 3; return " "; })
       .replace(/\s!(med|medium|m|2)\b/i, () => { out.priority = 2; return " "; })
       .replace(/\s!(low|l|1)\b/i, () => { out.priority = 1; return " "; });
  s = s.replace(/\s#([\w-]+)/g, (_, t) => { out.tags.push(t.toLowerCase()); return " "; });
  s = s.replace(/\s@([\w-]+)/, (_, p) => { out.project = p; return " "; });
  s = s.replace(/\severy\s+(day|weekday|week|month)s?\b/i, (_, k: string) => {
    out.recurrence = ({ day: "daily", weekday: "weekdays", week: "weekly", month: "monthly" } as const)[k.toLowerCase() as "day"];
    return " ";
  });
  s = s.replace(/\s(\d{1,3})\s?(m|min|mins|h|hr|hrs)\b/i, (_, n: string, u: string) => {
    out.durationMin = /^h/i.test(u) ? Number(n) * 60 : Number(n); return " ";
  });

  // deadline: "by <date>" / "due <date>"
  const dueMatch = s.match(/\s(?:by|due)\s+(.+?)(?=\s(?:at|on)\s|$)/i);
  if (dueMatch) {
    const p = parseNaturalDate(dueMatch[1], today);
    if (p.date) { out.due = p.date; s = s.replace(dueMatch[0], " " + p.rest + " "); }
  }
  const p = parseNaturalDate(s, today);
  if (p.date) out.plannedDate = p.date;
  if (p.time) { out.plannedStart = p.time; if (!out.plannedDate) out.plannedDate = today; }
  out.title = p.rest.replace(/\s+/g, " ").trim();
  return out;
}

export function nextOccurrence(from: string, rec: Recurrence): string | undefined {
  switch (rec) {
    case "daily": return addDays(from, 1);
    case "weekly": return addDays(from, 7);
    case "monthly": return addMonths(from, 1);
    case "weekdays": {
      let n = addDays(from, 1);
      while (weekday(n) === 0 || weekday(n) === 6) n = addDays(n, 1);
      return n;
    }
    default: return undefined;
  }
}

export type Bucket = "overdue" | "today" | "upcoming" | "unscheduled" | "done";

/** Where a task sits for "today". Overdue = deadline passed OR planned day passed and still open. */
export function bucketOf(t: Task, today: string): Bucket {
  if (t.status === "done" || t.status === "dropped") return "done";
  if (t.due && t.due < today) return "overdue";
  if (t.plannedDate && t.plannedDate < today) return "overdue";
  if (t.plannedDate === today || t.due === today) return "today";
  if (t.plannedDate || t.due) return "upcoming";
  return "unscheduled";
}

export function sortTasks(list: Task[]): Task[] {
  return [...list].sort((a, b) =>
    (b.priority - a.priority) ||
    ((a.plannedStart ?? "99:99").localeCompare(b.plannedStart ?? "99:99")) ||
    ((a.due ?? "9999").localeCompare(b.due ?? "9999")) ||
    a.createdAt.localeCompare(b.createdAt));
}

export function newTask(partial: Partial<Task> & { title: string }, now: Date = new Date()): Task {
  const iso = now.toISOString();
  return {
    id: `t_${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    status: "todo", priority: 0, recurrence: "none", source: "cc", tags: [],
    createdAt: iso, updatedAt: iso, history: [{ at: iso, text: "Created" }],
    ...partial,
  };
}

/**
 * Complete a task. Recurring tasks spawn the next instance (returned as `next`)
 * anchored on the planned/due date so a late completion does not drift the schedule.
 */
export function completeTask(t: Task, now: Date = new Date()): { done: Task; next?: Task } {
  const iso = now.toISOString();
  const done: Task = { ...t, status: "done", completedAt: iso, updatedAt: iso, history: [...t.history, { at: iso, text: "Completed" }] };
  if (t.recurrence === "none") return { done };
  const anchor = t.plannedDate ?? t.due ?? dateInTZ(now);
  const nd = nextOccurrence(anchor, t.recurrence);
  if (!nd) return { done };
  const shift = (d?: string) => (d ? nextOccurrence(d, t.recurrence) : undefined);
  const fresh = newTask({ title: t.title }, new Date(now.getTime() + 1));
  const next: Task = {
    ...t, id: fresh.id, status: "todo", completedAt: undefined,
    plannedDate: t.plannedDate ? nd : undefined,
    due: t.due ? (t.plannedDate ? shift(t.due) : nd) : undefined,
    createdAt: fresh.createdAt, updatedAt: fresh.updatedAt, history: fresh.history,
  };
  return { done, next };
}

export interface DayPlan { scheduledMin: number; items: Task[]; free: boolean }

/** Total planned minutes for a day; used to warn on over-booking in Plan-my-day. */
export function plannedLoad(tasks: Task[], day: string): DayPlan {
  const items = tasks.filter((t) => t.plannedDate === day && t.status !== "done" && t.status !== "dropped");
  const scheduledMin = items.reduce((n, t) => n + (t.durationMin ?? 0), 0);
  return { items, scheduledMin, free: scheduledMin < 8 * 60 };
}

/** Explicit reschedule only — never called implicitly. */
export function reschedule(t: Task, plannedDate: string | undefined, now: Date = new Date()): Task {
  const iso = now.toISOString();
  return { ...t, plannedDate, plannedStart: plannedDate ? t.plannedStart : undefined, updatedAt: iso,
    history: [...t.history, { at: iso, text: plannedDate ? `Planned for ${plannedDate}` : "Unscheduled" }] };
}
