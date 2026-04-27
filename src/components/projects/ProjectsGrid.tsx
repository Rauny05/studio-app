"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Board } from "@/types/kanban";
import { BOARD_COLORS } from "@/types/kanban";
import { useKanbanStore } from "@/store/kanban-store";

// Convert file to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const BOARD_EMOJIS = ["🎬", "📸", "🎙️", "✍️", "📢", "🚀", "🎯", "💡", "🌟", "📱", "🎨", "📹"];

const SWIPE_DELETE_THRESHOLD = 72; // px — past this on release → snap open
const SWIPE_DELETE_WIDTH    = 80; // px — width of the red zone when snapped open

function BoardCard({ board, onOpen }: { board: Board; onOpen: () => void }) {
  const { deleteBoard, duplicateBoard, getCardsByBoard } = useKanbanStore();
  const [menuOpen, setMenuOpen]         = useState(false);
  const [swipeX, setSwipeX]             = useState(0);   // 0..SWIPE_DELETE_WIDTH
  const [snapped, setSnapped]           = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSwiping, setIsSwiping]       = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isHorizontal = useRef(false);

  const cardCount  = getCardsByBoard(board.id).length;
  const createdDate = new Date(board.createdAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  /* ── touch handlers ────────────────────────────────── */
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current  = e.touches[0].clientX;
    touchStartY.current  = e.touches[0].clientY;
    isHorizontal.current = false;
    setIsSwiping(false);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = touchStartX.current - e.touches[0].clientX;
    const dy = Math.abs(e.touches[0].clientY - (touchStartY.current ?? 0));

    // Determine gesture direction on first significant move
    if (!isHorizontal.current && (Math.abs(dx) > 6 || dy > 6)) {
      isHorizontal.current = Math.abs(dx) > dy;
    }
    if (!isHorizontal.current) return;

    // Block vertical scroll while swiping horizontally
    e.preventDefault();
    setIsSwiping(true);

    if (dx > 0) {
      // Swiping left — clamp with slight rubber-band past the delete zone
      const clamped = Math.min(dx, SWIPE_DELETE_WIDTH + 16);
      setSwipeX(clamped);
    } else if (snapped) {
      // Allow swiping back from snapped state
      setSwipeX(Math.max(SWIPE_DELETE_WIDTH + dx, 0));
    }
  }

  function onTouchEnd() {
    if (swipeX > SWIPE_DELETE_THRESHOLD) {
      setSwipeX(SWIPE_DELETE_WIDTH);
      setSnapped(true);
    } else {
      setSwipeX(0);
      setSnapped(false);
    }
    touchStartX.current  = null;
    touchStartY.current  = null;
    isHorizontal.current = false;
    setIsSwiping(false);
  }

  function resetSwipe() {
    setSwipeX(0);
    setSnapped(false);
    setConfirmDelete(false);
  }

  function handleCardClick() {
    if (snapped) { resetSwipe(); return; }
    onOpen();
  }

  /* ── render ────────────────────────────────────────── */
  return (
    <div className="board-card-swipe-wrapper">

      {/* Red delete zone — sits behind the card */}
      <div className="board-card-delete-bg" aria-hidden>
        <button
          className="board-card-delete-action"
          onClick={() => setConfirmDelete(true)}
          tabIndex={snapped ? 0 : -1}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
          Delete
        </button>
      </div>

      {/* Card — slides left on swipe */}
      <div
        className={`board-card${isSwiping ? " swiping" : ""}`}
        style={{
          "--board-color": board.color,
          transform: `translateX(-${swipeX}px)`,
          transition: isSwiping ? "none" : "transform 260ms cubic-bezier(0.4,0,0.2,1)",
        } as React.CSSProperties}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="board-card-color-bar" style={{ background: board.color }} />
        <div className="board-card-body" onClick={handleCardClick}>
          {board.thumbnailUrl ? (
            <img src={board.thumbnailUrl} alt="" className="board-card-thumbnail" />
          ) : (
            <div className="board-card-emoji">{board.emoji}</div>
          )}
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
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); resetSwipe(); }}
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
                  onClick={() => { setConfirmDelete(true); setMenuOpen(false); }}
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

      {/* Delete confirmation — slides up over the card */}
      {confirmDelete && (
        <div className="board-card-confirm">
          <div className="board-card-confirm-icon">🗑️</div>
          <p className="board-card-confirm-title">Delete &ldquo;{board.title}&rdquo;?</p>
          <p className="board-card-confirm-sub">This removes the board and all {cardCount} card{cardCount !== 1 ? "s" : ""} inside. Cannot be undone.</p>
          <div className="board-card-confirm-actions">
            <button className="board-card-confirm-cancel" onClick={resetSwipe}>Cancel</button>
            <button className="board-card-confirm-delete" onClick={() => deleteBoard(board.id)}>
              Delete project
            </button>
          </div>
        </div>
      )}
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
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    // Only allow images
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }
    const base64 = await fileToBase64(file);
    setThumbnailUrl(base64);
  }

  function create() {
    if (!title.trim()) return;
    const id = addBoard({ title: title.trim(), description, color, emoji, thumbnailUrl: thumbnailUrl || undefined });
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
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="" className="new-board-preview-thumbnail" />
            ) : (
              <div className="new-board-preview-emoji">{emoji}</div>
            )}
            <div className="new-board-preview-title" style={{ color }}>
              {title || "Project name"}
            </div>
          </div>

          {/* Thumbnail upload */}
          <div>
            <label className="modal-label">Thumbnail <span style={{ color: "var(--app-text-muted)", fontWeight: 400 }}>(optional)</span></label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
            <button
              className="modal-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Upload thumbnail image"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {thumbnailUrl ? "Change thumbnail" : "Upload thumbnail"}
            </button>
            {thumbnailUrl && (
              <button
                className="modal-remove-btn"
                onClick={() => setThumbnailUrl(null)}
                title="Remove thumbnail"
              >
                Remove
              </button>
            )}
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
