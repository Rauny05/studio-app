"use client";

import { useEffect, useState } from "react";
import { UIStoreProvider, useUIStore } from "@/store/ui-store";
import { useKanbanStore } from "@/store/kanban-store";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { BottomNav } from "./BottomNav";
import { QuickAdd } from "@/components/quick-add/QuickAdd";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { useVaultSync } from "@/hooks/useVaultSync";
import { CloudSync } from "@/components/sync/CloudSync";

function Shell({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore();
  const [isMobile, setIsMobile] = useState(false);
  useVaultSync();

  useEffect(() => {
    useKanbanStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div className="app-shell" data-sidebar-collapsed={isMobile ? true : sidebarCollapsed} data-mobile={isMobile}>
      {!isMobile && <Sidebar />}
      <div className="app-main">
        <Navbar />
        <main className="app-content">{children}</main>
      </div>
      {isMobile && <BottomNav />}
      <QuickAdd />
      <CommandPalette />
      <CloudSync />
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
