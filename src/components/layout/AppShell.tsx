"use client";

import { useEffect } from "react";
import { UIStoreProvider, useUIStore } from "@/store/ui-store";
import { useKanbanStore } from "@/store/kanban-store";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { QuickAdd } from "@/components/quick-add/QuickAdd";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { useVaultSync } from "@/hooks/useVaultSync";

function Shell({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useUIStore();
  useVaultSync();

  // Rehydrate after mount so SSR and the initial client render both use
  // the seed defaults — prevents localStorage vs server mismatch.
  useEffect(() => {
    useKanbanStore.persist.rehydrate();
  }, []);

  return (
    <div className="app-shell" data-sidebar-collapsed={sidebarCollapsed}>
      <Sidebar />
      <div className="app-main">
        <Navbar />
        <main className="app-content">{children}</main>
      </div>
      <QuickAdd />
      <CommandPalette />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <UIStoreProvider>
      <Shell>{children}</Shell>
    </UIStoreProvider>
  );
}
