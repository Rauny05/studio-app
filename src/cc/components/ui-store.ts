"use client";
import type { ReactNode } from "react";
import { create } from "zustand";

export type CaptureKind = "task" | "shoot" | "idea" | "note" | "reminder";
export const useUI = create<{
  headerExtra: ReactNode; setHeaderExtra: (n: ReactNode) => void;
  palette: boolean; capture: CaptureKind | null; drawer: boolean; captureText: string;
  setPalette: (o: boolean) => void; openCapture: (k?: CaptureKind, text?: string) => void; closeCapture: () => void; setDrawer: (o: boolean) => void;
}>((set) => ({
  headerExtra: null, setHeaderExtra: (headerExtra) => set({ headerExtra }),
  palette: false, capture: null, drawer: false, captureText: "",
  setPalette: (palette) => set({ palette }),
  openCapture: (k = "task", text = "") => set({ capture: k, captureText: text, palette: false }),
  closeCapture: () => set({ capture: null }),
  setDrawer: (drawer) => set({ drawer }),
}));
