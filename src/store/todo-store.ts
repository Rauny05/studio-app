"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TodoAccess = "all" | string[]; // "all" = anyone with todos permission

export interface Todo {
  id: string;
  title: string;
  description?: string;
  link?: string;
  linkLabel?: string;
  color: string; // flashcard accent color
  completed: boolean;
  /** Emails that can view this todo (or "all") */
  viewAccess: TodoAccess;
  /** Emails that can edit/delete this todo (or "all") */
  editAccess: TodoAccess;
  createdAt: string;
  updatedAt: string;
  createdBy: string; // email of creator
}

const CARD_COLORS = [
  "#7c3aed", "#2563eb", "#059669", "#d97706",
  "#dc2626", "#db2777", "#0891b2", "#65a30d",
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function nextColor(todos: Todo[]): string {
  const used = todos.map((t) => t.color);
  return CARD_COLORS.find((c) => !used.includes(c)) ?? CARD_COLORS[todos.length % CARD_COLORS.length];
}

interface TodoStore {
  todos: Todo[];
  addTodo: (data: {
    title: string;
    description?: string;
    link?: string;
    linkLabel?: string;
    color?: string;
    viewAccess?: TodoAccess;
    editAccess?: TodoAccess;
    createdBy: string;
  }) => Todo;
  updateTodo: (id: string, patch: Partial<Omit<Todo, "id" | "createdAt" | "createdBy">>) => void;
  deleteTodo: (id: string) => void;
  toggleComplete: (id: string) => void;
  reorderTodo: (id: string, direction: "up" | "down") => void;
}

export const useTodoStore = create<TodoStore>()(
  persist(
    (set, get) => ({
      todos: [],

      addTodo: (data) => {
        const todo: Todo = {
          id: uid(),
          title: data.title,
          description: data.description,
          link: data.link,
          linkLabel: data.linkLabel,
          color: data.color ?? nextColor(get().todos),
          completed: false,
          viewAccess: data.viewAccess ?? "all",
          editAccess: data.editAccess ?? "all",
          createdBy: data.createdBy,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ todos: [...s.todos, todo] }));
        return todo;
      },

      updateTodo: (id, patch) => {
        set((s) => ({
          todos: s.todos.map((t) =>
            t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t
          ),
        }));
      },

      deleteTodo: (id) => {
        set((s) => ({ todos: s.todos.filter((t) => t.id !== id) }));
      },

      toggleComplete: (id) => {
        set((s) => ({
          todos: s.todos.map((t) =>
            t.id === id ? { ...t, completed: !t.completed, updatedAt: new Date().toISOString() } : t
          ),
        }));
      },

      reorderTodo: (id, direction) => {
        set((s) => {
          const arr = [...s.todos];
          const idx = arr.findIndex((t) => t.id === id);
          if (idx === -1) return s;
          const swapIdx = direction === "up" ? idx - 1 : idx + 1;
          if (swapIdx < 0 || swapIdx >= arr.length) return s;
          [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
          return { todos: arr };
        });
      },
    }),
    {
      name: "studio-todos-v1",
      skipHydration: true,
    }
  )
);

export const CARD_COLORS_LIST = CARD_COLORS;
