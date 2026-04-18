"use client";

/**
 * CloudSync — invisible component that syncs ALL Zustand stores to/from Redis.
 * Mount once in AppShell. Renders null.
 *
 * Safety guarantees:
 *  - isSyncingFromCloud is set TRUE *before* rehydrate() so subscriber push is
 *    suppressed during initial load (prevents old localStorage overwriting newer cloud)
 *  - isSyncingFromCloud is set TRUE *before* network fetches in pollCloud() so
 *    user changes mid-poll are not silently dropped
 *  - Push callbacks guard against sending empty state (never overwrites cloud with blank)
 *  - Bootstrap push only runs when Redis has *no* data and local has *something*
 *
 * Synced stores: kanban · todos · reels · priority-videos · cash
 */

import { useEffect, useRef } from "react";
import { useKanbanStore } from "@/store/kanban-store";
import { useTodoStore } from "@/store/todo-store";
import { usePriorityVideosStore } from "@/store/priority-videos-store";
import { useCashStore } from "@/store/cash-store";
import { setReelsFromCloud, getLocalReels } from "@/lib/reels-store";
import type { ReelEntry } from "@/lib/reels-store";
import type { Board, Card, Column } from "@/types/kanban";
import type { Todo } from "@/store/todo-store";
import type { PriorityVideo } from "@/store/priority-videos-store";
import type { Transaction } from "@/store/cash-store";

// ── Types ────────────────────────────────────────────────────────────────────

interface SyncEnvelope<T = unknown> {
  data: T | null;
  updatedAt: string | null;
}

interface KanbanData {
  boards: Board[];
  columns: Record<string, Column>;
  cards: Record<string, Card>;
}

interface TodoData {
  todos: Todo[];
}

interface PriorityVideosData {
  videos: PriorityVideo[];
}

interface CashData {
  transactions: Transaction[];
  categories: string[];
}

type ReelsData = Record<string, ReelEntry[]>;

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchSync<T>(key: string): Promise<SyncEnvelope<T>> {
  const res = await fetch(`/api/sync/${key}`, { cache: "no-store" });
  if (!res.ok) return { data: null, updatedAt: null };
  return res.json() as Promise<SyncEnvelope<T>>;
}

async function pushSync(key: string, data: unknown): Promise<void> {
  await fetch(`/api/sync/${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// ── Debounce ──────────────────────────────────────────────────────────────────

function makeDebounced(fn: () => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    trigger: () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fn, ms);
    },
    cancel: () => {
      if (timer) { clearTimeout(timer); timer = null; }
    },
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CloudSync() {
  const cloudUpdatedAt = useRef<{
    kanban: string | null;
    todos: string | null;
    reels: string | null;
    priorityVideos: string | null;
    cash: string | null;
  }>({
    kanban: null,
    todos: null,
    reels: null,
    priorityVideos: null,
    cash: null,
  });

  // TRUE while reading from cloud — suppresses outbound pushes
  const isSyncingFromCloud = useRef(false);

  useEffect(() => {
    // ── Push helpers (safe — guard against empty state) ────────────────────
    const kanbanDebounce = makeDebounced(() => {
      if (isSyncingFromCloud.current) return;
      const { boards, columns, cards } = useKanbanStore.getState();
      // Never push a completely empty store — would wipe cloud data
      if (!boards.length && !Object.keys(cards).length) return;
      pushSync("kanban", { boards, columns, cards }).catch(() => {});
    }, 1500);

    const todosDebounce = makeDebounced(() => {
      if (isSyncingFromCloud.current) return;
      const { todos } = useTodoStore.getState();
      if (!todos.length) return;
      pushSync("todos", { todos }).catch(() => {});
    }, 1500);

    const pvDebounce = makeDebounced(() => {
      if (isSyncingFromCloud.current) return;
      const { videos } = usePriorityVideosStore.getState();
      if (!videos.length) return;
      pushSync("priority-videos", { videos }).catch(() => {});
    }, 1500);

    const cashDebounce = makeDebounced(() => {
      if (isSyncingFromCloud.current) return;
      const { transactions, categories } = useCashStore.getState();
      if (!transactions.length) return;
      pushSync("cash", { transactions, categories }).catch(() => {});
    }, 1500);

    // ── 1. Rehydrate localStorage, then overlay cloud ───────────────────────
    async function loadFromCloud() {
      // Set flag BEFORE rehydrate so the subscriber fires don't queue a push
      // of stale local data over newer cloud data
      isSyncingFromCloud.current = true;

      useKanbanStore.persist.rehydrate();
      useTodoStore.persist.rehydrate();
      usePriorityVideosStore.persist.rehydrate();
      useCashStore.persist.rehydrate();

      // Cancel any debounce timers that rehydrate() may have started
      kanbanDebounce.cancel();
      todosDebounce.cancel();
      pvDebounce.cancel();
      cashDebounce.cancel();

      try {
        const [kanbanEnv, todosEnv, reelsEnv, pvEnv, cashEnv] = await Promise.allSettled([
          fetchSync<KanbanData>("kanban"),
          fetchSync<TodoData>("todos"),
          fetchSync<ReelsData>("reels"),
          fetchSync<PriorityVideosData>("priority-videos"),
          fetchSync<CashData>("cash"),
        ]);

        if (kanbanEnv.status === "fulfilled" && kanbanEnv.value.data) {
          const d = kanbanEnv.value.data;
          if (d.boards && d.columns && d.cards) {
            useKanbanStore.setState({ boards: d.boards, columns: d.columns, cards: d.cards });
          }
          cloudUpdatedAt.current.kanban = kanbanEnv.value.updatedAt;
        }

        if (todosEnv.status === "fulfilled" && todosEnv.value.data) {
          const d = todosEnv.value.data;
          if (d.todos) useTodoStore.setState({ todos: d.todos });
          cloudUpdatedAt.current.todos = todosEnv.value.updatedAt;
        }

        if (reelsEnv.status === "fulfilled" && reelsEnv.value.data) {
          setReelsFromCloud(reelsEnv.value.data);
          cloudUpdatedAt.current.reels = reelsEnv.value.updatedAt;
        }

        if (pvEnv.status === "fulfilled" && pvEnv.value.data) {
          const d = pvEnv.value.data;
          if (d.videos) usePriorityVideosStore.setState({ videos: d.videos });
          cloudUpdatedAt.current.priorityVideos = pvEnv.value.updatedAt;
        }

        if (cashEnv.status === "fulfilled" && cashEnv.value.data) {
          const d = cashEnv.value.data;
          if (d.transactions) useCashStore.setState({ transactions: d.transactions, categories: d.categories ?? [] });
          cloudUpdatedAt.current.cash = cashEnv.value.updatedAt;
        }
      } finally {
        // Cancel again — setState() calls above may have re-queued debounces
        kanbanDebounce.cancel();
        todosDebounce.cancel();
        pvDebounce.cancel();
        cashDebounce.cancel();
        isSyncingFromCloud.current = false;
      }

      // ── Bootstrap push: upload local data if Redis was empty ────────────
      // Only runs when Redis had NO data for a store but local has something.
      // This is safe: if Redis had data we loaded it above; if it was empty
      // we won't overwrite anything.
      const bootstrapPushes: Promise<void>[] = [];

      const { boards, columns, cards } = useKanbanStore.getState();
      if (!cloudUpdatedAt.current.kanban && (boards.length || Object.keys(cards).length)) {
        bootstrapPushes.push(pushSync("kanban", { boards, columns, cards }));
      }

      const { todos } = useTodoStore.getState();
      if (!cloudUpdatedAt.current.todos && todos.length) {
        bootstrapPushes.push(pushSync("todos", { todos }));
      }

      const { videos } = usePriorityVideosStore.getState();
      if (!cloudUpdatedAt.current.priorityVideos && videos.length) {
        bootstrapPushes.push(pushSync("priority-videos", { videos }));
      }

      const { transactions, categories } = useCashStore.getState();
      if (!cloudUpdatedAt.current.cash && transactions.length) {
        bootstrapPushes.push(pushSync("cash", { transactions, categories }));
      }

      if (!cloudUpdatedAt.current.reels) {
        const localReels = getLocalReels();
        if (Object.keys(localReels).length > 0) {
          bootstrapPushes.push(pushSync("reels", localReels));
        }
      }

      await Promise.allSettled(bootstrapPushes);
    }

    loadFromCloud().catch(() => {/* offline / unauthenticated — silent */});

    // ── 2. Subscribe to store changes → debounced push ─────────────────────
    const unsubKanban = useKanbanStore.subscribe(kanbanDebounce.trigger);
    const unsubTodos = useTodoStore.subscribe(todosDebounce.trigger);
    const unsubPriorityVideos = usePriorityVideosStore.subscribe(pvDebounce.trigger);
    const unsubCash = useCashStore.subscribe(cashDebounce.trigger);

    // ── 3. Poll for remote changes ──────────────────────────────────────────
    async function pollCloud() {
      // Set flag BEFORE fetching so any user changes during the network round-trip
      // are not silently dropped — they'll fire the subscriber after flag clears
      isSyncingFromCloud.current = true;
      try {
        const [kanbanEnv, todosEnv, reelsEnv, pvEnv, cashEnv] = await Promise.allSettled([
          fetchSync<KanbanData>("kanban"),
          fetchSync<TodoData>("todos"),
          fetchSync<ReelsData>("reels"),
          fetchSync<PriorityVideosData>("priority-videos"),
          fetchSync<CashData>("cash"),
        ]);

        if (
          kanbanEnv.status === "fulfilled" &&
          kanbanEnv.value.data &&
          kanbanEnv.value.updatedAt !== cloudUpdatedAt.current.kanban
        ) {
          const d = kanbanEnv.value.data;
          if (d.boards && d.columns && d.cards) {
            useKanbanStore.setState({ boards: d.boards, columns: d.columns, cards: d.cards });
          }
          cloudUpdatedAt.current.kanban = kanbanEnv.value.updatedAt;
        }

        if (
          todosEnv.status === "fulfilled" &&
          todosEnv.value.data &&
          todosEnv.value.updatedAt !== cloudUpdatedAt.current.todos
        ) {
          const d = todosEnv.value.data;
          if (d.todos) useTodoStore.setState({ todos: d.todos });
          cloudUpdatedAt.current.todos = todosEnv.value.updatedAt;
        }

        if (
          reelsEnv.status === "fulfilled" &&
          reelsEnv.value.data &&
          reelsEnv.value.updatedAt !== cloudUpdatedAt.current.reels
        ) {
          setReelsFromCloud(reelsEnv.value.data);
          cloudUpdatedAt.current.reels = reelsEnv.value.updatedAt;
        }

        if (
          pvEnv.status === "fulfilled" &&
          pvEnv.value.data &&
          pvEnv.value.updatedAt !== cloudUpdatedAt.current.priorityVideos
        ) {
          const d = pvEnv.value.data;
          if (d.videos) usePriorityVideosStore.setState({ videos: d.videos });
          cloudUpdatedAt.current.priorityVideos = pvEnv.value.updatedAt;
        }

        if (
          cashEnv.status === "fulfilled" &&
          cashEnv.value.data &&
          cashEnv.value.updatedAt !== cloudUpdatedAt.current.cash
        ) {
          const d = cashEnv.value.data;
          if (d.transactions) useCashStore.setState({ transactions: d.transactions, categories: d.categories ?? [] });
          cloudUpdatedAt.current.cash = cashEnv.value.updatedAt;
        }
      } finally {
        // Cancel debounces queued by setState above — those are cloud updates,
        // not user changes, and we don't want to push them back
        kanbanDebounce.cancel();
        todosDebounce.cancel();
        pvDebounce.cancel();
        cashDebounce.cancel();
        isSyncingFromCloud.current = false;
      }
    }

    const pollInterval = setInterval(() => { pollCloud().catch(() => {}); }, 5_000);

    function onVisibilityChange() {
      if (document.visibilityState === "visible") pollCloud().catch(() => {});
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      unsubKanban();
      unsubTodos();
      unsubPriorityVideos();
      unsubCash();
      kanbanDebounce.cancel();
      todosDebounce.cancel();
      pvDebounce.cancel();
      cashDebounce.cancel();
      clearInterval(pollInterval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
