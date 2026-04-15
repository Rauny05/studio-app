export type TagColor =
  | "blue"
  | "green"
  | "orange"
  | "red"
  | "purple"
  | "gray"
  | "pink"
  | "yellow";

export type Tag = {
  id: string;
  label: string;
  color: TagColor;
};

export type Priority = "low" | "medium" | "high";

export type DeliverableType =
  | "Reel"
  | "YouTube"
  | "Ad"
  | "Post"
  | "Story"
  | "Podcast"
  | "Blog"
  | "Short";

export type Card = {
  id: string;
  columnId: string;
  boardId: string;
  title: string;
  description: string; // script / content body
  deliverableType: DeliverableType | null;
  thumbnailUrl: string | null;
  videoLink: string | null;
  tags: Tag[];
  priority: Priority;
  dueDate: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Column = {
  id: string;
  title: string;
  cardIds: string[];
};

export type Board = {
  id: string;
  title: string;
  description: string;
  color: string; // hex accent
  emoji: string;
  thumbnailUrl?: string; // base64 or image URL
  columnIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type BoardColor = {
  label: string;
  value: string;
};

export const BOARD_COLORS: BoardColor[] = [
  { label: "Violet", value: "#7c3aed" },
  { label: "Blue", value: "#2563eb" },
  { label: "Cyan", value: "#0891b2" },
  { label: "Green", value: "#059669" },
  { label: "Amber", value: "#d97706" },
  { label: "Rose", value: "#e11d48" },
  { label: "Pink", value: "#db2777" },
  { label: "Orange", value: "#ea580c" },
];
