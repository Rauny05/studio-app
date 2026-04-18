"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useKanbanStore } from "@/store/kanban-store";
import { DELIVERABLE_CONFIG, PRIORITY_CONFIG } from "@/components/kanban/tag-colors";
import type { Card } from "@/types/kanban";
import type { DeliverableRow } from "@/app/api/deliverables/route";
import { useReelsStore } from "@/lib/reels-store";
import {
  usePriorityVideosStore,
  PLATFORMS,
  type PriorityVideo,
  type VideoPriority,
  type Platform,
} from "@/store/priority-videos-store";

// ── Simple SVG bar chart ─────────────────────────────────────────────────────

function BarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = 100 / data.length - 4;

  return (
    <div className="chart-wrap">
      <svg viewBox="0 0 200 80" preserveAspectRatio="xMidYMid meet" className="bar-chart-svg">
        {data.map((d, i) => {
          const h = (d.value / max) * 60;
          const x = i * (200 / data.length) + 2;
          return (
            <g key={d.label}>
              <rect
                x={x}
                y={80 - h - 14}
                width={barW}
                height={Math.max(h, 2)}
                rx={3}
                fill={d.color}
                opacity={0.85}
              />
              <text x={x + barW / 2} y={78} textAnchor="middle" fontSize="7" fill="currentColor" opacity={0.5}>
                {d.label.slice(0, 6)}
              </text>
              {d.value > 0 && (
                <text x={x + barW / 2} y={80 - h - 17} textAnchor="middle" fontSize="7" fill="currentColor" fontWeight="600">
                  {d.value}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Donut chart ──────────────────────────────────────────────────────────────

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return (
    <div className="chart-wrap donut-empty">
      <svg viewBox="0 0 80 80" className="donut-svg">
        <circle cx="40" cy="40" r="28" fill="none" stroke="var(--app-border)" strokeWidth="12" />
      </svg>
    </div>
  );

  const r = 28;
  const cx = 40;
  const cy = 40;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="chart-wrap">
      <svg viewBox="0 0 80 80" className="donut-svg">
        {data.filter((d) => d.value > 0).map((d) => {
          const pct = d.value / total;
          const dash = pct * circ;
          const el = (
            <circle
              key={d.label}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={d.color}
              strokeWidth="12"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-(offset * circ)}
              style={{ transform: "rotate(-90deg)", transformOrigin: "40px 40px" }}
              opacity={0.85}
            />
          );
          offset += pct;
          return el;
        })}
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="700" fill="currentColor">
          {total}
        </text>
        <text x={cx} y={cy + 13} textAnchor="middle" fontSize="7" fill="currentColor" opacity={0.5}>
          total
        </text>
      </svg>
    </div>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div className="stat-card" style={{ "--stat-accent": accent ?? "var(--app-accent)" } as React.CSSProperties}>
      <div className="stat-card-icon" style={{ background: (accent ?? "#000") + "18" }}>
        {icon}
      </div>
      <div className="stat-card-body">
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{label}</div>
        {sub && <div className="stat-card-sub">{sub}</div>}
      </div>
    </div>
  );
}

// ── Recent card row ──────────────────────────────────────────────────────────

function RecentCardRow({ card }: { card: Card }) {
  const { boards, columns } = useKanbanStore();
  const board = boards.find((b) => b.id === card.boardId);
  const column = columns[card.columnId];
  const isOverdue = card.dueDate && new Date(card.dueDate) < new Date(new Date().toDateString());

  return (
    <div className="recent-card-row">
      <div className="recent-card-left">
        {board && (
          <span className="recent-card-board" style={{ background: board.color + "20", color: board.color }}>
            {board.emoji}
          </span>
        )}
        <div className="recent-card-info">
          <span className="recent-card-title">{card.title}</span>
          <span className="recent-card-meta">
            {column?.title}
            {card.deliverableType && ` · ${DELIVERABLE_CONFIG[card.deliverableType]?.icon} ${card.deliverableType}`}
          </span>
        </div>
      </div>
      <div className="recent-card-right">
        {card.dueDate && (
          <span className={`recent-card-due ${isOverdue ? "overdue" : ""}`}>
            {new Date(card.dueDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
        <span
          className="recent-card-priority"
          style={{ background: PRIORITY_CONFIG[card.priority ?? "medium"].bg, color: PRIORITY_CONFIG[card.priority ?? "medium"].color }}
        >
          {PRIORITY_CONFIG[card.priority ?? "medium"].label}
        </span>
      </div>
    </div>
  );
}

// ── Deliverables summary widget ──────────────────────────────────────────────

const DL_STATUS = [
  { key: "pending",          label: "Pending",         color: "#737373" },
  { key: "in-progress",      label: "In Progress",     color: "#f59e0b" },
  { key: "awaiting-payment", label: "Awaiting Payment", color: "#3b82f6" },
  { key: "done",             label: "Done",            color: "#22c55e" },
] as const;

function DeliverablesSummary() {
  const [rows, setRows] = useState<DeliverableRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/deliverables", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { setRows(d.deliverables ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const c = { pending: 0, "in-progress": 0, "awaiting-payment": 0, done: 0 };
    rows.forEach((r) => { c[r.overallStatus]++; });
    return c;
  }, [rows]);

  const total = rows.length;

  // Top 4 pending items
  const topPending = useMemo(() =>
    rows.filter((r) => r.overallStatus === "pending" || r.overallStatus === "in-progress").slice(0, 4),
  [rows]);

  return (
    <div className="dl-dash-widget">
      <div className="dl-dash-header">
        <div className="dl-dash-title-row">
          <span className="dl-live-dot" style={{ width: 7, height: 7 }} />
          <h3 className="dl-dash-title">Deliverables</h3>
          {!loading && <span className="dl-dash-total">{total} total</span>}
        </div>
        <Link href="/deliverables" className="dashboard-panel-link">View all →</Link>
      </div>

      {loading ? (
        <div className="dl-dash-loading">
          <div className="dl-spinner" style={{ width: 20, height: 20, borderWidth: 1.5 }} />
          <span>Syncing…</span>
        </div>
      ) : (
        <>
          {/* Status pills */}
          <div className="dl-dash-pills">
            {DL_STATUS.map(({ key, label, color }) => (
              <Link key={key} href={`/deliverables`} className="dl-dash-pill" style={{ "--pill-color": color } as React.CSSProperties}>
                <span className="dl-dash-pill-dot" style={{ background: color }} />
                <span className="dl-dash-pill-count" style={{ color }}>{counts[key]}</span>
                <span className="dl-dash-pill-label">{label}</span>
              </Link>
            ))}
          </div>

          {/* Stacked progress bar */}
          {total > 0 && (
            <div className="dl-dash-bar">
              {DL_STATUS.map(({ key, color }) => {
                const pct = (counts[key] / total) * 100;
                return pct > 0 ? (
                  <div
                    key={key}
                    className="dl-dash-bar-seg"
                    style={{ width: `${pct}%`, background: color }}
                    title={`${key}: ${counts[key]}`}
                  />
                ) : null;
              })}
            </div>
          )}

          {/* Top pending items */}
          {topPending.length > 0 && (
            <div className="dl-dash-pending">
              {topPending.map((row) => (
                <Link key={row.id} href="/deliverables" className="dl-dash-row">
                  <span className="dl-dash-row-pn">{row.pnNo.toUpperCase()}</span>
                  <span className="dl-dash-row-brand">{row.brand}</span>
                  <span
                    className="dl-dash-row-status"
                    style={{
                      color: DL_STATUS.find((s) => s.key === row.overallStatus)?.color,
                    }}
                  >
                    {row.overallStatus === "in-progress" ? "In Progress" : "Pending"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Reel row with inline edit ─────────────────────────────────────────────────

function ReelRow({
  reel,
  idx,
  onRemove,
  onRename,
}: {
  reel: { id: string; name: string };
  idx: number;
  onRemove: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(reel.name);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(reel.name);
    setEditing(true);
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
  }

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== reel.name) onRename(trimmed);
    setEditing(false);
  }

  return (
    <div className="today-reel-row">
      <span className="today-reel-num">{idx + 1}</span>
      {editing ? (
        <input
          ref={inputRef}
          className="today-reel-edit-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      ) : (
        <span className="today-reel-name" onClick={startEdit} title="Click to edit">{reel.name}</span>
      )}
      <div className="today-reel-actions">
        {!editing && (
          <button className="today-reel-edit" onClick={startEdit} aria-label="Edit">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
        <button className="today-reel-remove" onClick={onRemove} aria-label="Remove">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Single-day reel section ───────────────────────────────────────────────────

function DayReelSection({ dateStr, label, isToday }: { dateStr: string; label: string; isToday: boolean }) {
  const { getReels, addReel, removeReel, renameReel } = useReelsStore();
  const reels = getReels(dateStr);
  const [inputVal, setInputVal] = useState("");
  const [showInput, setShowInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputVal.trim();
    if (!trimmed) { setShowInput(false); return; }
    addReel(dateStr, trimmed);
    setInputVal("");
    inputRef.current?.focus();
  }

  return (
    <div className={`reel-day-section ${isToday ? "reel-day-today" : ""}`}>
      <div className="reel-day-header">
        <div className="reel-day-label-group">
          {isToday && <span className="reel-day-today-badge">Today</span>}
          <span className="reel-day-label">{label}</span>
        </div>
        <button
          className="reel-day-add-btn"
          onClick={() => { setShowInput(true); setTimeout(() => inputRef.current?.focus(), 0); }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add
        </button>
      </div>

      <div className="reel-day-body">
        {reels.length === 0 && !showInput && (
          <p className="reel-day-empty">Nothing scheduled</p>
        )}
        <div className="today-reels-list">
          {reels.map((r, idx) => (
            <ReelRow
              key={r.id}
              reel={r}
              idx={idx}
              onRemove={() => removeReel(dateStr, r.id)}
              onRename={(newName) => renameReel(dateStr, r.id, newName)}
            />
          ))}
        </div>
        {showInput && (
          <form onSubmit={handleAdd} className="today-reels-form">
            <input
              ref={inputRef}
              className="today-reels-input"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Reel name or topic…"
              onBlur={() => { if (!inputVal.trim()) setShowInput(false); }}
            />
            <button type="submit" className="today-reels-submit">Add</button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── 3-Day Reel Schedule widget ────────────────────────────────────────────────

function TodayReels() {
  const days = useMemo(() => {
    return Array.from({ length: 3 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const label = i === 0
        ? d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
        : d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
      return { dateStr, label, isToday: i === 0 };
    });
  }, []);

  return (
    <div className="today-reels-widget">
      <div className="today-reels-header">
        <div className="today-reels-title-row">
          <span className="today-reels-icon">🎬</span>
          <div>
            <h2 className="today-reels-title">Reel Schedule</h2>
            <p className="today-reels-date">Next 3 days</p>
          </div>
        </div>
      </div>
      <div className="today-reels-days">
        {days.map(({ dateStr, label, isToday }) => (
          <DayReelSection key={dateStr} dateStr={dateStr} label={label} isToday={isToday} />
        ))}
      </div>
    </div>
  );
}

// ── Reel Timeline widget ─────────────────────────────────────────────────────

function ReelTimeline() {
  const { getAllReels } = useReelsStore();
  const allReels = getAllReels();

  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result: { dateStr: string; label: string; reels: { id: string; name: string }[] }[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const reels = allReels[dateStr] ?? [];
      if (reels.length > 0) {
        const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        result.push({ dateStr, label, reels });
      }
    }
    return result;
  }, [allReels]);

  return (
    <div className="reel-timeline-card">
      <div className="reel-timeline-header">
        <span>🎬 Reel Timeline</span>
        <a href="/calendar" className="dashboard-panel-link">Manage →</a>
      </div>
      <div className="reel-timeline-body">
        {days.length === 0 ? (
          <div className="reel-timeline-empty">
            No upcoming reels scheduled.{" "}
            <a href="/calendar" className="dashboard-panel-link">Plan on calendar →</a>
          </div>
        ) : (
          days.map(({ dateStr, label, reels }) => (
            <div key={dateStr} className="reel-timeline-day">
              <span className="reel-timeline-date">{label}</span>
              <div className="reel-timeline-chips">
                {reels.map((r, idx) => (
                  <span key={r.id} className="reel-timeline-chip">
                    <span className="reel-timeline-chip-num">{idx + 1}</span>
                    {r.name}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Priority Videos ──────────────────────────────────────────────────────────

const PV_CONFIG: Record<VideoPriority, { label: string; short: string; color: string; bg: string; border: string }> = {
  1: { label: "Urgent",  short: "P1", color: "#ef4444", bg: "rgba(239,68,68,0.07)",  border: "rgba(239,68,68,0.25)" },
  2: { label: "High",    short: "P2", color: "#f59e0b", bg: "rgba(245,158,11,0.07)", border: "rgba(245,158,11,0.25)" },
  3: { label: "Normal",  short: "P3", color: "#22c55e", bg: "rgba(34,197,94,0.07)",  border: "rgba(34,197,94,0.2)"  },
};

interface VideoModalProps {
  video?: PriorityVideo | null;
  defaultPriority?: VideoPriority;
  onClose: () => void;
  onSave: (data: { title: string; priority: VideoPriority; platform: Platform | ""; notes: string }) => void;
}

function VideoModal({ video, defaultPriority = 2, onClose, onSave }: VideoModalProps) {
  const [title,    setTitle]    = useState(video?.title    ?? "");
  const [priority, setPriority] = useState<VideoPriority>(video?.priority ?? defaultPriority);
  const [platform, setPlatform] = useState<Platform | "">(video?.platform ?? "");
  const [notes,    setNotes]    = useState(video?.notes    ?? "");

  useEffect(() => {
    function k(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const overlayRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="modal-panel pv-modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3 className="modal-header-title">{video ? "Edit video" : "Add priority video"}</h3>
          <button className="kanban-icon-btn" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body pv-modal-body">
          {/* Title */}
          <div>
            <label className="modal-label">Video title *</label>
            <input
              className="modal-input"
              placeholder="What's the video about?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Priority selector */}
          <div>
            <label className="modal-label">Priority</label>
            <div className="pv-priority-row">
              {([1, 2, 3] as VideoPriority[]).map((p) => {
                const cfg = PV_CONFIG[p];
                return (
                  <button
                    key={p}
                    className={`pv-priority-btn ${priority === p ? "active" : ""}`}
                    style={priority === p ? { background: cfg.bg, borderColor: cfg.color, color: cfg.color } : {}}
                    onClick={() => setPriority(p)}
                  >
                    <span className="pv-priority-dot" style={{ background: cfg.color }} />
                    {cfg.short} · {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Platform */}
          <div>
            <label className="modal-label">Platform <span style={{ opacity: 0.45, fontWeight: 400 }}>(optional)</span></label>
            <div className="pv-platform-row">
              {PLATFORMS.map((pl) => (
                <button
                  key={pl}
                  className={`pv-platform-btn ${platform === pl ? "active" : ""}`}
                  onClick={() => setPlatform(platform === pl ? "" : pl)}
                >
                  {pl}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="modal-label">Notes <span style={{ opacity: 0.45, fontWeight: 400 }}>(optional)</span></label>
            <textarea
              className="modal-textarea"
              placeholder="Hook idea, reference, script notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <div className="modal-footer">
          <div />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="kanban-btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="kanban-btn-primary"
              disabled={!title.trim()}
              onClick={() => { onSave({ title: title.trim(), priority, platform, notes: notes.trim() }); onClose(); }}
            >
              {video ? "Save changes" : "Add video"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PriorityVideoItem({
  video,
  isFirst,
  isLast,
  onToggle,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  video: PriorityVideo;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const cfg = PV_CONFIG[video.priority];
  return (
    <div className={`pv-item ${video.completed ? "pv-item-done" : ""}`} style={{ "--pv-color": cfg.color } as React.CSSProperties}>
      <div className="pv-item-accent" style={{ background: cfg.color }} />
      <button className="pv-check" onClick={onToggle} title={video.completed ? "Mark incomplete" : "Mark done"}>
        {video.completed ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
          </svg>
        )}
      </button>
      <div className="pv-item-body">
        <span className="pv-item-title">{video.title}</span>
        {video.platform && <span className="pv-platform-chip">{video.platform}</span>}
        {video.notes && <span className="pv-item-notes">{video.notes}</span>}
      </div>
      <div className="pv-item-actions">
        <div className="pv-reorder">
          <button className="pv-reorder-btn" onClick={onMoveUp} disabled={isFirst} title="Move up">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15" /></svg>
          </button>
          <button className="pv-reorder-btn" onClick={onMoveDown} disabled={isLast} title="Move down">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
        </div>
        <button className="pv-edit-btn" onClick={onEdit} title="Edit">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button className="pv-delete-btn" onClick={onDelete} title="Delete">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function PriorityVideos() {
  const { videos, addVideo, updateVideo, deleteVideo, toggleDone, moveUp, moveDown } = usePriorityVideosStore();
  const [hydrated, setHydrated] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingVideo, setEditingVideo] = useState<PriorityVideo | null>(null);
  const [defaultPriority, setDefaultPriority] = useState<VideoPriority>(2);

  useEffect(() => { usePriorityVideosStore.persist.rehydrate(); setHydrated(true); }, []);

  const byPriority = useMemo(() => {
    const active = videos.filter((v) => !v.completed);
    const done   = videos.filter((v) => v.completed);
    return {
      active: {
        1: active.filter((v) => v.priority === 1),
        2: active.filter((v) => v.priority === 2),
        3: active.filter((v) => v.priority === 3),
      },
      done,
    };
  }, [videos]);

  const totalActive = byPriority.active[1].length + byPriority.active[2].length + byPriority.active[3].length;

  function openAdd(p: VideoPriority = 2) { setDefaultPriority(p); setEditingVideo(null); setShowModal(true); }
  function openEdit(v: PriorityVideo) { setEditingVideo(v); setShowModal(true); }

  return (
    <>
      <div className="pv-widget">
        {/* Header */}
        <div className="pv-header">
          <div className="pv-header-left">
            <span className="pv-header-icon">🎯</span>
            <div>
              <h3 className="pv-heading">Priority Videos</h3>
              <p className="pv-subheading">
                {!hydrated ? "Loading…" : totalActive === 0 ? "All clear — nothing queued" : `${totalActive} queued · ${byPriority.done.length} done`}
              </p>
            </div>
          </div>
          <button className="kanban-btn-primary pv-add-btn" onClick={() => openAdd()}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add video
          </button>
        </div>

        {/* Columns */}
        {hydrated && (
          <div className="pv-columns">
            {([1, 2, 3] as VideoPriority[]).map((p) => {
              const cfg = PV_CONFIG[p];
              const items = byPriority.active[p];
              return (
                <div key={p} className="pv-col">
                  {/* Column header */}
                  <div className="pv-col-header" style={{ borderColor: cfg.border }}>
                    <div className="pv-col-label">
                      <span className="pv-col-dot" style={{ background: cfg.color }} />
                      <span className="pv-col-title" style={{ color: cfg.color }}>{cfg.short}</span>
                      <span className="pv-col-name">{cfg.label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {items.length > 0 && (
                        <span className="pv-col-count" style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>{items.length}</span>
                      )}
                      <button className="pv-col-add-btn" onClick={() => openAdd(p)} title={`Add ${cfg.label} priority video`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="pv-col-items">
                    {items.length === 0 ? (
                      <button className="pv-col-empty" onClick={() => openAdd(p)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add video
                      </button>
                    ) : (
                      items.map((v, idx) => (
                        <PriorityVideoItem
                          key={v.id}
                          video={v}
                          isFirst={idx === 0}
                          isLast={idx === items.length - 1}
                          onToggle={() => toggleDone(v.id)}
                          onEdit={() => openEdit(v)}
                          onDelete={() => { if (confirm(`Delete "${v.title}"?`)) deleteVideo(v.id); }}
                          onMoveUp={() => moveUp(v.id)}
                          onMoveDown={() => moveDown(v.id)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Done section — collapsed by default if any */}
        {hydrated && byPriority.done.length > 0 && (
          <details className="pv-done-section">
            <summary className="pv-done-summary">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              {byPriority.done.length} completed
            </summary>
            <div className="pv-done-list">
              {byPriority.done.map((v) => {
                const cfg = PV_CONFIG[v.priority];
                return (
                  <div key={v.id} className="pv-done-row">
                    <button className="pv-check pv-check-done" onClick={() => toggleDone(v.id)} title="Restore">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                    <span className="pv-done-title">{v.title}</span>
                    <span className="pv-done-badge" style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>{cfg.short}</span>
                    <button className="pv-delete-btn" onClick={() => deleteVideo(v.id)} title="Delete">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </div>

      {showModal && (
        <VideoModal
          video={editingVideo}
          defaultPriority={defaultPriority}
          onClose={() => { setShowModal(false); setEditingVideo(null); }}
          onSave={(data) => {
            if (editingVideo) {
              updateVideo(editingVideo.id, data);
            } else {
              addVideo(data);
            }
          }}
        />
      )}
    </>
  );
}

// ── Main dashboard ───────────────────────────────────────────────────────────

export function DashboardView() {
  const { boards, cards, columns } = useKanbanStore();

  const allCards = useMemo(() => Object.values(cards), [cards]);

  // Status distribution — per column title
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const card of allCards) {
      const col = columns[card.columnId];
      if (col) counts[col.title] = (counts[col.title] ?? 0) + 1;
    }
    const COLORS = ["#7c3aed", "#2563eb", "#f97316", "#e11d48", "#22c55e"];
    return Object.entries(counts).map(([label, value], i) => ({
      label, value, color: COLORS[i % COLORS.length],
    }));
  }, [allCards, columns]);

  // Deliverable type distribution
  const typeData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const card of allCards) {
      if (card.deliverableType) counts[card.deliverableType] = (counts[card.deliverableType] ?? 0) + 1;
    }
    return Object.entries(DELIVERABLE_CONFIG)
      .map(([type, conf]) => ({ label: type, value: counts[type] ?? 0, color: conf.color }))
      .filter((d) => d.value > 0);
  }, [allCards]);

  // Published / completion rate
  const publishedCount = useMemo(() => {
    return allCards.filter((c) => {
      const col = columns[c.columnId];
      return col?.title.toLowerCase() === "published";
    }).length;
  }, [allCards, columns]);

  const overdueCount = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return allCards.filter((c) => {
      if (!c.dueDate) return false;
      const col = columns[c.columnId];
      if (col?.title.toLowerCase() === "published") return false;
      return new Date(c.dueDate + "T00:00:00") < t;
    }).length;
  }, [allCards, columns]);

  const publishedThisWeek = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return allCards.filter((c) => {
      const col = columns[c.columnId];
      if (col?.title.toLowerCase() !== "published") return false;
      return new Date(c.updatedAt) >= weekAgo;
    }).length;
  }, [allCards, columns]);

  const completionRate = allCards.length > 0
    ? Math.round((publishedCount / allCards.length) * 100)
    : 0;

  // Upcoming deadlines (next 7 days)
  const today = new Date();
  const in7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcoming = useMemo(() => {
    return allCards
      .filter((c) => {
        if (!c.dueDate) return false;
        const d = new Date(c.dueDate + "T00:00:00");
        return d >= today && d <= in7;
      })
      .sort((a, b) => (a.dueDate ?? "") < (b.dueDate ?? "") ? -1 : 1)
      .slice(0, 5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCards]);

  // Recently updated
  const recentCards = useMemo(() => {
    return [...allCards]
      .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1))
      .slice(0, 6);
  }, [allCards]);

  return (
    <div className="dashboard-page">
      {/* Today's Reels — priority top section */}
      <TodayReels />

      {/* Priority Videos */}
      <PriorityVideos />

      {/* Upcoming reel publish timeline */}
      <ReelTimeline />

      <div className="dashboard-header">
        <h2 className="dashboard-heading">Dashboard</h2>
        <p className="dashboard-subheading">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Stats row */}
      <div className="stats-grid">
        <StatCard
          accent="#7c3aed"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          }
          label="Total projects"
          value={boards.length}
          sub={boards.length > 0 ? `${boards.map(b => b.title).slice(0, 2).join(", ")}…` : "No projects yet"}
        />
        <StatCard
          accent="#2563eb"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <line x1="9" y1="9" x2="15" y2="9" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="15" x2="12" y2="15" />
            </svg>
          }
          label="Total cards"
          value={allCards.length}
          sub={`${publishedCount} published`}
        />
        <StatCard
          accent="#22c55e"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          }
          label="Completion rate"
          value={`${completionRate}%`}
          sub={`${publishedCount} of ${allCards.length} cards`}
        />
        <StatCard
          accent={overdueCount > 0 ? "#ef4444" : "#f97316"}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={overdueCount > 0 ? "#ef4444" : "#f97316"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
          label={overdueCount > 0 ? "Overdue" : "Due this week"}
          value={overdueCount > 0 ? overdueCount : upcoming.length}
          sub={overdueCount > 0
            ? `${upcoming.length} due this week`
            : upcoming.length > 0
              ? `Next: ${new Date(upcoming[0].dueDate! + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
              : "Nothing due soon"}
        />
      </div>

      {/* Charts row */}
      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-card-header">
            <h3 className="chart-card-title">Cards by status</h3>
          </div>
          {statusData.length > 0 ? (
            <>
              <BarChart data={statusData} />
              <div className="chart-legend">
                {statusData.map((d) => (
                  <span key={d.label} className="chart-legend-item">
                    <span className="chart-legend-dot" style={{ background: d.color }} />
                    {d.label}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="chart-empty">No cards yet</div>
          )}
        </div>

        <div className="chart-card">
          <div className="chart-card-header">
            <h3 className="chart-card-title">Deliverable types</h3>
          </div>
          {typeData.length > 0 ? (
            <>
              <DonutChart data={typeData} />
              <div className="chart-legend">
                {typeData.map((d) => (
                  <span key={d.label} className="chart-legend-item">
                    <span className="chart-legend-dot" style={{ background: d.color }} />
                    {DELIVERABLE_CONFIG[d.label]?.icon} {d.label} ({d.value})
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="chart-empty">No typed cards yet</div>
          )}
        </div>
      </div>

      {/* Deliverables summary */}
      <DeliverablesSummary />

      {/* Bottom row */}
      <div className="dashboard-bottom">
        {/* Upcoming deadlines */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3 className="dashboard-panel-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              Upcoming deadlines
            </h3>
          </div>
          {upcoming.length === 0 ? (
            <div className="dashboard-panel-empty">
              <span>🎉</span> Nothing due in the next 7 days
            </div>
          ) : (
            <div className="recent-cards-list">
              {upcoming.map((card) => <RecentCardRow key={card.id} card={card} />)}
            </div>
          )}
        </div>

        {/* Recently updated */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3 className="dashboard-panel-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Recently updated
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
              {publishedThisWeek > 0 && (
                <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 500 }}>
                  +{publishedThisWeek} published
                </span>
              )}
              {boards.length > 0 && (
                <Link href="/projects" className="dashboard-panel-link">See all</Link>
              )}
            </div>
          </div>
          {recentCards.length === 0 ? (
            <div className="dashboard-panel-empty">
              <span>📝</span> No cards yet. <Link href="/projects" className="dashboard-panel-link">Create a project</Link>
            </div>
          ) : (
            <div className="recent-cards-list">
              {recentCards.map((card) => <RecentCardRow key={card.id} card={card} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
