"use client";

import { useState, useRef, useEffect } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import type { Card, Column } from "@/types/kanban";
import { useKanbanStore } from "@/store/kanban-store";
import { KanbanCard } from "./KanbanCard";

interface Props {
  column: Column;
  cards: Card[];
  boardId: string;
}

export function KanbanColumn({ column, cards, boardId }: Props) {
  const { addCard, removeColumn, renameColumn, openCard } = useKanbanStore();
  const [addingCard, setAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [colTitle, setColTitle] = useState(column.title);
  const addInputRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  useEffect(() => {
    if (addingCard) addInputRef.current?.focus();
  }, [addingCard]);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.select();
  }, [editingTitle]);

  function commitAddCard() {
    const title = newCardTitle.trim();
    if (title) {
      addCard(column.id, boardId, {
        title,
        description: "",
        deliverableType: null,
        thumbnailUrl: null,
        videoLink: null,
        tags: [],
        priority: "medium",
        dueDate: null,
        notes: "",
      });
    }
    setNewCardTitle("");
    setAddingCard(false);
  }

  function commitRename() {
    const t = colTitle.trim();
    if (t && t !== column.title) renameColumn(column.id, t);
    else setColTitle(column.title);
    setEditingTitle(false);
  }

  return (
    <div className={`kanban-column ${isOver ? "drag-over" : ""}`}>
      {/* Column header */}
      <div className="kanban-column-header">
        {editingTitle ? (
          <input
            ref={titleInputRef}
            className="kanban-column-title-input"
            value={colTitle}
            onChange={(e) => setColTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") { setColTitle(column.title); setEditingTitle(false); }
            }}
          />
        ) : (
          <button
            className="kanban-column-title"
            onClick={() => setEditingTitle(true)}
            title="Click to rename"
          >
            {column.title}
            <span className="kanban-column-count">{cards.length}</span>
          </button>
        )}

        <div className="kanban-column-actions">
          <button className="kanban-icon-btn" onClick={() => setAddingCard(true)} title="Add card">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            className="kanban-icon-btn danger"
            onClick={() => removeColumn(boardId, column.id)}
            title="Delete column"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Cards */}
      <div ref={setNodeRef} className="kanban-column-body">
        <SortableContext items={column.cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onOpenModal={() => openCard(card.id)}
            />
          ))}
        </SortableContext>

        {cards.length === 0 && !addingCard && (
          <div className="kanban-column-empty">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            <span>Drop cards here</span>
          </div>
        )}
      </div>

      {/* Add card */}
      {addingCard ? (
        <div className="kanban-add-card-form">
          <textarea
            ref={addInputRef}
            className="kanban-add-card-input"
            placeholder="Card title…"
            value={newCardTitle}
            onChange={(e) => setNewCardTitle(e.target.value)}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitAddCard(); }
              if (e.key === "Escape") { setNewCardTitle(""); setAddingCard(false); }
            }}
          />
          <div className="kanban-add-card-actions">
            <button className="kanban-btn-primary" onClick={commitAddCard}>Add card</button>
            <button className="kanban-icon-btn" onClick={() => { setNewCardTitle(""); setAddingCard(false); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <button className="kanban-add-card-btn" onClick={() => setAddingCard(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add card
        </button>
      )}
    </div>
  );
}
