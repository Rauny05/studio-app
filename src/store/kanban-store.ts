import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Board, Card, Column } from "@/types/kanban";
import { useVaultStore } from "@/store/vault-store";

type CardMap = Record<string, Card>;
type ColumnMap = Record<string, Column>;

interface KanbanStore {
  boards: Board[];
  columns: ColumnMap;
  cards: CardMap;

  // Modal
  selectedCardId: string | null;
  openCard: (id: string) => void;
  closeCard: () => void;

  // Boards
  addBoard: (board: Omit<Board, "id" | "columnIds" | "createdAt" | "updatedAt">) => string;
  updateBoard: (id: string, updates: Partial<Omit<Board, "id" | "columnIds" | "createdAt" | "updatedAt">>) => void;
  deleteBoard: (id: string) => void;
  duplicateBoard: (id: string) => void;

  // Columns
  addColumn: (boardId: string, title: string) => void;
  removeColumn: (boardId: string, columnId: string) => void;
  renameColumn: (columnId: string, title: string) => void;
  reorderColumns: (boardId: string, fromIndex: number, toIndex: number) => void;

  // Cards
  addCard: (columnId: string, boardId: string, card: Omit<Card, "id" | "columnId" | "boardId" | "createdAt" | "updatedAt">) => string;
  updateCard: (id: string, updates: Partial<Omit<Card, "id" | "columnId" | "boardId" | "createdAt">>) => void;
  deleteCard: (id: string) => void;
  duplicateCard: (id: string) => void;

  // DnD
  moveCardToColumn: (cardId: string, toColumnId: string, atIndex: number) => void;
  reorderCards: (columnId: string, fromIndex: number, toIndex: number) => void;

  // Vault
  loadFromVault: () => Promise<void>;

  // Search / filter helpers
  searchCards: (query: string) => Card[];
  getCardsByBoard: (boardId: string) => Card[];
  getColumnsByBoard: (boardId: string) => Column[];
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function now() {
  return new Date().toISOString();
}

// ── Default seed data (stable IDs to avoid SSR hydration mismatch) ───────────

const COL_IDEAS     = "col-seed-1";
const COL_WRITING   = "col-seed-2";
const COL_PRODUCTION = "col-seed-3";
const COL_EDITING   = "col-seed-4";
const COL_PUBLISHED = "col-seed-5";

const BOARD_ID = "board-seed-1";

const card1: Card = {
  id: "card-seed-1", boardId: BOARD_ID, columnId: COL_IDEAS,
  title: "Why 90% of Creators Quit",
  description: "# Hook\nMost creators quit within 6 months. Here's why that's actually great news for you...",
  deliverableType: "Reel",
  thumbnailUrl: null, videoLink: null,
  tags: [{ id: "tag-s1", label: "Growth", color: "purple" }],
  priority: "high", dueDate: "2026-04-20", notes: "", createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z",
};

const card2: Card = {
  id: "card-seed-2", boardId: BOARD_ID, columnId: COL_WRITING,
  title: "My Full Morning Routine 2026",
  description: "# Script\nWake up at 5am, cold shower, journaling, deep work block...",
  deliverableType: "YouTube",
  thumbnailUrl: null, videoLink: null,
  tags: [{ id: "tag-s2", label: "Lifestyle", color: "green" }],
  priority: "medium", dueDate: "2026-04-25", notes: "Need B-roll of desk setup", createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z",
};

const card3: Card = {
  id: "card-seed-3", boardId: BOARD_ID, columnId: COL_PRODUCTION,
  title: "10 Figma Tips You're Missing",
  description: "Rapid fire tips — auto layout, variables, components...",
  deliverableType: "Short",
  thumbnailUrl: null, videoLink: null,
  tags: [{ id: "tag-s3", label: "Design", color: "purple" }],
  priority: "medium", dueDate: "2026-04-18", notes: "", createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z",
};

const card4: Card = {
  id: "card-seed-4", boardId: BOARD_ID, columnId: COL_EDITING,
  title: "I Redesigned My Brand in 48hrs",
  description: "Time-lapse + narration of the full rebrand process...",
  deliverableType: "YouTube",
  thumbnailUrl: null, videoLink: null,
  tags: [{ id: "tag-s4", label: "Branding", color: "orange" }],
  priority: "high", dueDate: "2026-04-17", notes: "Add sponsor segment at 4:30", createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z",
};

const card5: Card = {
  id: "card-seed-5", boardId: BOARD_ID, columnId: COL_PUBLISHED,
  title: "Build in Public: Week 1",
  description: "Sharing my journey building the studio app...",
  deliverableType: "Post",
  thumbnailUrl: null, videoLink: "https://youtube.com/watch?v=example",
  tags: [{ id: "tag-s5", label: "BTS", color: "blue" }],
  priority: "low", dueDate: null, notes: "Posted on April 1", createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z",
};

const DEFAULT_BOARDS: Board[] = [
  {
    id: BOARD_ID,
    title: "Content Calendar",
    description: "Main channel content pipeline",
    color: "#7c3aed",
    emoji: "🎬",
    columnIds: [COL_IDEAS, COL_WRITING, COL_PRODUCTION, COL_EDITING, COL_PUBLISHED],
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
];

const DEFAULT_COLUMNS: ColumnMap = {
  [COL_IDEAS]: { id: COL_IDEAS, title: "Ideas", cardIds: [card1.id] },
  [COL_WRITING]: { id: COL_WRITING, title: "Writing", cardIds: [card2.id] },
  [COL_PRODUCTION]: { id: COL_PRODUCTION, title: "Production", cardIds: [card3.id] },
  [COL_EDITING]: { id: COL_EDITING, title: "Editing", cardIds: [card4.id] },
  [COL_PUBLISHED]: { id: COL_PUBLISHED, title: "Published", cardIds: [card5.id] },
};

const DEFAULT_CARDS: CardMap = {
  [card1.id]: card1,
  [card2.id]: card2,
  [card3.id]: card3,
  [card4.id]: card4,
  [card5.id]: card5,
};

// ── Store ────────────────────────────────────────────────────────────────────

export const useKanbanStore = create<KanbanStore>()(
  persist(
    (set, get) => ({
      boards: DEFAULT_BOARDS,
      columns: DEFAULT_COLUMNS,
      cards: DEFAULT_CARDS,
      selectedCardId: null,

      openCard: (id) => set({ selectedCardId: id }),
      closeCard: () => set({ selectedCardId: null }),

      // ── Vault ────────────────────────────────────────────────────────────────
      loadFromVault: async () => {
        const res = await fetch("/api/vault/load");
        if (!res.ok) return;
        const data = await res.json();
        if (!data.boards || !data.columns || !data.cards) return;

        // Merge: preserve in-memory boards that aren't in vault yet (mid-creation race).
        // Exclude seed boards (board-seed-*) — those are defaults that vault should replace.
        const current = get();
        const vaultBoardIds = new Set<string>(data.boards.map((b: Board) => b.id));
        const pendingBoards = current.boards.filter(
          (b) => !vaultBoardIds.has(b.id) && !b.id.startsWith("board-seed-")
        );

        if (pendingBoards.length > 0) {
          const mergedColumns = { ...data.columns };
          const mergedCards = { ...data.cards };
          pendingBoards.forEach((board) => {
            board.columnIds.forEach((colId) => {
              if (current.columns[colId]) {
                mergedColumns[colId] = current.columns[colId];
                current.columns[colId].cardIds.forEach((cardId) => {
                  if (current.cards[cardId]) mergedCards[cardId] = current.cards[cardId];
                });
              }
            });
          });
          set({
            boards: [...data.boards, ...pendingBoards],
            columns: mergedColumns,
            cards: mergedCards,
          });
        } else if (data.boards.length > 0) {
          set({ boards: data.boards, columns: data.columns, cards: data.cards });
        }
      },

      // ── Boards ──────────────────────────────────────────────────────────────
      addBoard: (boardData) => {
        const id = uid();
        const colIds = ["Ideas", "Writing", "Production", "Editing", "Published"].map(
          (title) => {
            const cid = uid();
            set((s) => ({
              columns: { ...s.columns, [cid]: { id: cid, title, cardIds: [] } },
            }));
            return cid;
          }
        );
        const board: Board = {
          ...boardData, id, columnIds: colIds, createdAt: now(), updatedAt: now(),
        };
        set((s) => ({ boards: [...s.boards, board] }));

        // Vault sync (fire-and-forget)
        const { vaultPath } = useVaultStore.getState();
        if (vaultPath) {
          const newBoard = get().boards.find((b) => b.id === id);
          if (newBoard) {
            const colTitles = newBoard.columnIds
              .map((cid) => get().columns[cid]?.title)
              .filter(Boolean) as string[];
            fetch("/api/vault/board", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ board: newBoard, columnOrder: colTitles }),
            }).catch(console.error);
          }
        }

        return id;
      },

      updateBoard: (id, updates) =>
        set((s) => ({
          boards: s.boards.map((b) =>
            b.id === id ? { ...b, ...updates, updatedAt: now() } : b
          ),
        })),

      deleteBoard: (id) => {
        const boardToDelete = get().boards.find((b) => b.id === id);
        set((s) => {
          const board = s.boards.find((b) => b.id === id);
          if (!board) return s;
          const nextColumns = { ...s.columns };
          const nextCards = { ...s.cards };
          board.columnIds.forEach((cid) => {
            nextColumns[cid]?.cardIds.forEach((cardId) => delete nextCards[cardId]);
            delete nextColumns[cid];
          });
          return {
            boards: s.boards.filter((b) => b.id !== id),
            columns: nextColumns,
            cards: nextCards,
          };
        });

        // Vault sync (fire-and-forget)
        if (boardToDelete) {
          const { vaultPath } = useVaultStore.getState();
          if (vaultPath) {
            fetch(`/api/vault/board?boardTitle=${encodeURIComponent(boardToDelete.title)}`, {
              method: "DELETE",
            }).catch(console.error);
          }
        }
      },

      duplicateBoard: (id) => {
        const { boards, columns, cards, addBoard } = get();
        const src = boards.find((b) => b.id === id);
        if (!src) return;
        const newBoardId = addBoard({
          title: src.title + " (Copy)",
          description: src.description,
          color: src.color,
          emoji: src.emoji,
        });
        // Copy cards into new board's columns
        const newBoard = get().boards.find((b) => b.id === newBoardId)!;
        src.columnIds.forEach((srcColId, i) => {
          const srcCol = columns[srcColId];
          const dstColId = newBoard.columnIds[i];
          if (!srcCol || !dstColId) return;
          srcCol.cardIds.forEach((cardId) => {
            const card = cards[cardId];
            if (!card) return;
            const { id: _id, columnId: _cId, boardId: _bId, createdAt: _cr, updatedAt: _up, ...rest } = card;
            get().addCard(dstColId, newBoardId, rest);
          });
        });
      },

      // ── Columns ──────────────────────────────────────────────────────────────
      addColumn: (boardId, title) => {
        const cid = uid();
        set((s) => ({
          columns: { ...s.columns, [cid]: { id: cid, title, cardIds: [] } },
          boards: s.boards.map((b) =>
            b.id === boardId
              ? { ...b, columnIds: [...b.columnIds, cid], updatedAt: now() }
              : b
          ),
        }));
      },

      removeColumn: (boardId, columnId) =>
        set((s) => {
          const col = s.columns[columnId];
          const nextCards = { ...s.cards };
          col?.cardIds.forEach((cid) => delete nextCards[cid]);
          const { [columnId]: _removed, ...nextCols } = s.columns;
          return {
            columns: nextCols,
            cards: nextCards,
            boards: s.boards.map((b) =>
              b.id === boardId
                ? { ...b, columnIds: b.columnIds.filter((id) => id !== columnId) }
                : b
            ),
          };
        }),

      renameColumn: (columnId, title) =>
        set((s) => ({
          columns: {
            ...s.columns,
            [columnId]: { ...s.columns[columnId], title },
          },
        })),

      reorderColumns: (boardId, fromIndex, toIndex) =>
        set((s) => {
          const board = s.boards.find((b) => b.id === boardId);
          if (!board) return s;
          const colIds = [...board.columnIds];
          const [moved] = colIds.splice(fromIndex, 1);
          colIds.splice(toIndex, 0, moved);
          return {
            boards: s.boards.map((b) =>
              b.id === boardId ? { ...b, columnIds: colIds } : b
            ),
          };
        }),

      // ── Cards ────────────────────────────────────────────────────────────────
      addCard: (columnId, boardId, cardData) => {
        const id = uid();
        const card: Card = {
          ...cardData,
          id,
          columnId,
          boardId,
          createdAt: now(),
          updatedAt: now(),
        };
        set((s) => ({
          cards: { ...s.cards, [id]: card },
          columns: {
            ...s.columns,
            [columnId]: {
              ...s.columns[columnId],
              cardIds: [...(s.columns[columnId]?.cardIds ?? []), id],
            },
          },
        }));

        // Vault sync (fire-and-forget)
        const { vaultPath } = useVaultStore.getState();
        if (vaultPath) {
          const col = get().columns[columnId];
          const board = get().boards.find((b) => b.id === boardId);
          if (col && board) {
            fetch("/api/vault/card", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ card, columnTitle: col.title, boardTitle: board.title }),
            }).catch(console.error);
          }
        }

        return id;
      },

      updateCard: (id, updates) => {
        set((s) => ({
          cards: {
            ...s.cards,
            [id]: { ...s.cards[id], ...updates, updatedAt: now() },
          },
        }));

        // Vault sync (fire-and-forget)
        const { vaultPath } = useVaultStore.getState();
        if (vaultPath) {
          const updatedCard = get().cards[id];
          if (updatedCard) {
            const col = get().columns[updatedCard.columnId];
            const board = get().boards.find((b) => b.id === updatedCard.boardId);
            if (col && board) {
              fetch("/api/vault/card", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ card: updatedCard, columnTitle: col.title, boardTitle: board.title }),
              }).catch(console.error);
            }
          }
        }
      },

      deleteCard: (id) => {
        const cardToDelete = get().cards[id];
        set((s) => {
          const { [id]: _removed, ...nextCards } = s.cards;
          const nextCols: ColumnMap = {};
          for (const [k, col] of Object.entries(s.columns)) {
            nextCols[k] = { ...col, cardIds: col.cardIds.filter((cid) => cid !== id) };
          }
          return { cards: nextCards, columns: nextCols };
        });

        // Vault sync (fire-and-forget)
        if (cardToDelete) {
          const { vaultPath } = useVaultStore.getState();
          if (vaultPath) {
            const board = get().boards.find((b) => b.id === cardToDelete.boardId);
            if (board) {
              fetch(`/api/vault/card?cardId=${cardToDelete.id}&boardTitle=${encodeURIComponent(board.title)}`, {
                method: "DELETE",
              }).catch(console.error);
            }
          }
        }
      },

      duplicateCard: (id) => {
        const { cards, addCard } = get();
        const src = cards[id];
        if (!src) return;
        const { id: _id, columnId, boardId, createdAt: _cr, updatedAt: _up, ...rest } = src;
        addCard(columnId, boardId, { ...rest, title: rest.title + " (Copy)" });
      },

      // ── DnD ──────────────────────────────────────────────────────────────────
      moveCardToColumn: (cardId, toColumnId, atIndex) => {
        set((s) => {
          const card = s.cards[cardId];
          if (!card) return s;
          const fromColumnId = card.columnId;
          const nextCols = { ...s.columns };

          if (fromColumnId !== toColumnId) {
            nextCols[fromColumnId] = {
              ...nextCols[fromColumnId],
              cardIds: nextCols[fromColumnId].cardIds.filter((id) => id !== cardId),
            };
          }

          const destIds = nextCols[toColumnId].cardIds.filter((id) => id !== cardId);
          destIds.splice(atIndex, 0, cardId);
          nextCols[toColumnId] = { ...nextCols[toColumnId], cardIds: destIds };

          return {
            columns: nextCols,
            cards: { ...s.cards, [cardId]: { ...card, columnId: toColumnId, updatedAt: now() } },
          };
        });

        // Vault sync (fire-and-forget)
        const { vaultPath } = useVaultStore.getState();
        if (vaultPath) {
          const movedCard = get().cards[cardId];
          if (movedCard) {
            const col = get().columns[toColumnId];
            const board = get().boards.find((b) => b.id === movedCard.boardId);
            if (col && board) {
              fetch("/api/vault/card", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ card: movedCard, columnTitle: col.title, boardTitle: board.title }),
              }).catch(console.error);
            }
          }
        }
      },

      reorderCards: (columnId, fromIndex, toIndex) =>
        set((s) => {
          const col = s.columns[columnId];
          if (!col) return s;
          const ids = [...col.cardIds];
          const [moved] = ids.splice(fromIndex, 1);
          ids.splice(toIndex, 0, moved);
          return {
            columns: { ...s.columns, [columnId]: { ...col, cardIds: ids } },
          };
        }),

      // ── Helpers ──────────────────────────────────────────────────────────────
      searchCards: (query) => {
        const q = query.toLowerCase().trim();
        if (!q) return [];
        return Object.values(get().cards).filter(
          (c) =>
            c.title.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q) ||
            c.tags.some((t) => t.label.toLowerCase().includes(q))
        );
      },

      getCardsByBoard: (boardId) =>
        Object.values(get().cards).filter((c) => c.boardId === boardId),

      getColumnsByBoard: (boardId) => {
        const board = get().boards.find((b) => b.id === boardId);
        if (!board) return [];
        return board.columnIds
          .map((id) => get().columns[id])
          .filter(Boolean) as Column[];
      },
    }),
    {
      name: "studio-kanban-v2",
      partialize: (s) => ({ boards: s.boards, columns: s.columns, cards: s.cards }),
      skipHydration: true,
    }
  )
);

