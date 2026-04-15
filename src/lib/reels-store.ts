"use client";
import { useState, useEffect, useCallback } from "react";

export interface ReelEntry {
  id: string;
  name: string;
}

const KEY = "studio-daily-reels";

function read(): Record<string, ReelEntry[]> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
}

function write(data: Record<string, ReelEntry[]>) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function useReelsStore() {
  const [reels, setReels] = useState<Record<string, ReelEntry[]>>({});

  useEffect(() => { setReels(read()); }, []);

  const addReel = useCallback((date: string, name: string) => {
    setReels((prev) => {
      const entry: ReelEntry = { id: `${Date.now()}`, name: name.trim() };
      const next = { ...prev, [date]: [...(prev[date] ?? []), entry] };
      write(next);
      return next;
    });
  }, []);

  const removeReel = useCallback((date: string, id: string) => {
    setReels((prev) => {
      const next = { ...prev, [date]: (prev[date] ?? []).filter((r) => r.id !== id) };
      write(next);
      return next;
    });
  }, []);

  const getReels = useCallback((date: string): ReelEntry[] => {
    return reels[date] ?? [];
  }, [reels]);

  return { reels, addReel, removeReel, getReels };
}
