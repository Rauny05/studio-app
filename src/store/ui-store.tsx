"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
}

const UIContext = createContext<UIState | null>(null);

export function UIStoreProvider({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // On mobile, start with sidebar collapsed so it doesn't overlay on first paint
  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarCollapsed(true);
    }
  }, []);

  // Persist dark mode
  useEffect(() => {
    const saved = localStorage.getItem("studio-dark-mode");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved !== null ? saved === "true" : prefersDark;
    setDarkMode(isDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((v) => {
      const next = !v;
      document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
      localStorage.setItem("studio-dark-mode", String(next));
      return next;
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Cmd/Ctrl+K → search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <UIContext.Provider
      value={{
        sidebarCollapsed,
        toggleSidebar: () => setSidebarCollapsed((v) => !v),
        setSidebarCollapsed,
        darkMode,
        toggleDarkMode,
        searchOpen,
        setSearchOpen,
      }}
    >
      {children}
    </UIContext.Provider>
  );
}

export function useUIStore() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUIStore must be used within UIStoreProvider");
  return ctx;
}
