"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useKanbanStore } from "@/store/kanban-store";

// Load KanbanBoard client-only — @dnd-kit uses accessibility counters that cause SSR mismatch
const KanbanBoard = dynamic(
  () => import("@/components/kanban/KanbanBoard").then((m) => ({ default: m.KanbanBoard })),
  { ssr: false }
);

interface Props {
  params: Promise<{ boardId: string }>;
}

export default function BoardPage({ params }: Props) {
  const { boardId } = use(params);
  const { boards } = useKanbanStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const board = mounted ? boards.find((b) => b.id === boardId) : null;

  return (
    <div className="board-page">
      <div className="board-breadcrumb">
        <Link href="/projects" className="board-breadcrumb-link">Projects</Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="board-breadcrumb-current">
          {board ? `${board.emoji} ${board.title}` : "Board"}
        </span>
      </div>

      <div className="kanban-page">
        <KanbanBoard boardId={boardId} />
      </div>
    </div>
  );
}
