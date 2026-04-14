"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useKanbanStore } from "@/store/kanban-store";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

type ResultItem =
  | { type: "card"; id: string; title: string; columnTitle: string }
  | { type: "nav"; label: string; href: string; icon: string };

const NAV_ITEMS: ResultItem[] = [
  { type: "nav", label: "Dashboard", href: "/dashboard", icon: "⊞" },
  { type: "nav", label: "Projects", href: "/projects", icon: "≡" },
  { type: "nav", label: "Settings", href: "/settings", icon: "⚙" },
];

function score(text: string, query: string): number {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t === q) return 3;
  if (t.startsWith(q)) return 2;
  if (t.includes(q)) return 1;
  // character subsequence match
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length ? 0.5 : 0;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { columns, cards, openCard } = useKanbanStore();

  const toggle = useCallback(() => setOpen((v) => !v), []);
  useKeyboardShortcut("k", toggle, { meta: true, blockInInput: false });

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  // Build results
  const colMap = Object.fromEntries(Object.values(columns).map((c) => [c.id, c.title]));

  const cardResults: ResultItem[] = Object.values(cards)
    .map((card) => ({
      item: {
        type: "card" as const,
        id: card.id,
        title: card.title,
        columnTitle: colMap[card.columnId] ?? "",
      },
      s: score(card.title + " " + card.description, query),
    }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 8)
    .map((r) => r.item);

  const navResults = NAV_ITEMS.filter(
    (n) => !query || (n.type === "nav" && n.label.toLowerCase().includes(query.toLowerCase()))
  );

  const results: ResultItem[] =
    query
      ? [...cardResults, ...navResults]
      : [...NAV_ITEMS, ...Object.values(cards).slice(0, 5).map((card) => ({
          type: "card" as const,
          id: card.id,
          title: card.title,
          columnTitle: colMap[card.columnId] ?? "",
        }))];

  const clamped = Math.min(activeIndex, results.length - 1);

  function select(item: ResultItem) {
    if (item.type === "card") {
      openCard(item.id);
    } else {
      router.push(item.href);
    }
    close();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[clamped]) select(results[clamped]);
    } else if (e.key === "Escape") {
      close();
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[clamped] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [clamped]);

  if (!open) return null;

  return (
    <div className="palette-overlay" onClick={close}>
      <div
        className="palette-panel"
        role="dialog"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="palette-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "var(--app-text-muted)" }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            className="palette-input"
            placeholder="Search cards or jump to…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={onKeyDown}
          />
          <kbd className="palette-kbd">Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="palette-results">
          {results.length === 0 && (
            <div className="palette-empty">No results for &ldquo;{query}&rdquo;</div>
          )}
          {results.map((item, i) => (
            <button
              key={item.type === "card" ? item.id : item.href}
              className={`palette-item ${i === clamped ? "active" : ""}`}
              onClick={() => select(item)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span className="palette-item-icon">
                {item.type === "nav" ? (
                  <span style={{ fontSize: 14 }}>{item.icon}</span>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="21" x2="9" y2="9" />
                  </svg>
                )}
              </span>
              <span className="palette-item-label">{item.type === "card" ? item.title : item.label}</span>
              {item.type === "card" && (
                <span className="palette-item-meta">{item.columnTitle}</span>
              )}
              {item.type === "nav" && (
                <span className="palette-item-meta">Go to</span>
              )}
              {i === clamped && (
                <kbd className="palette-enter-kbd">↵</kbd>
              )}
            </button>
          ))}
        </div>

        <div className="palette-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
