"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useKanbanStore } from "@/store/kanban-store";
import { DELIVERABLE_CONFIG } from "@/components/kanban/tag-colors";
import { CardModal } from "@/components/kanban/CardModal";
import { useReelsStore } from "@/lib/reels-store";
import type { Card, Board } from "@/types/kanban";

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Desktop: reel input for a single grid cell ────────────────────────────────

function DayReels({ dateStr }: { dateStr: string }) {
  const { getReels, addReel, removeReel } = useReelsStore();
  const reels = getReels(dateStr);
  const [inputVal, setInputVal] = useState("");
  const [showInput, setShowInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleAdd(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = inputVal.trim();
    if (!trimmed) { setShowInput(false); return; }
    addReel(dateStr, trimmed);
    setInputVal("");
    setShowInput(false);
  }

  return (
    <div className="cal-reels">
      {reels.map((r) => (
        <span key={r.id} className="cal-reel-chip">
          <span className="cal-reel-icon">🎬</span>
          <span className="cal-reel-name">{r.name}</span>
          <button className="cal-reel-remove" onClick={(e) => { e.stopPropagation(); removeReel(dateStr, r.id); }} aria-label="Remove reel">×</button>
        </span>
      ))}
      {showInput ? (
        <form onSubmit={handleAdd} className="cal-reel-form">
          <input
            ref={inputRef}
            className="cal-reel-input"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Reel name…"
            autoFocus
            onBlur={() => handleAdd()}
            onClick={(e) => e.stopPropagation()}
          />
        </form>
      ) : (
        <button
          className="cal-reel-add-btn"
          onClick={(e) => { e.stopPropagation(); setShowInput(true); setTimeout(() => inputRef.current?.focus(), 0); }}
          aria-label="Add reel" title="Add reel"
        >
          + reel
        </button>
      )}
    </div>
  );
}

// ── Mobile: single day row inside a week ─────────────────────────────────────

function MobileDayRow({
  date,
  dateStr,
  isToday,
  isPast,
  cards,
  boards,
  onOpenCard,
}: {
  date: Date;
  dateStr: string;
  isToday: boolean;
  isPast: boolean;
  cards: Card[];
  boards: Board[];
  onOpenCard: (id: string) => void;
}) {
  const { getReels, addReel, removeReel, renameReel } = useReelsStore();
  const reels = getReels(dateStr);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  const dayName  = date.toLocaleDateString("en-US", { weekday: "short" });
  const dayNum   = date.getDate();
  const hasContent = cards.length > 0 || reels.length > 0;

  function submitAdd() {
    const t = draft.trim();
    if (t) addReel(dateStr, t);
    setDraft("");
    setAdding(false);
  }

  function startEdit(id: string, name: string) {
    setEditingId(id);
    setEditDraft(name);
    setTimeout(() => { editRef.current?.focus(); editRef.current?.select(); }, 0);
  }

  function commitEdit() {
    if (editingId) {
      const t = editDraft.trim();
      if (t) renameReel(dateStr, editingId, t);
    }
    setEditingId(null);
  }

  return (
    <div className={`mcal-day ${isToday ? "mcal-today" : ""} ${isPast ? "mcal-past" : ""}`}>
      {/* Date label */}
      <div className="mcal-date-col">
        <span className="mcal-day-name">{dayName}</span>
        <span className={`mcal-day-num ${isToday ? "mcal-today-num" : ""}`}>{dayNum}</span>
      </div>

      {/* Content */}
      <div className="mcal-content-col">
        {/* Kanban cards */}
        {cards.map((card) => {
          const board = boards.find((b) => b.id === card.boardId);
          return (
            <button
              key={card.id}
              className="mcal-card-row"
              style={{ borderLeftColor: board?.color ?? "#7c3aed" }}
              onClick={() => onOpenCard(card.id)}
            >
              {card.deliverableType && DELIVERABLE_CONFIG[card.deliverableType] && (
                <span className="mcal-card-icon">{DELIVERABLE_CONFIG[card.deliverableType].icon}</span>
              )}
              <span className="mcal-card-title">{card.title}</span>
            </button>
          );
        })}

        {/* Reels */}
        {reels.map((r) => (
          <div key={r.id} className="mcal-reel-row">
            <span className="mcal-reel-icon">🎬</span>
            {editingId === r.id ? (
              <input
                ref={editRef}
                className="mcal-reel-edit-input"
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingId(null); }}
              />
            ) : (
              <span className="mcal-reel-name" onClick={() => startEdit(r.id, r.name)}>{r.name}</span>
            )}
            <div className="mcal-reel-actions">
              <button className="mcal-reel-edit-btn" onClick={() => startEdit(r.id, r.name)} aria-label="Edit">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/>
                </svg>
              </button>
              <button className="mcal-reel-remove-btn" onClick={() => removeReel(dateStr, r.id)} aria-label="Remove">×</button>
            </div>
          </div>
        ))}

        {/* Add reel form */}
        {adding ? (
          <div className="mcal-add-form">
            <input
              ref={inputRef}
              className="mcal-add-input"
              placeholder="Reel name…"
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitAdd(); if (e.key === "Escape") { setDraft(""); setAdding(false); } }}
              onBlur={submitAdd}
            />
          </div>
        ) : (
          <button
            className={`mcal-add-btn ${hasContent ? "mcal-add-btn-subtle" : ""}`}
            onClick={() => { setAdding(true); setTimeout(() => inputRef.current?.focus(), 0); }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add reel
          </button>
        )}
      </div>
    </div>
  );
}

// ── Mobile: week-by-week calendar ─────────────────────────────────────────────

function MobileCalendar({
  year,
  month,
  allCards,
  boards,
  todayStr,
  onOpenCard,
}: {
  year: number;
  month: number;
  allCards: Card[];
  boards: Board[];
  todayStr: string;
  onOpenCard: (id: string) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weeks = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDate = new Date(year, month + 1, 0).getDate();
    const startOffset = firstDay.getDay(); // 0=Sun

    // Build flat cells: nulls for padding + actual dates
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= lastDate; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);

    // Slice into weeks
    const result: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) result.push(cells.slice(i, i + 7));
    return result;
  }, [year, month]);

  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="mcal-wrapper">
      {/* Sticky day-of-week header */}
      <div className="mcal-dow-header">
        {DOW.map((d) => <span key={d} className="mcal-dow-label">{d}</span>)}
      </div>

      <div className="mcal-weeks">
        {weeks.map((week, wi) => {
          // Week label: pick first non-null date
          const firstDate = week.find(Boolean) as Date | undefined;
          const lastDate  = [...week].reverse().find(Boolean) as Date | undefined;
          const weekLabel = firstDate && lastDate
            ? `${firstDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${lastDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            : "";

          return (
            <div key={wi} className="mcal-week">
              <div className="mcal-week-label">
                <span>Week {wi + 1}</span>
                <span className="mcal-week-range">{weekLabel}</span>
              </div>
              {week.map((date, di) => {
                if (!date) return null; // skip padding nulls — don't render empty rows
                const dateStr = toDateStr(date);
                const isPast = date < today && dateStr !== todayStr;
                return (
                  <MobileDayRow
                    key={dateStr}
                    date={date}
                    dateStr={dateStr}
                    isToday={dateStr === todayStr}
                    isPast={isPast}
                    cards={allCards.filter((c) => c.dueDate === dateStr)}
                    boards={boards}
                    onOpenCard={onOpenCard}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main CalendarView ────────────────────────────────────────────────────────

export function CalendarView() {
  const { cards, boards, openCard, selectedCardId, closeCard } = useKanbanStore();
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 680px)");
    setIsMobile(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  const allCards = useMemo(() => Object.values(cards), [cards]);
  const selectedCard = selectedCardId ? cards[selectedCardId] : null;

  const { year, month } = currentDate;
  const firstDay   = new Date(year, month, 1);
  const lastDay    = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const totalDays  = lastDay.getDate();

  const calendarCells = useMemo(() => {
    const cells: { date: Date | null; cards: typeof allCards }[] = [];
    for (let i = 0; i < startOffset; i++) cells.push({ date: null, cards: [] });
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month, d);
      const dateStr = toDateStr(date);
      cells.push({ date, cards: allCards.filter((c) => c.dueDate === dateStr) });
    }
    while (cells.length < 42) cells.push({ date: null, cards: [] });
    return cells;
  }, [year, month, startOffset, totalDays, allCards]);

  const today    = new Date();
  const todayStr = toDateStr(today);
  const monthName = new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function prevMonth() {
    setCurrentDate(({ year, month }) => month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 });
  }
  function nextMonth() {
    setCurrentDate(({ year, month }) => month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 });
  }
  function goToday() {
    const d = new Date();
    setCurrentDate({ year: d.getFullYear(), month: d.getMonth() });
  }

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <div className="calendar-nav">
          <button className="calendar-nav-btn" onClick={prevMonth} aria-label="Previous month">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h2 className="calendar-month-title">{monthName}</h2>
          <button className="calendar-nav-btn" onClick={nextMonth} aria-label="Next month">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
        <button className="calendar-today-btn" onClick={goToday}>Today</button>
      </div>

      {isMobile ? (
        <MobileCalendar
          year={year}
          month={month}
          allCards={allCards}
          boards={boards}
          todayStr={todayStr}
          onOpenCard={openCard}
        />
      ) : (
        <div className="calendar-grid">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="calendar-day-label">{day}</div>
          ))}
          {calendarCells.map((cell, i) => {
            if (!cell.date) return <div key={i} className="calendar-cell empty" />;
            const d    = cell.date;
            const dateStr = toDateStr(d);
            const isToday = dateStr === todayStr;
            return (
              <div key={i} className={`calendar-cell ${isToday ? "today" : ""}`}>
                <span className={`calendar-day-num ${isToday ? "today" : ""}`}>{d.getDate()}</span>
                <div className="calendar-cell-cards">
                  {cell.cards.slice(0, 3).map((card) => {
                    const board  = boards.find((b) => b.id === card.boardId);
                    const isOverdue = new Date(card.dueDate! + "T00:00:00") < today && dateStr < todayStr;
                    return (
                      <button
                        key={card.id}
                        className={`calendar-card-chip ${isOverdue ? "overdue" : ""}`}
                        style={{ borderLeftColor: board?.color ?? "#7c3aed" }}
                        onClick={() => openCard(card.id)}
                        title={card.title}
                      >
                        {card.deliverableType && DELIVERABLE_CONFIG[card.deliverableType] && (
                          <span style={{ fontSize: 9, opacity: 0.7 }}>{DELIVERABLE_CONFIG[card.deliverableType].icon}</span>
                        )}
                        <span className="calendar-card-title">{card.title}</span>
                      </button>
                    );
                  })}
                  {cell.cards.length > 3 && <span className="calendar-more-badge">+{cell.cards.length - 3} more</span>}
                </div>
                <DayReels dateStr={dateStr} />
              </div>
            );
          })}
        </div>
      )}

      {selectedCard && <CardModal card={selectedCard} onClose={closeCard} />}
    </div>
  );
}
