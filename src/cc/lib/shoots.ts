/** Production (To Shoot) records: statuses, readiness, and calendar projection. Dependency-free. */

export const DEFAULT_STATUSES = [
  "Idea", "Brief Needed", "Ready to Shoot", "Scheduled", "Shot", "In Editing",
  "Internal Review", "Client Review", "Approved", "Published", "On Hold",
] as const;

export type ShootStatus = string;

export interface ChecklistItem { id: string; text: string; done: boolean; group: "prep" | "gear" | "post" }

export interface Shoot {
  id: string;
  title: string;
  status: ShootStatus;
  client?: string;
  brand?: string;
  campaign?: string;
  deliverableId?: string; // reference to the sheet-owned deliverable; never a copy
  platform?: string;
  format?: string;
  category?: string;
  priority: 0 | 1 | 2 | 3;
  shootDate?: string;
  shootTime?: string;
  location?: string;
  talent?: string;
  poc?: string;
  owner?: string;
  script?: string;
  brief?: string;
  references: { label: string; url: string }[];
  assets: { label: string; url: string }[];
  checklist: ChecklistItem[];
  requirements?: string;
  instructions?: string;
  publishDeadline?: string;
  notes?: string;
  taskIds: string[];
  createdAt: string;
  updatedAt: string;
  history: { at: string; text: string }[];
}

export const BASE_CHECKLIST: Omit<ChecklistItem, "id">[] = [
  { text: "Brief approved", done: false, group: "prep" },
  { text: "Script locked", done: false, group: "prep" },
  { text: "Location confirmed", done: false, group: "prep" },
  { text: "Talent / host confirmed", done: false, group: "prep" },
  { text: "Props & product received", done: false, group: "prep" },
  { text: "Camera, lenses, batteries charged", done: false, group: "gear" },
  { text: "Audio (lav + backup) tested", done: false, group: "gear" },
  { text: "Lights & stands packed", done: false, group: "gear" },
  { text: "Cards formatted, backup drive", done: false, group: "gear" },
  { text: "Footage backed up", done: false, group: "post" },
  { text: "Handed to editor", done: false, group: "post" },
];

export function newShoot(partial: Partial<Shoot> & { title: string }, now: Date = new Date()): Shoot {
  const iso = now.toISOString();
  const id = `s_${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return {
    status: "Idea", priority: 0, references: [], assets: [], taskIds: [],
    checklist: BASE_CHECKLIST.map((c, i) => ({ ...c, id: `${id}_c${i}` })),
    createdAt: iso, updatedAt: iso, history: [{ at: iso, text: "Created" }],
    ...partial, id,
  };
}

/** What still blocks a shoot from being "Ready". Used on cards and in the Home production strip. */
export function readiness(s: Shoot): { ready: boolean; missing: string[]; pct: number } {
  const missing: string[] = [];
  if (!s.brief && !s.script) missing.push("brief or script");
  if (!s.shootDate) missing.push("shoot date");
  if (!s.location) missing.push("location");
  const prep = s.checklist.filter((c) => c.group !== "post");
  const open = prep.filter((c) => !c.done).length;
  if (open) missing.push(`${open} checklist item${open > 1 ? "s" : ""}`);
  const pct = prep.length ? Math.round(((prep.length - open) / prep.length) * 100) : 0;
  return { ready: missing.length === 0, missing, pct };
}

export interface CalEntry { date: string; kind: "shoot" | "publish"; shootId: string; title: string; time?: string }

export function calendarEntries(shoots: Shoot[]): CalEntry[] {
  const out: CalEntry[] = [];
  for (const s of shoots) {
    if (s.shootDate) out.push({ date: s.shootDate, kind: "shoot", shootId: s.id, title: s.title, time: s.shootTime });
    if (s.publishDeadline) out.push({ date: s.publishDeadline, kind: "publish", shootId: s.id, title: s.title });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
}

export function moveShoot(s: Shoot, status: ShootStatus, now: Date = new Date()): Shoot {
  if (s.status === status) return s;
  const iso = now.toISOString();
  return { ...s, status, updatedAt: iso, history: [...s.history, { at: iso, text: `${s.status} → ${status}` }] };
}

/** Next upcoming shoot on/after `today` that is not yet shot. */
export function nextShoot(shoots: Shoot[], today: string): Shoot | undefined {
  return shoots
    .filter((s) => s.shootDate && s.shootDate >= today && !["Shot", "In Editing", "Internal Review", "Client Review", "Approved", "Published", "On Hold"].includes(s.status))
    .sort((a, b) => (a.shootDate! + (a.shootTime ?? "")).localeCompare(b.shootDate! + (b.shootTime ?? "")))[0];
}
