"use client";
import { useState, useEffect, useCallback, useRef } from "react";

export interface ReelEntry {
  id: string;
  name: string;
}

const KEY = "studio-daily-reels";

function read(): Record<string, ReelEntry[]> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
}

/** Read current reels from localStorage — usable outside React components */
export function getLocalReels(): Record<string, ReelEntry[]> {
  return read();
}

function write(data: Record<string, ReelEntry[]>) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

// ── Cloud sync helpers (fire-and-forget) ────────────────────────────────────

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function pushToCloud(data: Record<string, ReelEntry[]>) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    fetch("/api/sync/reels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => {/* fire-and-forget */});
  }, 1500);
}

/**
 * Called by CloudSync to overlay cloud data into localStorage and trigger a
 * React re-render. We can't call useState setter from outside a component,
 * so we use a simple callback registry.
 */
type ReelsListener = (data: Record<string, ReelEntry[]>) => void;
const listeners = new Set<ReelsListener>();

export function setReelsFromCloud(incoming: Record<string, ReelEntry[]>) {
  // Cloud is always the authoritative source — replace local entirely
  write(incoming);
  listeners.forEach((fn) => fn(incoming));
}

export function useReelsStore() {
  const [reels, setReels] = useState<Record<string, ReelEntry[]>>({});
  const initialized = useRef(false);

  // On mount: load localStorage, then fetch cloud and merge
  useEffect(() => {
    const local = read();
    setReels(local);

    // Register as listener so setReelsFromCloud can push updates
    listeners.add(setReels);

    // Fetch cloud on first mount
    if (!initialized.current) {
      initialized.current = true;
      fetch("/api/sync/reels")
        .then((r) => r.ok ? r.json() : null)
        .then((envelope) => {
          if (envelope?.data && typeof envelope.data === "object") {
            setReelsFromCloud(envelope.data as Record<string, ReelEntry[]>);
          }
        })
        .catch(() => {/* ignore — offline or unauthenticated */});
    }

    return () => { listeners.delete(setReels); };
  }, []);

  const addReel = useCallback((date: string, name: string) => {
    setReels((prev) => {
      const entry: ReelEntry = { id: `${Date.now()}`, name: name.trim() };
      const next = { ...prev, [date]: [...(prev[date] ?? []), entry] };
      write(next);
      pushToCloud(next);
      return next;
    });
  }, []);

  const removeReel = useCallback((date: string, id: string) => {
    setReels((prev) => {
      const next = { ...prev, [date]: (prev[date] ?? []).filter((r) => r.id !== id) };
      write(next);
      pushToCloud(next);
      return next;
    });
  }, []);

  const renameReel = useCallback((date: string, id: string, name: string) => {
    setReels((prev) => {
      const next = {
        ...prev,
        [date]: (prev[date] ?? []).map((r) => r.id === id ? { ...r, name: name.trim() || r.name } : r),
      };
      write(next);
      pushToCloud(next);
      return next;
    });
  }, []);

  const getReels = useCallback((date: string): ReelEntry[] => {
    return reels[date] ?? [];
  }, [reels]);

  const getAllReels = useCallback(() => reels, [reels]);

  return { reels, addReel, removeReel, renameReel, getReels, getAllReels };
}
