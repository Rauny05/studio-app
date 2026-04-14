"use client";

import { useState, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Card } from "@/types/kanban";
import { useKanbanStore } from "@/store/kanban-store";
import { TAG_COLORS, PRIORITY_CONFIG, DELIVERABLE_CONFIG } from "./tag-colors";

interface Props {
  card: Card;
  isDragOverlay?: boolean;
  onOpenModal: () => void;
}

export function KanbanCard({ card, isDragOverlay, onOpenModal }: Props) {
  const { updateCard, columns } = useKanbanStore();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(card.title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });

  const style = { transform: CSS.Transform.toString(transform), transition };

  const isOverdue = card.dueDate && new Date(card.dueDate) < new Date(new Date().toDateString());
  const priority = card.priority ?? "medium";
  const deliverable = card.deliverableType;
  const columnTitle = columns[card.columnId]?.title || "";
  const daysSinceUpdate = card.updatedAt
    ? Math.floor((Date.now() - new Date(card.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const isStale = daysSinceUpdate >= 7 && columnTitle.toLowerCase() !== "published";
  const scriptWordCount = card.description?.trim()
    ? card.description.trim().split(/\s+/).length
    : 0;

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setTitleDraft(card.title);
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.select(), 0);
  }

  function commitEdit() {
    const t = titleDraft.trim();
    if (t && t !== card.title) updateCard(card.id, { title: t });
    else setTitleDraft(card.title);
    setEditingTitle(false);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(editingTitle ? {} : listeners)}
      className={`kanban-card ${isDragging ? "dragging" : ""} ${isDragOverlay ? "overlay" : ""}`}
      onClick={isDragOverlay ? undefined : onOpenModal}
    >
      {/* Deliverable type + priority row */}
      <div className="kanban-card-top-row">
        {deliverable && (
          <span
            className="kanban-card-type-badge"
            style={{ color: DELIVERABLE_CONFIG[deliverable]?.color }}
          >
            {DELIVERABLE_CONFIG[deliverable]?.icon} {deliverable}
          </span>
        )}
        <span
          className="kanban-card-priority-dot"
          style={{ background: PRIORITY_CONFIG[priority].color }}
          title={`${PRIORITY_CONFIG[priority].label} priority`}
        />
        {isStale && (
          <span
            title={`Not updated in ${daysSinceUpdate} days`}
            style={{
              fontSize: 9, fontWeight: 600, letterSpacing: "0.04em",
              color: "#f59e0b", background: "#f59e0b18",
              padding: "1px 5px", borderRadius: 4, marginLeft: "auto",
            }}
          >
            STALE
          </span>
        )}
      </div>

      {/* Tags */}
      {card.tags && card.tags.length > 0 && (
        <div className="kanban-card-tags">
          {card.tags.slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              className="kanban-tag"
              style={{ background: TAG_COLORS[tag.color]?.bg, color: TAG_COLORS[tag.color]?.text }}
            >
              {tag.label}
            </span>
          ))}
          {card.tags.length > 3 && (
            <span className="kanban-tag" style={{ background: "var(--app-elevated)", color: "var(--app-text-muted)" }}>
              +{card.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Title */}
      <div className="kanban-card-title-row" onClick={(e) => e.stopPropagation()}>
        {editingTitle ? (
          <input
            ref={titleInputRef}
            className="kanban-card-title-input"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
              if (e.key === "Escape") { setTitleDraft(card.title); setEditingTitle(false); }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <p className="kanban-card-title" onDoubleClick={startEdit}>
            {card.title}
          </p>
        )}
        <button
          className="kanban-card-menu-btn"
          onClick={(e) => { e.stopPropagation(); onOpenModal(); }}
          title="Open details"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      </div>

      {/* Description preview */}
      {card.description && (
        <p className="kanban-card-desc">
          {card.description.replace(/^#+\s*/gm, "").slice(0, 80)}
          {card.description.length > 80 ? "…" : ""}
        </p>
      )}

      {/* Footer row */}
      <div className="kanban-card-footer">
        {card.dueDate && (
          <div className={`kanban-card-due ${isOverdue ? "overdue" : ""}`}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {new Date(card.dueDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </div>
        )}
        {card.videoLink && (
          <div className="kanban-card-has-video" title="Has video link">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        )}
        {card.thumbnailUrl && (
          <div className="kanban-card-has-thumb" title="Has thumbnail">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}
        {scriptWordCount > 0 && (
          <div className="kanban-card-word-count" title={`${scriptWordCount} words`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="9" y2="18" />
            </svg>
            {scriptWordCount}w
          </div>
        )}
      </div>
    </div>
  );
}
