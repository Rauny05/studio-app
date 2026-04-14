"use client";
import type { Priority, DeliverableType } from "@/types/kanban";
import { DELIVERABLE_CONFIG } from "./tag-colors";

export interface FilterState {
  priority: Priority | "all";
  deliverableType: DeliverableType | "all";
  overdueOnly: boolean;
  hasScript: boolean;
  searchQuery: string;
}

export const DEFAULT_FILTERS: FilterState = {
  priority: "all",
  deliverableType: "all",
  overdueOnly: false,
  hasScript: false,
  searchQuery: "",
};

interface Props {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  cardCount: number;
  filteredCount: number;
}

export function FilterBar({ filters, onChange, cardCount, filteredCount }: Props) {
  const isFiltered = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <div className="filter-bar">
      <div className="filter-search-wrap">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: "var(--app-text-muted)", flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          className="filter-search-input"
          placeholder="Filter cards…"
          value={filters.searchQuery}
          onChange={(e) => onChange({ ...filters, searchQuery: e.target.value })}
        />
      </div>

      <select
        className="filter-select"
        value={filters.priority}
        onChange={(e) => onChange({ ...filters, priority: e.target.value as Priority | "all" })}
      >
        <option value="all">All priorities</option>
        <option value="high">🔴 High</option>
        <option value="medium">🟡 Medium</option>
        <option value="low">🟢 Low</option>
      </select>

      <select
        className="filter-select"
        value={filters.deliverableType}
        onChange={(e) => onChange({ ...filters, deliverableType: e.target.value as DeliverableType | "all" })}
      >
        <option value="all">All types</option>
        {(Object.keys(DELIVERABLE_CONFIG) as DeliverableType[]).map((t) => (
          <option key={t} value={t}>{DELIVERABLE_CONFIG[t].icon} {t}</option>
        ))}
      </select>

      <button
        className={`filter-toggle-btn ${filters.overdueOnly ? "active" : ""}`}
        onClick={() => onChange({ ...filters, overdueOnly: !filters.overdueOnly })}
      >
        ⚠ Overdue
      </button>

      <button
        className={`filter-toggle-btn ${filters.hasScript ? "active" : ""}`}
        onClick={() => onChange({ ...filters, hasScript: !filters.hasScript })}
      >
        📝 Has script
      </button>

      {isFiltered && (
        <span style={{ fontSize: 11, color: "var(--app-text-muted)", marginLeft: "auto", flexShrink: 0 }}>
          {filteredCount}/{cardCount}
        </span>
      )}
      {isFiltered && (
        <button className="filter-clear-btn" onClick={() => onChange(DEFAULT_FILTERS)}>
          Clear
        </button>
      )}
    </div>
  );
}
