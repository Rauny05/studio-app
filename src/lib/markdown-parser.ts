import matter from "gray-matter";
import type { Board, Card } from "@/types/kanban";

export function serializeCard(card: Card, columnTitle: string): string {
  const frontmatter = {
    id: card.id,
    title: card.title,
    status: columnTitle,
    deliverable: card.deliverableType || "",
    thumbnail: card.thumbnailUrl || "",
    videoLink: card.videoLink || "",
    priority: card.priority,
    dueDate: card.dueDate || "",
    tags: card.tags.map((t) => ({ id: t.id, label: t.label, color: t.color })),
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  };

  const body = `\n## Script\n${card.description ?? ""}\n\n## Notes\n${card.notes ?? ""}`;
  return matter.stringify(body, frontmatter);
}

export function parseCardWithStatus(
  fileContent: string,
  boardId: string,
  columnId: string
): { card: Card; status: string } {
  const { data, content } = matter(fileContent);

  // Extract ## Script section
  const scriptMatch = content.match(/##\s+Script\n([\s\S]*?)(?=\n##\s|\s*$)/);
  const description = scriptMatch ? scriptMatch[1].trim() : "";

  // Extract ## Notes section
  const notesMatch = content.match(/##\s+Notes\n([\s\S]*?)(?=\n##\s|\s*$)/);
  const notes = notesMatch ? notesMatch[1].trim() : "";

  const status = typeof data.status === "string" ? data.status : "Ideas";

  const card: Card = {
    id: data.id || Math.random().toString(36).slice(2, 10),
    columnId,
    boardId,
    title: data.title || "",
    description,
    deliverableType: data.deliverable || null,
    thumbnailUrl: data.thumbnail || null,
    videoLink: data.videoLink || null,
    priority: data.priority || "medium",
    dueDate: data.dueDate || null,
    tags: Array.isArray(data.tags) ? data.tags : [],
    notes,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
  };

  return { card, status };
}

export function parseCard(
  fileContent: string,
  boardId: string,
  columnId: string
): Card {
  return parseCardWithStatus(fileContent, boardId, columnId).card;
}

export function serializeBoard(board: Board, columnOrder: string[]): string {
  const frontmatter = {
    id: board.id,
    title: board.title,
    description: board.description,
    color: board.color,
    emoji: board.emoji,
    columnOrder,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
  };
  return matter.stringify("", frontmatter);
}

export function parseBoard(
  fileContent: string
): { board: Partial<Board>; columnOrder: string[] } {
  const { data } = matter(fileContent);

  const board: Partial<Board> = {
    id: data.id,
    title: data.title,
    description: data.description || "",
    color: data.color || "#7c3aed",
    emoji: data.emoji || "📋",
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };

  const columnOrder = Array.isArray(data.columnOrder)
    ? data.columnOrder
    : ["Ideas", "Writing", "Production", "Editing", "Published"];

  return { board, columnOrder };
}
