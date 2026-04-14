"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useUIStore } from "@/store/ui-store";
import { useKanbanStore } from "@/store/kanban-store";

const nav = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: "Projects",
    href: "/projects",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    ),
  },
  {
    label: "Calendar",
    href: "/calendar",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    label: "Deliverables",
    href: "/deliverables",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/settings",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore();
  const { boards } = useKanbanStore();
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const isAdmin = session?.user?.role === "admin";
  const permissions = session?.user?.permissions ?? [];

  useEffect(() => { setMounted(true); }, []);

  // Auto-close sidebar on navigation (mobile)
  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarCollapsed(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const recentBoards = boards.slice(0, 6);

  return (
    <aside
      className="sidebar"
      data-collapsed={sidebarCollapsed}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
          </svg>
        </div>
        {!sidebarCollapsed && <span className="sidebar-logo-text">Studio</span>}
      </div>

      {/* Primary nav */}
      <nav className="sidebar-nav">
        {nav.filter((item) => {
          // Show all items if no session yet (avoids flicker), otherwise check permissions
          if (!mounted || permissions.length === 0) return true;
          const key = item.href.replace("/", "");
          return permissions.includes(key);
        }).map((item) => {
          const active = pathname === item.href || (item.href === "/projects" && pathname.startsWith("/projects/")) || (item.href === "/calendar" && pathname.startsWith("/calendar")) || (item.href === "/deliverables" && pathname.startsWith("/deliverables"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-nav-item ${active ? "active" : ""}`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              {!sidebarCollapsed && <span className="sidebar-nav-label">{item.label}</span>}
            </Link>
          );
        })}
        {/* Admin link — only visible to admin */}
        {mounted && isAdmin && (
          <Link
            href="/admin"
            className={`sidebar-nav-item ${pathname.startsWith("/admin") ? "active" : ""}`}
            title={sidebarCollapsed ? "Admin" : undefined}
          >
            <span className="sidebar-nav-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            {!sidebarCollapsed && <span className="sidebar-nav-label">Team Access</span>}
          </Link>
        )}
      </nav>

      {/* Recent projects */}
      {mounted && !sidebarCollapsed && recentBoards.length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-section-header">Recent projects</div>
          {recentBoards.map((board) => {
            const active = pathname === `/projects/${board.id}`;
            return (
              <Link
                key={board.id}
                href={`/projects/${board.id}`}
                className={`sidebar-nav-item sidebar-board-item ${active ? "active" : ""}`}
              >
                <span
                  className="sidebar-board-dot"
                  style={{ background: board.color }}
                />
                <span className="sidebar-nav-label" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {board.emoji} {board.title}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Collapsed board dots */}
      {mounted && sidebarCollapsed && recentBoards.length > 0 && (
        <div className="sidebar-collapsed-boards">
          {recentBoards.map((board) => (
            <Link
              key={board.id}
              href={`/projects/${board.id}`}
              className="sidebar-collapsed-board"
              title={board.title}
              style={{ background: board.color + "22", color: board.color }}
            >
              {board.emoji}
            </Link>
          ))}
        </div>
      )}
    </aside>
  );
}
