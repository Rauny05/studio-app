import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getProjectsDir, slugify } from "@/lib/vault-service";
import { parseCardWithStatus, parseBoard } from "@/lib/markdown-parser";
import type { Board, Column, Card } from "@/types/kanban";

type ColumnMap = Record<string, Column>;
type CardMap = Record<string, Card>;

export async function GET() {
  const projectsDir = getProjectsDir();
  if (!projectsDir || !fs.existsSync(projectsDir)) {
    return NextResponse.json({ error: "Vault not configured" }, { status: 404 });
  }

  const boards: Board[] = [];
  const columns: ColumnMap = {};
  const cards: CardMap = {};

  const boardDirs = fs
    .readdirSync(projectsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const boardDir of boardDirs) {
    const boardPath = path.join(projectsDir, boardDir);
    const boardFilePath = path.join(boardPath, "_board.md");

    // Skip directories that have no _board.md and no card files — they're mid-creation
    const mdFiles = fs.readdirSync(boardPath).filter((f) => f.endsWith(".md"));
    if (mdFiles.length === 0) continue;

    let boardId = `board-${slugify(boardDir)}`;
    let boardTitle = boardDir;
    let boardData: Partial<Board> = {};
    let columnOrder = ["Ideas", "Writing", "Production", "Editing", "Published"];

    if (fs.existsSync(boardFilePath)) {
      const content = fs.readFileSync(boardFilePath, "utf8");
      const parsed = parseBoard(content);
      boardId = parsed.board.id || boardId;
      boardTitle = parsed.board.title || boardTitle;
      boardData = parsed.board;
      columnOrder = parsed.columnOrder;
    }

    // Create columns
    const colIdsByTitle: Record<string, string> = {};
    const columnIds: string[] = [];
    for (const title of columnOrder) {
      const colId = `${boardId}-col-${slugify(title)}`;
      colIdsByTitle[title] = colId;
      columns[colId] = { id: colId, title, cardIds: [] };
      columnIds.push(colId);
    }

    // Parse card files
    const cardFiles = fs
      .readdirSync(boardPath)
      .filter((f) => f.endsWith(".md") && f !== "_board.md");

    for (const cardFile of cardFiles) {
      const cardContent = fs.readFileSync(path.join(boardPath, cardFile), "utf8");
      const { card: tempCard, status: statusTitle } = parseCardWithStatus(
        cardContent,
        boardId,
        ""
      );

      let colId = colIdsByTitle[statusTitle];
      if (!colId) {
        // New column not in order — add it
        colId = `${boardId}-col-${slugify(statusTitle)}`;
        if (!columns[colId]) {
          columns[colId] = { id: colId, title: statusTitle, cardIds: [] };
          colIdsByTitle[statusTitle] = colId;
          columnIds.push(colId);
        }
      }

      const card: Card = { ...tempCard, columnId: colId, boardId };
      cards[card.id] = card;
      columns[colId].cardIds.push(card.id);
    }

    const board: Board = {
      id: boardId,
      title: boardData.title || boardTitle,
      description: boardData.description || "",
      color: boardData.color || "#7c3aed",
      emoji: boardData.emoji || "📋",
      columnIds,
      createdAt: boardData.createdAt || new Date().toISOString(),
      updatedAt: boardData.updatedAt || new Date().toISOString(),
    };
    boards.push(board);
  }

  return NextResponse.json({ boards, columns, cards });
}
