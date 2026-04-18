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

// Detect Capacitor ONCE at module level — never changes, no re-renders
function detectNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(window as any).Capacitor;
}

function Shell({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore();
  // Only true inside the Capacitor Android app — never on web browser
  const [isNativeApp, setIsNativeApp] = useState(false);
  useVaultSync();

  useEffect(() => {
    useKanbanStore.persist.rehydrate();
    setIsNativeApp(detectNativeApp());
  }, []);

  // On web: keep original sidebar collapse behaviour on resize
  useEffect(() => {
    if (isNativeApp) return;
    function onResize() {
      if (window.innerWidth >= 768) setSidebarCollapsed(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isNativeApp, setSidebarCollapsed]);

  return (
    <div
      className="app-shell"
      data-sidebar-collapsed={isNativeApp ? true : sidebarCollapsed}
      data-native={isNativeApp}
    >
      {/* Web: show sidebar as normal. Native app: hide it entirely */}
      {!isNativeApp && <Sidebar />}

      <div className="app-main">
        <Navbar />
        <main className="app-content">{children}</main>
      </div>

      {/* Native app only: bottom nav bar */}
      {isNativeApp && <BottomNav />}

      {/* Always present — don't move these or sync breaks */}
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
