"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { completeTask, reschedule as rescheduleTask, type Task } from "../lib/planner";
import { DEFAULT_STATUSES, moveShoot, type Shoot } from "../lib/shoots";

const stamp = () => new Date().toISOString();

/* ---------- Tasks ---------- */
interface TaskState {
  tasks: Task[];
  rev: string;
  add: (t: Task) => void;
  update: (id: string, patch: Partial<Task>) => void;
  remove: (id: string) => Task | undefined;
  restore: (t: Task) => void;
  complete: (id: string) => void;
  reopen: (id: string) => void;
  reschedule: (id: string, date?: string) => void;
  replace: (tasks: Task[], rev: string) => void;
}
export const useTasks = create<TaskState>()(persist((set, get) => ({
  tasks: [], rev: "",
  add: (t) => set((s) => ({ tasks: [t, ...s.tasks], rev: stamp() })),
  update: (id, patch) => set((s) => ({ rev: stamp(), tasks: s.tasks.map((t) => t.id === id
    ? { ...t, ...patch, updatedAt: stamp(), history: [...t.history, { at: stamp(), text: `Edited ${Object.keys(patch).join(", ")}` }] } : t) })),
  remove: (id) => { const t = get().tasks.find((x) => x.id === id); set((s) => ({ tasks: s.tasks.filter((x) => x.id !== id), rev: stamp() })); return t; },
  restore: (t) => set((s) => s.tasks.some((x) => x.id === t.id) ? s : { tasks: [t, ...s.tasks], rev: stamp() }),
  complete: (id) => set((s) => {
    const t = s.tasks.find((x) => x.id === id); if (!t) return s;
    const { done, next } = completeTask(t);
    return { rev: stamp(), tasks: [...(next ? [next] : []), ...s.tasks.map((x) => (x.id === id ? done : x))] };
  }),
  reopen: (id) => set((s) => ({ rev: stamp(), tasks: s.tasks.map((t) => t.id === id
    ? { ...t, status: "todo", completedAt: undefined, updatedAt: stamp(), history: [...t.history, { at: stamp(), text: "Reopened" }] } : t) })),
  reschedule: (id, date) => set((s) => ({ rev: stamp(), tasks: s.tasks.map((t) => (t.id === id ? rescheduleTask(t, date) : t)) })),
  replace: (tasks, rev) => set({ tasks, rev }),
}), { name: "cc-tasks-v1", skipHydration: true, partialize: (s) => ({ tasks: s.tasks, rev: s.rev }) }));

/* ---------- Shoots ---------- */
interface ShootState {
  shoots: Shoot[];
  statuses: string[];
  rev: string;
  add: (s: Shoot) => void;
  update: (id: string, patch: Partial<Shoot>) => void;
  remove: (id: string) => Shoot | undefined;
  restore: (s: Shoot) => void;
  move: (id: string, status: string) => void;
  setStatuses: (s: string[]) => void;
  replace: (shoots: Shoot[], statuses: string[], rev: string) => void;
}
export const useShoots = create<ShootState>()(persist((set, get) => ({
  shoots: [], statuses: [...DEFAULT_STATUSES], rev: "",
  add: (s) => set((st) => ({ shoots: [s, ...st.shoots], rev: stamp() })),
  update: (id, patch) => set((st) => ({ rev: stamp(), shoots: st.shoots.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: stamp() } : x)) })),
  remove: (id) => { const s = get().shoots.find((x) => x.id === id); set((st) => ({ shoots: st.shoots.filter((x) => x.id !== id), rev: stamp() })); return s; },
  restore: (s) => set((st) => st.shoots.some((x) => x.id === s.id) ? st : { shoots: [s, ...st.shoots], rev: stamp() }),
  move: (id, status) => set((st) => ({ rev: stamp(), shoots: st.shoots.map((x) => (x.id === id ? moveShoot(x, status) : x)) })),
  setStatuses: (statuses) => set({ statuses, rev: stamp() }),
  replace: (shoots, statuses, rev) => set({ shoots, statuses, rev }),
}), { name: "cc-shoots-v1", skipHydration: true, partialize: (s) => ({ shoots: s.shoots, statuses: s.statuses, rev: s.rev }) }));

/* ---------- Preferences ---------- */
export type WidgetId = "myday" | "production" | "activity" | "schedule" | "inbox" | "pulse" | "apps" | "briefing";
/** Home sections. Columns: a = today's work, b = production + email, c = studio context. */
export const ALL_WIDGETS: { id: WidgetId; label: string; column: "a" | "b" | "c" }[] = [
  { id: "myday", label: "My Day", column: "a" },
  { id: "schedule", label: "Upcoming", column: "a" },
  { id: "production", label: "To Shoot", column: "b" },
  { id: "inbox", label: "Important email", column: "b" },
  { id: "briefing", label: "AI briefing", column: "c" },
  { id: "pulse", label: "Studio operations", column: "c" },
  { id: "apps", label: "Recent apps", column: "c" },
  { id: "activity", label: "Recent activity", column: "c" },
];
export interface Recent { kind: "app" | "task" | "shoot" | "route"; id: string; label: string; href: string; at: string }
export interface ActivityEvent { id: string; at: string; text: string; href?: string }

interface PrefState {
  sidebarCollapsed: boolean;
  theme: "dark" | "light";
  widgetOrder: WidgetId[];
  widgetHidden: WidgetId[];
  favorites: string[];
  recents: Recent[];
  recentSearches: string[];
  activity: ActivityEvent[];
  aiConsent: { gmail: boolean; tasks: boolean; studio: boolean };
  rev: string;
  set: (p: Partial<PrefState>) => void;
  toggleSidebar: () => void;
  toggleWidget: (id: WidgetId) => void;
  moveWidget: (id: WidgetId, dir: -1 | 1) => void;
  toggleFavorite: (id: string) => void;
  pushRecent: (r: Omit<Recent, "at">) => void;
  pushSearch: (q: string) => void;
  log: (text: string, href?: string) => void;
  replace: (p: Partial<PrefState>) => void;
}
export const usePrefs = create<PrefState>()(persist((set) => ({
  sidebarCollapsed: false, theme: "light",
  widgetOrder: ALL_WIDGETS.map((w) => w.id), widgetHidden: [],
  favorites: [], recents: [], recentSearches: [], activity: [],
  aiConsent: { gmail: false, tasks: false, studio: false }, rev: "",
  set: (p) => set({ ...p, rev: stamp() }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed, rev: stamp() })),
  toggleWidget: (id) => set((s) => ({ rev: stamp(), widgetHidden: s.widgetHidden.includes(id) ? s.widgetHidden.filter((x) => x !== id) : [...s.widgetHidden, id] })),
  moveWidget: (id, dir) => set((s) => {
    const col = ALL_WIDGETS.find((w) => w.id === id)?.column;
    const ids = s.widgetOrder.filter((w) => ALL_WIDGETS.find((a) => a.id === w)?.column === col);
    const i = ids.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return s;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const others = s.widgetOrder.filter((w) => ALL_WIDGETS.find((a) => a.id === w)?.column !== col);
    return { widgetOrder: [...others, ...ids], rev: stamp() };
  }),
  toggleFavorite: (id) => set((s) => ({ rev: stamp(), favorites: s.favorites.includes(id) ? s.favorites.filter((x) => x !== id) : [...s.favorites, id] })),
  pushRecent: (r) => set((s) => ({ rev: stamp(), recents: [{ ...r, at: stamp() }, ...s.recents.filter((x) => !(x.kind === r.kind && x.id === r.id))].slice(0, 20) })),
  pushSearch: (q) => set((s) => ({ rev: stamp(), recentSearches: [q, ...s.recentSearches.filter((x) => x !== q)].slice(0, 8) })),
  log: (text, href) => set((s) => ({ rev: stamp(), activity: [{ id: Math.random().toString(36).slice(2), at: stamp(), text, href }, ...s.activity].slice(0, 60) })),
  replace: (p) => set(p),
}), { name: "cc-prefs-v1", version: 2, skipHydration: true,
  // v2 redesign: light theme by default and a new home layout, so reset both once (favorites/activity are kept).
  migrate: (st, v) => (v < 2 ? { ...(st as object), theme: "light", widgetOrder: ALL_WIDGETS.map((w) => w.id), widgetHidden: [], rev: stamp() } : st) as never,
  partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed, theme: s.theme, widgetOrder: s.widgetOrder, widgetHidden: s.widgetHidden,
    favorites: s.favorites, recents: s.recents, recentSearches: s.recentSearches, activity: s.activity, aiConsent: s.aiConsent, rev: s.rev }) }));

/* ---------- Application registry overlay ---------- */
export interface AppRecord {
  id: string; name: string; description: string; category: string; url: string | null; path: string | null;
  framework: string | null; integration: "native" | "api" | "embed" | "external" | "investigate";
  role?: string; status?: string; healthUrl?: string | null; localOnly?: boolean; custom?: boolean;
  /** "app" is shown in RM Studio; "host" is RM Studio itself; "excluded" is a project that is not an operable app (portfolio, bot, mobile-only…). */
  kind?: "app" | "host" | "excluded"; excludeReason?: string;
}
interface AppState {
  custom: AppRecord[];
  overrides: Record<string, Partial<AppRecord>>;
  lastOpened: Record<string, string>;
  rev: string;
  addApp: (a: AppRecord) => void;
  patchApp: (id: string, p: Partial<AppRecord>) => void;
  removeApp: (id: string) => void;
  markOpened: (id: string) => void;
  replace: (p: Partial<Pick<AppState, "custom" | "overrides" | "lastOpened">> & { rev: string }) => void;
}
export const useApps = create<AppState>()(persist((set) => ({
  custom: [], overrides: {}, lastOpened: {}, rev: "",
  addApp: (a) => set((s) => ({ custom: [...s.custom, { ...a, custom: true }], rev: stamp() })),
  patchApp: (id, p) => set((s) => s.custom.some((c) => c.id === id)
    ? { custom: s.custom.map((c) => (c.id === id ? { ...c, ...p } : c)), rev: stamp() }
    : { overrides: { ...s.overrides, [id]: { ...s.overrides[id], ...p } }, rev: stamp() }),
  removeApp: (id) => set((s) => ({ custom: s.custom.filter((c) => c.id !== id), rev: stamp() })),
  markOpened: (id) => set((s) => ({ lastOpened: { ...s.lastOpened, [id]: stamp() }, rev: stamp() })),
  replace: (p) => set(p),
}), { name: "cc-apps-v1", skipHydration: true, partialize: (s) => ({ custom: s.custom, overrides: s.overrides, lastOpened: s.lastOpened, rev: s.rev }) }));
