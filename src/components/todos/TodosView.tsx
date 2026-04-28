"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useTodoStore, CARD_COLORS_LIST, type Todo, type TodoAccess } from "@/store/todo-store";
import { usePermission } from "@/hooks/use-permission";

// ── Helpers ──────────────────────────────────────────────────────────────────

function canUserView(todo: Todo, email: string, isAdmin: boolean): boolean {
  if (isAdmin || todo.createdBy === email) return true;
  if (todo.viewAccess === "all") return true;
  if (Array.isArray(todo.viewAccess)) return todo.viewAccess.includes(email);
  return false;
}

function canUserEdit(todo: Todo, email: string, isAdmin: boolean): boolean {
  if (isAdmin || todo.createdBy === email) return true;
  if (todo.editAccess === "all") return true;
  if (Array.isArray(todo.editAccess)) return todo.editAccess.includes(email);
  return false;
}

// ── Add / Edit Modal ─────────────────────────────────────────────────────────

interface ModalProps {
  todo?: Todo | null;
  onClose: () => void;
  onSave: (data: {
    title: string;
    description: string;
    link: string;
    linkLabel: string;
    color: string;
    viewAccess: TodoAccess;
    editAccess: TodoAccess;
  }) => void;
}

function TodoModal({ todo, onClose, onSave }: ModalProps) {
  const [title, setTitle] = useState(todo?.title ?? "");
  const [description, setDescription] = useState(todo?.description ?? "");
  const [link, setLink] = useState(todo?.link ?? "");
  const [linkLabel, setLinkLabel] = useState(todo?.linkLabel ?? "");
  const [color, setColor] = useState(todo?.color ?? CARD_COLORS_LIST[0]);
  const [viewAccess, setViewAccess] = useState<"all" | "restricted">(
    todo ? (todo.viewAccess === "all" ? "all" : "restricted") : "all"
  );
  const [editAccess, setEditAccess] = useState<"all" | "restricted">(
    todo ? (todo.editAccess === "all" ? "all" : "restricted") : "all"
  );
  const [viewEmails, setViewEmails] = useState(
    todo && Array.isArray(todo.viewAccess) ? todo.viewAccess.join(", ") : ""
  );
  const [editEmails, setEditEmails] = useState(
    todo && Array.isArray(todo.editAccess) ? todo.editAccess.join(", ") : ""
  );

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSave() {
    if (!title.trim()) return;
    const parseEmails = (str: string) => str.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    onSave({
      title: title.trim(),
      description: description.trim(),
      link: link.trim(),
      linkLabel: linkLabel.trim(),
      color,
      viewAccess: viewAccess === "all" ? "all" : parseEmails(viewEmails),
      editAccess: editAccess === "all" ? "all" : parseEmails(editEmails),
    });
    onClose();
  }

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="modal-panel todo-modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3 className="modal-header-title" style={{ fontWeight: 600, fontSize: 15 }}>
            {todo ? "Edit todo" : "New todo"}
          </h3>
          <button className="kanban-icon-btn" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Title */}
          <div>
            <label className="modal-label">Title *</label>
            <input
              className="modal-input"
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="modal-label">Description</label>
            <textarea
              className="modal-textarea"
              placeholder="Add context, steps, or notes…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Link */}
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 2 }}>
              <label className="modal-label">Link (optional)</label>
              <input
                className="modal-input"
                placeholder="https://…"
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="modal-label">Link label</label>
              <input
                className="modal-input"
                placeholder="Open →"
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
              />
            </div>
          </div>

          {/* Card color */}
          <div>
            <label className="modal-label">Card color</label>
            <div className="todo-color-picker">
              {CARD_COLORS_LIST.map((c) => (
                <button
                  key={c}
                  className={`todo-color-swatch ${color === c ? "selected" : ""}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Access control */}
          <div className="todo-access-section">
            <div className="todo-access-row">
              <label className="modal-label" style={{ marginBottom: 0 }}>Who can view?</label>
              <div className="todo-access-toggle">
                {(["all", "restricted"] as const).map((v) => (
                  <button
                    key={v}
                    className={`todo-access-btn ${viewAccess === v ? "active" : ""}`}
                    onClick={() => setViewAccess(v)}
                  >
                    {v === "all" ? "Everyone" : "Specific"}
                  </button>
                ))}
              </div>
            </div>
            {viewAccess === "restricted" && (
              <input
                className="modal-input"
                placeholder="email@one.com, email@two.com"
                value={viewEmails}
                onChange={(e) => setViewEmails(e.target.value)}
                style={{ marginTop: 6 }}
              />
            )}

            <div className="todo-access-row" style={{ marginTop: 8 }}>
              <label className="modal-label" style={{ marginBottom: 0 }}>Who can edit?</label>
              <div className="todo-access-toggle">
                {(["all", "restricted"] as const).map((v) => (
                  <button
                    key={v}
                    className={`todo-access-btn ${editAccess === v ? "active" : ""}`}
                    onClick={() => setEditAccess(v)}
                  >
                    {v === "all" ? "Everyone" : "Specific"}
                  </button>
                ))}
              </div>
            </div>
            {editAccess === "restricted" && (
              <input
                className="modal-input"
                placeholder="email@one.com, email@two.com"
                value={editEmails}
                onChange={(e) => setEditEmails(e.target.value)}
                style={{ marginTop: 6 }}
              />
            )}
          </div>
        </div>

        <div className="modal-footer">
          <div />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="kanban-btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="kanban-btn-primary"
              onClick={handleSave}
              disabled={!title.trim()}
            >
              {todo ? "Save changes" : "Create todo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Flashcard ─────────────────────────────────────────────────────────────────

function FlashCard({
  todo,
  canEdit,
  onEdit,
  onDelete,
  onToggle,
}: {
  todo: Todo;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const [flipped, setFlipped] = useState(false);

  // ── Swipe to delete (mobile) ──────────────────────────────────────────────
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const SWIPE_THRESHOLD = 90;

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setSwiping(false);
  }

  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    // Only track mostly-horizontal swipes
    if (!swiping && Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) {
      setSwiping(true);
      setSwipeX(Math.max(dx, -160));
      e.preventDefault();
    }
  }

  function onTouchEnd() {
    if (swipeX < -SWIPE_THRESHOLD && canEdit) {
      setDismissing(true);
      setTimeout(onDelete, 280);
    } else {
      setSwipeX(0);
      setSwiping(false);
    }
  }

  const hasBack = !!(todo.description || todo.link);

  return (
    <div
      className={`flashcard-swipe-wrapper ${dismissing ? "dismissing" : ""}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Red delete layer revealed on swipe */}
      <div className="flashcard-swipe-delete" style={{ opacity: Math.min(Math.abs(swipeX) / SWIPE_THRESHOLD, 1) }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
        </svg>
        <span>Delete</span>
      </div>

    <div
      className={`flashcard-scene ${flipped ? "flipped" : ""} ${todo.completed ? "completed" : ""}`}
      style={swipeX !== 0 ? { transform: `translateX(${swipeX}px)`, transition: swiping ? "none" : "transform 0.25s ease" } : undefined}
      onClick={() => { if (!swiping && hasBack) setFlipped((f) => !f); }}
      role="button"
      aria-label={flipped ? "Click to flip back" : "Click to flip for details"}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (hasBack) setFlipped((f) => !f); } }}
    >
      <div className="flashcard-inner">
        {/* Front */}
        <div className="flashcard-face flashcard-front" style={{ "--card-color": todo.color } as React.CSSProperties}>
          <div className="flashcard-accent" style={{ background: todo.color }} />
          <div className="flashcard-front-body">
            <div className="flashcard-title">{todo.title}</div>
            {todo.completed && (
              <span className="flashcard-done-badge">Done ✓</span>
            )}
            {hasBack && (
              <span className="flashcard-hint">tap for details →</span>
            )}
          </div>
          <div className="flashcard-front-footer" onClick={(e) => e.stopPropagation()}>
            <button
              className={`flashcard-check-btn ${todo.completed ? "checked" : ""}`}
              onClick={onToggle}
              title={todo.completed ? "Mark incomplete" : "Mark complete"}
              style={{ borderColor: todo.completed ? todo.color : undefined, color: todo.completed ? todo.color : undefined }}
            >
              {todo.completed ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="9" />
                </svg>
              )}
            </button>
            {canEdit && (
              <div className="flashcard-actions">
                <button className="flashcard-action-btn" onClick={onEdit} title="Edit">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button className="flashcard-action-btn danger" onClick={(e) => { e.stopPropagation(); if (confirm("Delete this todo?")) onDelete(); }} title="Delete">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Back */}
        <div className="flashcard-face flashcard-back" style={{ "--card-color": todo.color } as React.CSSProperties}>
          <div className="flashcard-accent" style={{ background: todo.color }} />
          <div className="flashcard-back-body">
            <div className="flashcard-back-title">{todo.title}</div>
            {todo.description && (
              <p className="flashcard-description">{todo.description}</p>
            )}
            {todo.link && (
              <a
                href={todo.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flashcard-link"
                onClick={(e) => e.stopPropagation()}
                style={{ color: todo.color }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                {todo.linkLabel || "Open link"}
              </a>
            )}
          </div>
          <div className="flashcard-back-footer" onClick={(e) => e.stopPropagation()}>
            <span className="flashcard-hint">← tap to flip back</span>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export function TodosView() {
  const { data: session } = useSession();
  const email = session?.user?.email ?? "";
  const isAdmin = session?.user?.role === "admin";
  const permission = usePermission("todos");
  const canCreateGlobal = permission === "edit";

  const { todos, addTodo, updateTodo, deleteTodo, toggleComplete } = useTodoStore();

  // Hydrate store client-side
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    useTodoStore.persist.rehydrate();
    setHydrated(true);
  }, []);

  const [showModal, setShowModal] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");

  const visibleTodos = hydrated
    ? todos.filter((t) => {
        if (!canUserView(t, email, isAdmin)) return false;
        if (filter === "active") return !t.completed;
        if (filter === "done") return t.completed;
        return true;
      })
    : [];

  const activeCount = hydrated ? todos.filter((t) => !t.completed && canUserView(t, email, isAdmin)).length : 0;
  const doneCount = hydrated ? todos.filter((t) => t.completed && canUserView(t, email, isAdmin)).length : 0;

  function openEdit(todo: Todo) {
    setEditingTodo(todo);
    setShowModal(true);
  }

  function handleDelete(id: string) {
    deleteTodo(id);
  }

  return (
    <div className="todos-page">
      {/* Header */}
      <div className="todos-header">
        <div>
          <h2 className="todos-heading">Todos</h2>
          <p className="todos-subheading">
            {activeCount} remaining · {doneCount} done
          </p>
        </div>
        {canCreateGlobal && (
          <button
            className="kanban-btn-primary"
            onClick={() => { setEditingTodo(null); setShowModal(true); }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New todo
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="todos-filters">
        {(["all", "active", "done"] as const).map((f) => (
          <button
            key={f}
            className={`todos-filter-btn ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? `All (${activeCount + doneCount})` : f === "active" ? `Active (${activeCount})` : `Done (${doneCount})`}
          </button>
        ))}
      </div>

      {/* Cards grid */}
      {!hydrated ? (
        <div className="todos-loading">
          <div className="dl-spinner" />
        </div>
      ) : visibleTodos.length === 0 ? (
        <div className="todos-empty">
          {filter === "done" ? "No completed todos yet." : canCreateGlobal ? (
            <>
              No todos yet.{" "}
              <button
                className="todos-empty-link"
                onClick={() => { setEditingTodo(null); setShowModal(true); }}
              >
                Add your first one →
              </button>
            </>
          ) : "No todos to show."}
        </div>
      ) : (
        <div className="flashcard-grid">
          {visibleTodos.map((todo) => (
            <FlashCard
              key={todo.id}
              todo={todo}
              canEdit={canUserEdit(todo, email, isAdmin)}
              onEdit={() => openEdit(todo)}
              onDelete={() => handleDelete(todo.id)}
              onToggle={() => toggleComplete(todo.id)}
            />
          ))}
          {/* Add card placeholder */}
          {canCreateGlobal && (
            <button
              className="flashcard-add-placeholder"
              onClick={() => { setEditingTodo(null); setShowModal(true); }}
              aria-label="Add new todo"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>New todo</span>
            </button>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <TodoModal
          todo={editingTodo}
          onClose={() => { setShowModal(false); setEditingTodo(null); }}
          onSave={(data) => {
            if (editingTodo) {
              updateTodo(editingTodo.id, data);
            } else {
              addTodo({ ...data, createdBy: email });
            }
            setShowModal(false);
            setEditingTodo(null);
          }}
        />
      )}
    </div>
  );
}
