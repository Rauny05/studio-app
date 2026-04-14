import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { getBoardDir, ensureDir, slugify } from "@/lib/vault-service";
import { serializeCard } from "@/lib/markdown-parser";
import type { Card } from "@/types/kanban";

export async function POST(req: NextRequest) {
  const { card, columnTitle, boardTitle } = (await req.json()) as {
    card: Card;
    columnTitle: string;
    boardTitle: string;
  };

  if (!card || !boardTitle) {
    return NextResponse.json({ error: "card and boardTitle required" }, { status: 400 });
  }

  const boardDir = getBoardDir(boardTitle);
  if (!boardDir) {
    return NextResponse.json({ error: "Vault not configured" }, { status: 404 });
  }

  ensureDir(boardDir);

  const fileName = `${slugify(card.title)}.md`;
  const filePath = path.join(boardDir, fileName);
  const content = serializeCard(card, columnTitle);
  fs.writeFileSync(filePath, content, "utf8");

  return NextResponse.json({ ok: true, filePath });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cardId = searchParams.get("cardId");
  const boardTitle = searchParams.get("boardTitle");

  if (!cardId || !boardTitle) {
    return NextResponse.json({ error: "cardId and boardTitle required" }, { status: 400 });
  }

  const boardDir = getBoardDir(boardTitle);
  if (!boardDir || !fs.existsSync(boardDir)) {
    return NextResponse.json({ error: "Board directory not found" }, { status: 404 });
  }

  // Scan .md files to find matching card by id in frontmatter
  const files = fs.readdirSync(boardDir).filter((f) => f.endsWith(".md") && f !== "_board.md");
  for (const file of files) {
    const filePath = path.join(boardDir, file);
    const raw = fs.readFileSync(filePath, "utf8");
    const { data } = matter(raw);
    if (data.id === cardId) {
      fs.unlinkSync(filePath);
      return NextResponse.json({ ok: true });
    }
  }

  return NextResponse.json({ error: "Card file not found" }, { status: 404 });
}
