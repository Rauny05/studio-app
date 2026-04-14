"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Board } from "@/types/kanban";
import { BOARD_COLORS } from "@/types/kanban";
import { useKanbanStore } from "@/store/kanban-store";

const BOARD_EMOJIS = ["🎬", "📸", "🎙️", "✍️", "📢", "🚀", "🎯", "💡", "🌟", "📱", "🎨", "📹"];

function BoardCard({ board, onOpen }: { board: Board; onOpen: () => void }) {
  const { deleteBoard, duplicateBoard, getCardsByBoard } = useKanbanStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const cardCount = getCardsByBoard(board.id).length;
  const createdDate = new Date(board.createdAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <div className="board-card" style={{ "--board-color": board.color } as React.CSSProperties}>
      <div className="board-card-color-bar" style={{ background: board.color }} />
      <div className="board-card-body" onClick={onOpen}>
        <div className="board-card-emoji">{board.emoji}</div>
        <h3 className="board-card-title">{board.title}</h3>
        {board.description && (
          <p className="board-card-desc">{board.description}</p>
        )}
        <div className="board-card-stats">
          <span className="board-card-stat">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            {cardCount} card{cardCount !== 1 ? "s" : ""}
          </span>
          <span className="board-card-stat">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {createdDate}
          </span>
        </div>
      </div>
      <div className="board-card-actions">
        <button
          className="kanban-icon-btn"
          title="More options"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
          </svg>
        </button>
        {menuOpen && (
          <>
            <div className="board-card-menu-backdrop" onClick={() => setMenuOpen(false)} />
            <div className="board-card-menu">
              <button onClick={() => { onOpen(); setMenuOpen(false); }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Open board
              </button>
              <button onClick={() => { duplicateBoard(board.id); setMenuOpen(false); }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Duplicate
              </button>
              <button
                className="danger"
                onClick={() => { deleteBoard(board.id); setMenuOpen(false); }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
                </svg>
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NewBoardModal({ onClose }: { onClose: () => void }) {
  const { addBoard } = useKanbanStore();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(BOARD_COLORS[0].value);
  const [emoji, setEmoji] = useState(BOARD_EMOJIS[0]);

  function create() {
    if (!title.trim()) return;
    const id = addBoard({ title: title.trim(), description, color, emoji });
    router.push(`/projects/${id}`);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.currentTarget === e.target) onClose(); }}>
      <div className="modal-panel new-board-modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2 className="new-board-heading">New project</h2>
          <button className="kanban-icon-btn" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body" style={{ gap: 12 }}>
          {/* Preview */}
          <div className="new-board-preview" style={{ background: color + "18", borderColor: color + "44" }}>
            <div className="new-board-preview-emoji">{emoji}</div>
            <div className="new-board-preview-title" style={{ color }}>
              {title || "Project name"}
            </div>
          </div>

          {/* Emoji picker */}
          <div>
            <label className="modal-label">Icon</label>
            <div className="emoji-picker">
              {BOARD_EMOJIS.map((e) => (
                <button
                  key={e}
                  className={`emoji-btn ${emoji === e ? "selected" : ""}`}
                  onClick={() => setEmoji(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="modal-label">Color</label>
            <div className="board-color-picker">
              {BOARD_COLORS.map((c) => (
                <button
                  key={c.value}
                  className={`board-color-btn ${color === c.value ? "selected" : ""}`}
                  style={{ background: c.value }}
                  onClick={() => setColor(c.value)}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="modal-label">Name</label>
            <input
              autoFocus
              className="modal-input"
              placeholder="e.g. Content Calendar, Brand Campaign…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") create(); if (e.key === "Escape") onClose(); }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="modal-label">Description <span style={{ color: "var(--app-text-muted)", fontWeight: 400 }}>(optional)</span></label>
            <input
              className="modal-input"
              placeholder="What's this project for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="kanban-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="kanban-btn-primary" onClick={create} disabled={!title.trim()}>
            Create project
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProjectsGrid() {
  const { boards } = useKanbanStore();
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="projects-page">
      <div className="projects-header">
        <div>
          <h2 className="projects-heading">Projects</h2>
          <p className="projects-subheading">{boards.length} board{boards.length !== 1 ? "s" : ""}</p>
        </div>
        <button className="kanban-btn-primary" onClick={() => setShowNew(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New project
        </button>
      </div>

      {boards.length === 0 ? (
        <div className="projects-empty">
          <div className="projects-empty-icon">🎬</div>
          <h3>No projects yet</h3>
          <p>Create your first content board to get started</p>
          <button className="kanban-btn-primary" onClick={() => setShowNew(true)}>
            Create project
          </button>
        </div>
      ) : (
        <div className="boards-grid">
          {boards.map((board) => (
            <BoardCard
              key={board.id}
              board={board}
              onOpen={() => router.push(`/projects/${board.id}`)}
            />
          ))}
          <button className="board-card-new" onClick={() => setShowNew(true)}>
            <div className="board-card-new-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <span>New project</span>
          </button>
        </div>
      )}

      {showNew && <NewBoardModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
