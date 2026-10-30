"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { useApps, usePrefs, useShoots, useTasks } from "./stores";

export const useSyncStatus = create<{ state: "booting" | "synced" | "local" | "error" }>(() => ({ state: "booting" }));

type Env = { data: Record<string, unknown> & { rev?: string }; updatedAt: string } | null;

interface Binding { key: string; pick: () => Record<string, unknown>; apply: (d: Record<string, unknown>) => void; sub: (cb: () => void) => () => void; rev: () => string }

const bindings: Binding[] = [
  { key: "tasks", pick: () => ({ tasks: useTasks.getState().tasks, rev: useTasks.getState().rev }),
    apply: (d) => useTasks.getState().replace((d.tasks as never) ?? [], (d.rev as string) ?? ""), sub: (cb) => useTasks.subscribe(cb), rev: () => useTasks.getState().rev },
  { key: "shoots", pick: () => ({ shoots: useShoots.getState().shoots, statuses: useShoots.getState().statuses, rev: useShoots.getState().rev }),
    apply: (d) => useShoots.getState().replace((d.shoots as never) ?? [], (d.statuses as string[]) ?? useShoots.getState().statuses, (d.rev as string) ?? ""), sub: (cb) => useShoots.subscribe(cb), rev: () => useShoots.getState().rev },
  { key: "prefs", pick: () => { const { sidebarCollapsed, theme, widgetOrder, widgetHidden, favorites, recents, recentSearches, activity, aiConsent, rev } = usePrefs.getState(); return { sidebarCollapsed, theme, widgetOrder, widgetHidden, favorites, recents, recentSearches, activity, aiConsent, rev }; },
    apply: (d) => usePrefs.getState().replace(d as never), sub: (cb) => usePrefs.subscribe(cb), rev: () => usePrefs.getState().rev },
  { key: "apps", pick: () => { const { custom, overrides, lastOpened, rev } = useApps.getState(); return { custom, overrides, lastOpened, rev }; },
    apply: (d) => useApps.getState().replace(d as never), sub: (cb) => useApps.subscribe(cb), rev: () => useApps.getState().rev },
];

/**
 * localStorage is the immediate store; the server copy (Redis / dev file) is reconciled by `rev` (last write wins).
 * If the server says not_configured the UI stays local-only and says so.
 */
export function useCloudSync() {
  useEffect(() => {
    let dead = false;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const unsubs: (() => void)[] = [];
    let serverOk = true;

    const push = async (b: Binding) => {
      if (!serverOk) return;
      try {
        const r = await fetch(`/api/cc/state/${b.key}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: b.pick() }) });
        if (r.status === 501) { serverOk = false; useSyncStatus.setState({ state: "local" }); }
        else if (!r.ok) useSyncStatus.setState({ state: "error" });
        else useSyncStatus.setState({ state: "synced" });
      } catch { useSyncStatus.setState({ state: "error" }); }
    };

    (async () => {
      for (const b of bindings) {
        try {
          const r = await fetch(`/api/cc/state/${b.key}`, { cache: "no-store" });
          if (r.status === 501) { serverOk = false; useSyncStatus.setState({ state: "local" }); break; }
          if (r.ok) {
            const { envelope } = (await r.json()) as { envelope: Env };
            const remoteRev = envelope?.data?.rev ?? "";
            if (envelope && remoteRev > b.rev()) b.apply(envelope.data);
            else if (b.rev() > remoteRev) await push(b);
          }
        } catch { useSyncStatus.setState({ state: "error" }); }
      }
      if (dead) return;
      if (serverOk) useSyncStatus.setState({ state: "synced" });
      for (const b of bindings) {
        let last = b.rev();
        unsubs.push(b.sub(() => {
          if (b.rev() === last) return;
          last = b.rev();
          clearTimeout(timers.get(b.key));
          timers.set(b.key, setTimeout(() => void push(b), 1200));
        }));
      }
    })();
    return () => { dead = true; unsubs.forEach((u) => u()); timers.forEach(clearTimeout); };
  }, []);
}
