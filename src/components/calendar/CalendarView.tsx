"use client";

import { useState, useMemo } from "react";
import { useKanbanStore } from "@/store/kanban-store";
import { DELIVERABLE_CONFIG } from "@/components/kanban/tag-colors";
import { CardModal } from "@/components/kanban/CardModal";

export function CalendarView() {
  const { cards, boards, openCard, selectedCardId, closeCard } = useKanbanStore();
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const allCards = useMemo(() => Object.values(cards), [cards]);
  const selectedCard = selectedCardId ? cards[selectedCardId] : null;

  const { year, month } = currentDate;
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const calendarCells = useMemo(() => {
    const cells: { date: Date | null; cards: typeof allCards }[] = [];
    for (let i = 0; i < startOffset; i++) cells.push({ date: null, cards: [] });
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month, d);
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayCards = allCards.filter((c) => c.dueDate === dateStr);
      cells.push({ date, cards: dayCards });
    }
    while (cells.length < 42) cells.push({ date: null, cards: [] });
    return cells;
  }, [year, month, startOffset, totalDays, allCards]);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const monthName = new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function prevMonth() {
    setCurrentDate(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
    );
  }
  function nextMonth() {
    setCurrentDate(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
    );
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

      <div className="calendar-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="calendar-day-label">{day}</div>
        ))}

        {calendarCells.map((cell, i) => {
          if (!cell.date) return <div key={i} className="calendar-cell empty" />;
          const d = cell.date;
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          const isToday = dateStr === todayStr;
          return (
            <div key={i} className={`calendar-cell ${isToday ? "today" : ""}`}>
              <span className={`calendar-day-num ${isToday ? "today" : ""}`}>
                {d.getDate()}
              </span>
              <div className="calendar-cell-cards">
                {cell.cards.slice(0, 3).map((card) => {
                  const board = boards.find((b) => b.id === card.boardId);
                  const cardDate = new Date(card.dueDate! + "T00:00:00");
                  const isOverdue = cardDate < today && dateStr < todayStr;
                  return (
                    <button
                      key={card.id}
                      className={`calendar-card-chip ${isOverdue ? "overdue" : ""}`}
                      style={{ borderLeftColor: board?.color ?? "#7c3aed" }}
                      onClick={() => openCard(card.id)}
                      title={card.title}
                    >
                      {card.deliverableType && DELIVERABLE_CONFIG[card.deliverableType] && (
                        <span style={{ fontSize: 9, opacity: 0.7 }}>
                          {DELIVERABLE_CONFIG[card.deliverableType].icon}
                        </span>
                      )}
                      <span className="calendar-card-title">{card.title}</span>
                    </button>
                  );
                })}
                {cell.cards.length > 3 && (
                  <span className="calendar-more-badge">+{cell.cards.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedCard && <CardModal card={selectedCard} onClose={closeCard} />}
    </div>
  );
}
