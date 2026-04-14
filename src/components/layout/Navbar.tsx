"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useUIStore } from "@/store/ui-store";
import { useKanbanStore } from "@/store/kanban-store";
import { SyncIndicator } from "@/components/vault/SyncIndicator";

const pageTitles: Record<string, string> = {
  "/dashboard":    "Dashboard",
  "/projects":     "Projects",
  "/calendar":     "Calendar",
  "/deliverables": "Deliverables",
  "/settings":     "Settings",
  "/admin":        "Admin",
};

function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const { searchCards, boards } = useKanbanStore();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const results = query.length >= 2 ? searchCards(query) : [];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function openCard(boardId: string) {
    router.push(`/projects/${boardId}`);
    onClose();
  }

  return (
    <div className="search-overlay" onClick={(e) => { if (e.currentTarget === e.target) onClose(); }}>
      <div className="search-panel">
        <div className="search-input-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--app-text-muted)", flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            className="search-input"
            placeholder="Search cards, scripts, tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="search-kbd" onClick={onClose}>esc</kbd>
        </div>

        {query.length >= 2 && (
          <div className="search-results">
            {results.length === 0 ? (
              <div className="search-empty">No results for "{query}"</div>
            ) : (
              results.map((card) => {
                const board = boards.find((b) => b.id === card.boardId);
                return (
                  <button
                    key={card.id}
                    className="search-result-item"
                    onClick={() => openCard(card.boardId)}
                  >
                    <span className="search-result-emoji">{board?.emoji ?? "📋"}</span>
                    <div className="search-result-info">
                      <span className="search-result-title">{card.title}</span>
                      <span className="search-result-meta">{board?.title}</span>
                    </div>
                    {card.deliverableType && (
                      <span className="search-result-type">{card.deliverableType}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}

        {query.length === 0 && (
          <div className="search-hint">
            <span>Start typing to search across all boards</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function Navbar() {
  const { toggleSidebar, sidebarCollapsed, darkMode, toggleDarkMode, searchOpen, setSearchOpen } = useUIStore();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Resolve dynamic board names
  const { boards } = useKanbanStore();
  let title = Object.entries(pageTitles).find(([key]) =>
    pathname === key || pathname.startsWith(key + "/")
  )?.[1] ?? "Studio";

  // Board detail page title — only after mount to avoid SSR mismatch
  if (mounted && pathname.startsWith("/projects/")) {
    const boardId = pathname.split("/projects/")[1];
    const board = boards.find((b) => b.id === boardId);
    if (board) title = `${board.emoji} ${board.title}`;
  }

  return (
    <>
      <header className="navbar">
        <div className="navbar-left">
          <button
            onClick={toggleSidebar}
            className="navbar-toggle"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {sidebarCollapsed ? (
                <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
              ) : (
                <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
              )}
            </svg>
          </button>
          <h1 className="navbar-title">{title}</h1>
        </div>

        <div className="navbar-right">
          <SyncIndicator />

          {/* Search trigger */}
          <button
            className="navbar-search-btn"
            onClick={() => setSearchOpen(true)}
            title="Search (⌘K)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="navbar-search-placeholder">Search…</span>
            <kbd>⌘K</kbd>
          </button>

          {/* Dark mode toggle */}
          <button
            className="navbar-icon-btn"
            onClick={toggleDarkMode}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle dark mode"
          >
            {darkMode ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {/* Avatar + dropdown */}
          <div className="navbar-avatar-wrap">
            <button
              className="navbar-avatar"
              onClick={() => setAvatarOpen((v) => !v)}
              aria-label="User menu"
            >
              {session?.user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.user.image} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <span>{session?.user?.name?.[0]?.toUpperCase() ?? "R"}</span>
              )}
            </button>
            {avatarOpen && (
              <>
                <div className="navbar-dropdown-backdrop" onClick={() => setAvatarOpen(false)} />
                <div className="navbar-dropdown">
                  <div className="navbar-dropdown-user">
                    <div className="navbar-dropdown-name">{session?.user?.name ?? "You"}</div>
                    <div className="navbar-dropdown-email">{session?.user?.email}</div>
                    {session?.user?.role === "admin" && (
                      <span className="admin-badge admin-badge-admin" style={{ marginTop: 4, display: "inline-flex" }}>Admin</span>
                    )}
                  </div>
                  <button
                    className="navbar-dropdown-item danger"
                    onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </>
  );
}
