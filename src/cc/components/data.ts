"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { create } from "zustand";
import { dateInTZ, timeInTZ } from "../lib/planner";
import type { ProbeResult } from "../lib/health";
import { useApps, type AppRecord } from "../store/stores";

export function useNow() {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(i); }, []);
  return { today: dateInTZ(now), time: timeInTZ(now), now };
}

/* ---------- Deliverables (owned by the Google Sheet; read-only here) ---------- */
export interface Deliverable {
  id: string; pnNo: string; brand: string; poc: string; pocName: string; pocCompany: string;
  deliverables: { label: string; status: "Pending" | "Completed" }[];
  advance50: boolean; payment100: boolean; paymentStep: number; overallStatus: string; goLiveDate?: string; month: string; note: string;
}
let dlCache: { at: number; rows: Deliverable[] } | null = null;
export function useDeliverables() {
  const [rows, setRows] = useState<Deliverable[]>(dlCache?.rows ?? []);
  const [loading, setLoading] = useState(!dlCache);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (force = false) => {
    if (!force && dlCache && Date.now() - dlCache.at < 120_000) return;
    setLoading(true);
    try {
      const r = await fetch("/api/deliverables", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as { deliverables?: Deliverable[] };
      dlCache = { at: Date.now(), rows: j.deliverables ?? [] };
      setRows(dlCache.rows); setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : "failed"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { rows, loading, error, reload: () => load(true) };
}

/* ---------- Apps registry + health ---------- */
export type AppHealth = ProbeResult & { checkedAt: string };
interface HealthState { results: Record<string, AppHealth>; checking: boolean; check: (apps: AppRecord[]) => Promise<void> }
export const useHealth = create<HealthState>((set) => ({
  results: {}, checking: false,
  check: async (apps) => {
    set({ checking: true });
    try {
      const r = await fetch("/api/cc/health", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ apps: apps.map((a) => ({ id: a.id, url: a.healthUrl ?? a.url, localOnly: a.localOnly })) }) });
      if (r.ok) { const j = (await r.json()) as { results: Record<string, AppHealth> }; set((s) => ({ results: { ...s.results, ...j.results } })); }
    } finally { set({ checking: false }); }
  },
}));

let seedCache: AppRecord[] | null = null;
let seedPromise: Promise<AppRecord[]> | null = null;
/** One shared request: every hook instance awaits it, so a second mount can never miss the result. */
const loadSeed = () => (seedPromise ??= fetch("/api/cc/apps").then((r) => r.json()).then((j: { apps: AppRecord[] }) => (seedCache = j.apps)).catch(() => { seedPromise = null; return [] as AppRecord[]; }));
export function useAppRegistry() {
  const { custom, overrides } = useApps();
  const [seed, setSeed] = useState<AppRecord[]>(seedCache ?? []);
  const [loading, setLoading] = useState(!seedCache);
  useEffect(() => {
    let live = true;
    void loadSeed().then((a) => { if (live) { setSeed(a); setLoading(false); } });
    return () => { live = false; };
  }, []);
  const all = useMemo(() => [...seed.map((a) => ({ ...a, ...overrides[a.id] })), ...custom], [seed, overrides, custom]);
  // Only operable applications appear anywhere in the UI; user-added entries count as apps.
  const apps = useMemo(() => all.filter((a) => (a.kind ?? "app") === "app"), [all]);
  return { apps, all, loading };
}

/* ---------- Generic connector fetch (Gmail / Calendar) ---------- */
export function useConnector<T extends { conn?: string }>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!url) return;
    let live = true;
    setLoading(true);
    fetch(url, { cache: "no-store" }).then((r) => r.json()).then((j: T) => live && setData(j))
      .catch(() => live && setData({ conn: "error" } as T)).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [url, tick]);
  return { data, loading, reload: () => setTick((t) => t + 1) };
}
