"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useKanbanStore } from "@/store/kanban-store";
import { DELIVERABLE_CONFIG, PRIORITY_CONFIG } from "@/components/kanban/tag-colors";
import type { Card } from "@/types/kanban";
import type { DeliverableRow } from "@/app/api/deliverables/route";

// ── Simple SVG bar chart ─────────────────────────────────────────────────────

function BarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = 100 / data.length - 4;

  return (
    <div className="chart-wrap">
      <svg viewBox="0 0 200 80" preserveAspectRatio="xMidYMid meet" className="bar-chart-svg">
        {data.map((d, i) => {
          const h = (d.value / max) * 60;
          const x = i * (200 / data.length) + 2;
          return (
            <g key={d.label}>
              <rect
                x={x}
                y={80 - h - 14}
                width={barW}
                height={Math.max(h, 2)}
                rx={3}
                fill={d.color}
                opacity={0.85}
              />
              <text x={x + barW / 2} y={78} textAnchor="middle" fontSize="7" fill="currentColor" opacity={0.5}>
                {d.label.slice(0, 6)}
              </text>
              {d.value > 0 && (
                <text x={x + barW / 2} y={80 - h - 17} textAnchor="middle" fontSize="7" fill="currentColor" fontWeight="600">
                  {d.value}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Donut chart ──────────────────────────────────────────────────────────────

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return (
    <div className="chart-wrap donut-empty">
      <svg viewBox="0 0 80 80" className="donut-svg">
        <circle cx="40" cy="40" r="28" fill="none" stroke="var(--app-border)" strokeWidth="12" />
      </svg>
    </div>
  );

  const r = 28;
  const cx = 40;
  const cy = 40;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="chart-wrap">
      <svg viewBox="0 0 80 80" className="donut-svg">
        {data.filter((d) => d.value > 0).map((d) => {
          const pct = d.value / total;
          const dash = pct * circ;
          const el = (
            <circle
              key={d.label}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={d.color}
              strokeWidth="12"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-(offset * circ)}
              style={{ transform: "rotate(-90deg)", transformOrigin: "40px 40px" }}
              opacity={0.85}
            />
          );
          offset += pct;
          return el;
        })}
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="700" fill="currentColor">
          {total}
        </text>
        <text x={cx} y={cy + 13} textAnchor="middle" fontSize="7" fill="currentColor" opacity={0.5}>
          total
        </text>
      </svg>
    </div>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div className="stat-card" style={{ "--stat-accent": accent ?? "var(--app-accent)" } as React.CSSProperties}>
      <div className="stat-card-icon" style={{ background: (accent ?? "#000") + "18" }}>
        {icon}
      </div>
      <div className="stat-card-body">
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{label}</div>
        {sub && <div className="stat-card-sub">{sub}</div>}
      </div>
    </div>
  );
}

// ── Recent card row ──────────────────────────────────────────────────────────

function RecentCardRow({ card }: { card: Card }) {
  const { boards, columns } = useKanbanStore();
  const board = boards.find((b) => b.id === card.boardId);
  const column = columns[card.columnId];
  const isOverdue = card.dueDate && new Date(card.dueDate) < new Date(new Date().toDateString());

  return (
    <div className="recent-card-row">
      <div className="recent-card-left">
        {board && (
          <span className="recent-card-board" style={{ background: board.color + "20", color: board.color }}>
            {board.emoji}
          </span>
        )}
        <div className="recent-card-info">
          <span className="recent-card-title">{card.title}</span>
          <span className="recent-card-meta">
            {column?.title}
            {card.deliverableType && ` · ${DELIVERABLE_CONFIG[card.deliverableType]?.icon} ${card.deliverableType}`}
          </span>
        </div>
      </div>
      <div className="recent-card-right">
        {card.dueDate && (
          <span className={`recent-card-due ${isOverdue ? "overdue" : ""}`}>
            {new Date(card.dueDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
        <span
          className="recent-card-priority"
          style={{ background: PRIORITY_CONFIG[card.priority ?? "medium"].bg, color: PRIORITY_CONFIG[card.priority ?? "medium"].color }}
        >
          {PRIORITY_CONFIG[card.priority ?? "medium"].label}
        </span>
      </div>
    </div>
  );
}

// ── Deliverables summary widget ──────────────────────────────────────────────

const DL_STATUS = [
  { key: "pending",          label: "Pending",         color: "#737373" },
  { key: "in-progress",      label: "In Progress",     color: "#f59e0b" },
  { key: "awaiting-payment", label: "Awaiting Payment", color: "#3b82f6" },
  { key: "done",             label: "Done",            color: "#22c55e" },
] as const;

function DeliverablesSummary() {
  const [rows, setRows] = useState<DeliverableRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/deliverables", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { setRows(d.deliverables ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const c = { pending: 0, "in-progress": 0, "awaiting-payment": 0, done: 0 };
    rows.forEach((r) => { c[r.overallStatus]++; });
    return c;
  }, [rows]);

  const total = rows.length;

  // Top 4 pending items
  const topPending = useMemo(() =>
    rows.filter((r) => r.overallStatus === "pending" || r.overallStatus === "in-progress").slice(0, 4),
  [rows]);

  return (
    <div className="dl-dash-widget">
      <div className="dl-dash-header">
        <div className="dl-dash-title-row">
          <span className="dl-live-dot" style={{ width: 7, height: 7 }} />
          <h3 className="dl-dash-title">Deliverables</h3>
          {!loading && <span className="dl-dash-total">{total} total</span>}
        </div>
        <Link href="/deliverables" className="dashboard-panel-link">View all →</Link>
      </div>

      {loading ? (
        <div className="dl-dash-loading">
          <div className="dl-spinner" style={{ width: 20, height: 20, borderWidth: 1.5 }} />
          <span>Syncing…</span>
        </div>
      ) : (
        <>
          {/* Status pills */}
          <div className="dl-dash-pills">
            {DL_STATUS.map(({ key, label, color }) => (
              <Link key={key} href={`/deliverables`} className="dl-dash-pill" style={{ "--pill-color": color } as React.CSSProperties}>
                <span className="dl-dash-pill-dot" style={{ background: color }} />
                <span className="dl-dash-pill-count" style={{ color }}>{counts[key]}</span>
                <span className="dl-dash-pill-label">{label}</span>
              </Link>
            ))}
          </div>

          {/* Stacked progress bar */}
          {total > 0 && (
            <div className="dl-dash-bar">
              {DL_STATUS.map(({ key, color }) => {
                const pct = (counts[key] / total) * 100;
                return pct > 0 ? (
                  <div
                    key={key}
                    className="dl-dash-bar-seg"
                    style={{ width: `${pct}%`, background: color }}
                    title={`${key}: ${counts[key]}`}
                  />
                ) : null;
              })}
            </div>
          )}

          {/* Top pending items */}
          {topPending.length > 0 && (
            <div className="dl-dash-pending">
              {topPending.map((row) => (
                <Link key={row.id} href="/deliverables" className="dl-dash-row">
                  <span className="dl-dash-row-pn">{row.pnNo.toUpperCase()}</span>
                  <span className="dl-dash-row-brand">{row.brand}</span>
                  <span
                    className="dl-dash-row-status"
                    style={{
                      color: DL_STATUS.find((s) => s.key === row.overallStatus)?.color,
                    }}
                  >
                    {row.overallStatus === "in-progress" ? "In Progress" : "Pending"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main dashboard ───────────────────────────────────────────────────────────

export function DashboardView() {
  const { boards, cards, columns } = useKanbanStore();

  const allCards = useMemo(() => Object.values(cards), [cards]);

  // Status distribution — per column title
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const card of allCards) {
      const col = columns[card.columnId];
      if (col) counts[col.title] = (counts[col.title] ?? 0) + 1;
    }
    const COLORS = ["#7c3aed", "#2563eb", "#f97316", "#e11d48", "#22c55e"];
    return Object.entries(counts).map(([label, value], i) => ({
      label, value, color: COLORS[i % COLORS.length],
    }));
  }, [allCards, columns]);

  // Deliverable type distribution
  const typeData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const card of allCards) {
      if (card.deliverableType) counts[card.deliverableType] = (counts[card.deliverableType] ?? 0) + 1;
    }
    return Object.entries(DELIVERABLE_CONFIG)
      .map(([type, conf]) => ({ label: type, value: counts[type] ?? 0, color: conf.color }))
      .filter((d) => d.value > 0);
  }, [allCards]);

  // Published / completion rate
  const publishedCount = useMemo(() => {
    return allCards.filter((c) => {
      const col = columns[c.columnId];
      return col?.title.toLowerCase() === "published";
    }).length;
  }, [allCards, columns]);

  const overdueCount = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return allCards.filter((c) => {
      if (!c.dueDate) return false;
      const col = columns[c.columnId];
      if (col?.title.toLowerCase() === "published") return false;
      return new Date(c.dueDate + "T00:00:00") < t;
    }).length;
  }, [allCards, columns]);

  const publishedThisWeek = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return allCards.filter((c) => {
      const col = columns[c.columnId];
      if (col?.title.toLowerCase() !== "published") return false;
      return new Date(c.updatedAt) >= weekAgo;
    }).length;
  }, [allCards, columns]);

  const completionRate = allCards.length > 0
    ? Math.round((publishedCount / allCards.length) * 100)
    : 0;

  // Upcoming deadlines (next 7 days)
  const today = new Date();
  const in7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcoming = useMemo(() => {
    return allCards
      .filter((c) => {
        if (!c.dueDate) return false;
        const d = new Date(c.dueDate + "T00:00:00");
        return d >= today && d <= in7;
      })
      .sort((a, b) => (a.dueDate ?? "") < (b.dueDate ?? "") ? -1 : 1)
      .slice(0, 5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCards]);

  // Recently updated
  const recentCards = useMemo(() => {
    return [...allCards]
      .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1))
      .slice(0, 6);
  }, [allCards]);

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h2 className="dashboard-heading">Dashboard</h2>
        <p className="dashboard-subheading">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Stats row */}
      <div className="stats-grid">
        <StatCard
          accent="#7c3aed"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          }
          label="Total projects"
          value={boards.length}
          sub={boards.length > 0 ? `${boards.map(b => b.title).slice(0, 2).join(", ")}…` : "No projects yet"}
        />
        <StatCard
          accent="#2563eb"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <line x1="9" y1="9" x2="15" y2="9" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="15" x2="12" y2="15" />
            </svg>
          }
          label="Total cards"
          value={allCards.length}
          sub={`${publishedCount} published`}
        />
        <StatCard
          accent="#22c55e"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          }
          label="Completion rate"
          value={`${completionRate}%`}
          sub={`${publishedCount} of ${allCards.length} cards`}
        />
        <StatCard
          accent={overdueCount > 0 ? "#ef4444" : "#f97316"}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={overdueCount > 0 ? "#ef4444" : "#f97316"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
          label={overdueCount > 0 ? "Overdue" : "Due this week"}
          value={overdueCount > 0 ? overdueCount : upcoming.length}
          sub={overdueCount > 0
            ? `${upcoming.length} due this week`
            : upcoming.length > 0
              ? `Next: ${new Date(upcoming[0].dueDate! + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
              : "Nothing due soon"}
        />
      </div>

      {/* Charts row */}
      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-card-header">
            <h3 className="chart-card-title">Cards by status</h3>
          </div>
          {statusData.length > 0 ? (
            <>
              <BarChart data={statusData} />
              <div className="chart-legend">
                {statusData.map((d) => (
                  <span key={d.label} className="chart-legend-item">
                    <span className="chart-legend-dot" style={{ background: d.color }} />
                    {d.label}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="chart-empty">No cards yet</div>
          )}
        </div>

        <div className="chart-card">
          <div className="chart-card-header">
            <h3 className="chart-card-title">Deliverable types</h3>
          </div>
          {typeData.length > 0 ? (
            <>
              <DonutChart data={typeData} />
              <div className="chart-legend">
                {typeData.map((d) => (
                  <span key={d.label} className="chart-legend-item">
                    <span className="chart-legend-dot" style={{ background: d.color }} />
                    {DELIVERABLE_CONFIG[d.label]?.icon} {d.label} ({d.value})
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="chart-empty">No typed cards yet</div>
          )}
        </div>
      </div>

      {/* Deliverables summary */}
      <DeliverablesSummary />

      {/* Bottom row */}
      <div className="dashboard-bottom">
        {/* Upcoming deadlines */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3 className="dashboard-panel-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              Upcoming deadlines
            </h3>
          </div>
          {upcoming.length === 0 ? (
            <div className="dashboard-panel-empty">
              <span>🎉</span> Nothing due in the next 7 days
            </div>
          ) : (
            <div className="recent-cards-list">
              {upcoming.map((card) => <RecentCardRow key={card.id} card={card} />)}
            </div>
          )}
        </div>

        {/* Recently updated */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3 className="dashboard-panel-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Recently updated
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
              {publishedThisWeek > 0 && (
                <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 500 }}>
                  +{publishedThisWeek} published
                </span>
              )}
              {boards.length > 0 && (
                <Link href="/projects" className="dashboard-panel-link">See all</Link>
              )}
            </div>
          </div>
          {recentCards.length === 0 ? (
            <div className="dashboard-panel-empty">
              <span>📝</span> No cards yet. <Link href="/projects" className="dashboard-panel-link">Create a project</Link>
            </div>
          ) : (
            <div className="recent-cards-list">
              {recentCards.map((card) => <RecentCardRow key={card.id} card={card} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
