import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getBoardDir, ensureDir } from "@/lib/vault-service";
import { serializeBoard } from "@/lib/markdown-parser";
import type { Board } from "@/types/kanban";

export async function POST(req: NextRequest) {
  const { board, columnOrder } = (await req.json()) as {
    board: Board;
    columnOrder: string[];
  };

  if (!board || !board.title) {
    return NextResponse.json({ error: "board required" }, { status: 400 });
  }

  const boardDir = getBoardDir(board.title);
  if (!boardDir) {
    return NextResponse.json({ error: "Vault not configured" }, { status: 404 });
  }

  ensureDir(boardDir);

  const boardFilePath = path.join(boardDir, "_board.md");
  const content = serializeBoard(board, columnOrder || []);
  fs.writeFileSync(boardFilePath, content, "utf8");

  return NextResponse.json({ ok: true, boardDir });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const boardTitle = searchParams.get("boardTitle");

  if (!boardTitle) {
    return NextResponse.json({ error: "boardTitle required" }, { status: 400 });
  }

  const boardDir = getBoardDir(boardTitle);
  if (!boardDir) {
    return NextResponse.json({ error: "Vault not configured" }, { status: 404 });
  }

  if (fs.existsSync(boardDir)) {
    fs.rmSync(boardDir, { recursive: true, force: true });
  }

  return NextResponse.json({ ok: true });
}
