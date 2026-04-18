import { create } from "zustand";
import { persist } from "zustand/middleware";

export const PLATFORMS = ["YouTube", "Reels", "Shorts", "Long-form", "Podcast", "Other"] as const;
export type Platform = typeof PLATFORMS[number];

export type VideoPriority = 1 | 2 | 3;

export interface PriorityVideo {
  id: string;
  title: string;
  priority: VideoPriority;
  platform?: Platform | "";
  notes?: string;
  completed: boolean;
  createdAt: string;
}

interface PriorityVideosStore {
  videos: PriorityVideo[];
  addVideo: (v: Omit<PriorityVideo, "id" | "createdAt" | "completed">) => void;
  updateVideo: (id: string, updates: Partial<Omit<PriorityVideo, "id" | "createdAt">>) => void;
  deleteVideo: (id: string) => void;
  toggleDone: (id: string) => void;
  moveUp: (id: string) => void;
  moveDown: (id: string) => void;
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export const usePriorityVideosStore = create<PriorityVideosStore>()(
  persist(
    (set) => ({
      videos: [],

      addVideo: (v) =>
        set((s) => ({
          videos: [
            ...s.videos,
            { ...v, id: uid(), completed: false, createdAt: new Date().toISOString() },
          ],
        })),

      updateVideo: (id, updates) =>
        set((s) => ({
          videos: s.videos.map((v) => (v.id === id ? { ...v, ...updates } : v)),
        })),

      deleteVideo: (id) =>
        set((s) => ({ videos: s.videos.filter((v) => v.id !== id) })),

      toggleDone: (id) =>
        set((s) => ({
          videos: s.videos.map((v) => (v.id === id ? { ...v, completed: !v.completed } : v)),
        })),

      moveUp: (id) =>
        set((s) => {
          const idx = s.videos.findIndex((v) => v.id === id);
          if (idx <= 0) return s;
          const arr = [...s.videos];
          [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
          return { videos: arr };
        }),

      moveDown: (id) =>
        set((s) => {
          const idx = s.videos.findIndex((v) => v.id === id);
          if (idx < 0 || idx >= s.videos.length - 1) return s;
          const arr = [...s.videos];
          [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
          return { videos: arr };
        }),
    }),
    { name: "studio-priority-videos-v1", skipHydration: true }
  )
);
