"use client";

import { useState, useRef, useEffect } from "react";
import { useKanbanStore } from "@/store/kanban-store";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

export function QuickAdd() {
  const { columns, boards, addCard } = useKanbanStore();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [columnId, setColumnId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const allColumns = Object.values(columns);

  // Default to first column when opening
  useEffect(() => {
    if (open) {
      setColumnId((id) => id || allColumns[0]?.id || "");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useKeyboardShortcut("n", () => setOpen(true));

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    setTitle("");
  }

  function submit() {
    const t = title.trim();
    if (!t || !columnId) return;
    // Find which board this column belongs to
    const col = columns[columnId];
    if (!col) return;
    const board = boards.find((b) => b.columnIds.includes(columnId));
    if (!board) return;
    addCard(columnId, board.id, {
      title: t,
      description: "",
      deliverableType: null,
      thumbnailUrl: null,
      videoLink: null,
      tags: [],
      priority: "medium",
      dueDate: null,
      notes: "",
    });
    close();
  }

  return (
    <>
      {/* Floating button */}
      <button
        className="quick-add-fab"
        onClick={() => setOpen(true)}
        title="Quick add card (N)"
        aria-label="Quick add card"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span className="quick-add-fab-label">Add card</span>
      </button>

      {/* Popover */}
      {open && (
        <>
          <div className="quick-add-backdrop" onClick={close} />
          <div className="quick-add-popover" role="dialog" aria-label="Quick add card">
            <div className="quick-add-header">
              <span className="quick-add-title">New card</span>
              <kbd className="quick-add-kbd">Esc to cancel</kbd>
            </div>

            <input
              ref={inputRef}
              className="quick-add-input"
              placeholder="Card title…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />

            <div className="quick-add-footer">
              <select
                className="quick-add-select"
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
              >
                {allColumns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.title}
                  </option>
                ))}
              </select>
              <button
                className="kanban-btn-primary"
                onClick={submit}
                disabled={!title.trim()}
              >
                Add ↵
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
