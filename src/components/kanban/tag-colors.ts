import type { TagColor } from "@/types/kanban";

export const TAG_COLORS: Record<TagColor, { bg: string; text: string }> = {
  blue:   { bg: "rgba(59,130,246,0.15)",  text: "#3b82f6" },
  green:  { bg: "rgba(34,197,94,0.15)",   text: "#22c55e" },
  orange: { bg: "rgba(249,115,22,0.15)",  text: "#f97316" },
  red:    { bg: "rgba(239,68,68,0.15)",   text: "#ef4444" },
  purple: { bg: "rgba(168,85,247,0.15)",  text: "#a855f7" },
  gray:   { bg: "rgba(113,113,122,0.15)", text: "#71717a" },
  pink:   { bg: "rgba(236,72,153,0.15)",  text: "#ec4899" },
  yellow: { bg: "rgba(234,179,8,0.15)",   text: "#ca8a04" },
};

export const TAG_COLOR_OPTIONS: TagColor[] = [
  "blue", "green", "orange", "red", "purple", "gray", "pink", "yellow",
];

export const PRIORITY_CONFIG = {
  low:    { label: "Low",    color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  medium: { label: "Medium", color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  high:   { label: "High",   color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
} as const;

export const DELIVERABLE_CONFIG: Record<string, { icon: string; color: string }> = {
  Reel:     { icon: "🎞️", color: "#a855f7" },
  YouTube:  { icon: "▶️", color: "#ef4444" },
  Ad:       { icon: "📢", color: "#f97316" },
  Post:     { icon: "📸", color: "#3b82f6" },
  Story:    { icon: "⚡", color: "#eab308" },
  Podcast:  { icon: "🎙️", color: "#22c55e" },
  Blog:     { icon: "✍️", color: "#0891b2" },
  Short:    { icon: "📱", color: "#ec4899" },
};
