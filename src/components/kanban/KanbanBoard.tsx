"use client";

import { useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, closestCorners,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import type { Card } from "@/types/kanban";
import { useKanbanStore } from "@/store/kanban-store";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { CardModal } from "./CardModal";
import { FilterBar, DEFAULT_FILTERS, type FilterState } from "./FilterBar";

interface Props {
  boardId: string;
}

export function KanbanBoard({ boardId }: Props) {
  const {
    boards, cards, columns,
    addColumn, moveCardToColumn, reorderColumns,
    selectedCardId, closeCard,
  } = useKanbanStore();

  const board = boards.find((b) => b.id === boardId);
  const boardColumns = board?.columnIds.map((id) => columns[id]).filter(Boolean) ?? [];

  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColTitle, setNewColTitle] = useState("");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const isFiltered = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function cardMatchesFilters(card: Card): boolean {
    if (filters.priority !== "all" && card.priority !== filters.priority) return false;
    if (filters.deliverableType !== "all" && card.deliverableType !== filters.deliverableType) return false;
    if (filters.overdueOnly) {
      if (!card.dueDate) return false;
      if (new Date(card.dueDate + "T00:00:00") >= today) return false;
    }
    if (filters.hasScript && !card.description?.trim()) return false;
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      if (!card.title.toLowerCase().includes(q) && !card.description?.toLowerCase().includes(q)) return false;
    }
    return true;
  }

  const totalCards = board ? board.columnIds.flatMap((id) => columns[id]?.cardIds ?? []).length : 0;
  const filteredCards = board
    ? board.columnIds
        .flatMap((id) => (columns[id]?.cardIds ?? []).map((cid) => cards[cid]).filter(Boolean) as Card[])
        .filter(cardMatchesFilters).length
    : 0;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const activeCard = activeCardId ? cards[activeCardId] : null;
  const selectedCard = selectedCardId ? cards[selectedCardId] : null;

  function onDragStart({ active }: DragStartEvent) {
    setActiveCardId(active.id as string);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    const overIsColumn = boardColumns.some((c) => c.id === overId);
    const activeCard = cards[activeId];
    if (!activeCard) return;
    const fromColumnId = activeCard.columnId;
    if (overIsColumn) {
      if (fromColumnId !== overId) {
        const toCol = columns[overId];
        moveCardToColumn(activeId, overId, toCol?.cardIds.length ?? 0);
      }
    } else {
      const overCard = cards[overId];
      if (!overCard) return;
      const toColumnId = overCard.columnId;
      const toCol = columns[toColumnId];
      const overIndex = toCol?.cardIds.indexOf(overId) ?? 0;
      if (fromColumnId !== toColumnId || activeId !== overId) {
        moveCardToColumn(activeId, toColumnId, overIndex);
      }
    }
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveCardId(null);
    if (!over || active.id === over.id) return;
    const activeIsColumn = boardColumns.some((c) => c.id === active.id);
    const overIsColumn = boardColumns.some((c) => c.id === over.id);
    if (activeIsColumn && overIsColumn) {
      const colIds = board?.columnIds ?? [];
      const fromIndex = colIds.findIndex((id) => id === active.id);
      const toIndex = colIds.findIndex((id) => id === over.id);
      if (fromIndex !== toIndex) reorderColumns(boardId, fromIndex, toIndex);
    }
  }

  function commitAddColumn() {
    const title = newColTitle.trim();
    if (title) addColumn(boardId, title);
    setNewColTitle("");
    setAddingColumn(false);
  }

  if (!board) {
    return (
      <div className="kanban-empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2 }}>
          <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        <p>Board not found</p>
      </div>
    );
  }

  return (
    <>
      <FilterBar
        filters={filters}
        onChange={setFilters}
        cardCount={totalCards}
        filteredCount={filteredCards}
      />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="kanban-board">
          <SortableContext
            items={board.columnIds}
            strategy={horizontalListSortingStrategy}
          >
            {boardColumns.map((col) => {
              const colCards = col.cardIds.map((id) => cards[id]).filter(Boolean) as Card[];
              const visibleCards = isFiltered ? colCards.filter(cardMatchesFilters) : colCards;
              return (
                <KanbanColumn
                  key={col.id}
                  column={col}
                  cards={visibleCards}
                  boardId={boardId}
                />
              );
            })}
          </SortableContext>

          {/* Add column */}
          {addingColumn ? (
            <div className="kanban-add-column-form">
              <input
                autoFocus
                className="kanban-add-card-input"
                placeholder="Column title…"
                value={newColTitle}
                onChange={(e) => setNewColTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitAddColumn();
                  if (e.key === "Escape") { setNewColTitle(""); setAddingColumn(false); }
                }}
              />
              <div className="kanban-add-card-actions">
                <button className="kanban-btn-primary" onClick={commitAddColumn}>Add column</button>
                <button className="kanban-icon-btn" onClick={() => { setNewColTitle(""); setAddingColumn(false); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <button className="kanban-add-column-btn" onClick={() => setAddingColumn(true)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add column
            </button>
          )}
        </div>

        <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
          {activeCard ? (
            <KanbanCard card={activeCard} isDragOverlay onOpenModal={() => {}} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {selectedCard && <CardModal card={selectedCard} onClose={closeCard} />}
    </>
  );
}
