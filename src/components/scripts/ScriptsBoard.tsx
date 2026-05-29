"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import type { Script } from "@/lib/scripts-store";

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function InitialAvatar({ name, email }: { name: string; email: string }) {
  const initials = name
    ? name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : email[0].toUpperCase();
  // Deterministic color from email
  const hue = Array.from(email).reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <span
      className="script-card-avatar"
      style={{ background: `hsl(${hue},50%,40%)` }}
      title={`${name || email} <${email}>`}
    >
      {initials}
    </span>
  );
}

function ScriptCard({
  script,
  isAdmin,
  onApprove,
  onUnapprove,
}: {
  script: Script;
  isAdmin: boolean;
  onApprove: (id: string) => void;
  onUnapprove: (id: string) => void;
}) {
  const approved = script.status === "approved";

  return (
    <div className={`script-card ${approved ? "script-card-approved" : ""}`}>
      <div className="script-card-header">
        <InitialAvatar name={script.sender_name} email={script.sender_email} />
        <div className="script-card-sender">
          <span className="script-card-sender-name">{script.sender_name || script.sender_email}</span>
          <span className="script-card-sender-email">{script.sender_email}</span>
        </div>
        <div className="script-card-meta-right">
          <span className={`script-card-badge ${approved ? "badge-approved" : "badge-pending"}`}>
            {approved ? "Approved" : "Pending"}
          </span>
          <span className="script-card-time">{formatDate(script.received_at)}</span>
        </div>
      </div>

      <div className="script-card-title">{script.title}</div>

      <div className="script-card-footer">
        {script.doc_url ? (
          <a
            href={script.doc_url}
            target="_blank"
            rel="noopener noreferrer"
            className="script-card-doc-link"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Open Doc
          </a>
        ) : (
          <span className="script-card-no-doc">No Doc attached</span>
        )}

        {isAdmin && (
          <div className="script-card-actions">
            {!approved ? (
              <button
                className="script-card-approve-btn"
                onClick={() => onApprove(script.id)}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Approve
              </button>
            ) : (
              <button
                className="script-card-unapprove-btn"
                onClick={() => onUnapprove(script.id)}
              >
                Unapprove
              </button>
            )}
          </div>
        )}
      </div>

      {approved && script.approved_by && (
        <div className="script-card-approved-by">
          ✓ Approved by {script.approved_by} · {formatDate(script.approved_at!)}
        </div>
      )}
    </div>
  );
}

export function ScriptsBoard() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all");
  const [polling, setPolling] = useState(false);

  const fetchScripts = useCallback(async () => {
    try {
      const res = await fetch("/api/scripts");
      if (!res.ok) return;
      const data = await res.json() as { scripts: Script[] };
      setScripts(data.scripts);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void fetchScripts();
  }, [fetchScripts]);

  // 30-second polling for real-time updates
  useEffect(() => {
    const id = setInterval(() => {
      void fetchScripts();
    }, 30_000);
    return () => clearInterval(id);
  }, [fetchScripts]);

  async function handleApprove(id: string) {
    const res = await fetch(`/api/scripts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    if (res.ok) {
      const data = await res.json() as { script: Script };
      setScripts((prev) => prev.map((s) => s.id === id ? data.script : s));
    }
  }

  async function handleUnapprove(id: string) {
    const res = await fetch(`/api/scripts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pending" }),
    });
    if (res.ok) {
      const data = await res.json() as { script: Script };
      setScripts((prev) => prev.map((s) => s.id === id ? data.script : s));
    }
  }

  async function handleManualPoll() {
    setPolling(true);
    try {
      // Trigger a server-side poll via a dedicated client-facing refresh endpoint
      await fetch("/api/gmail/poll-trigger", { method: "POST" });
      // Small delay then refetch
      await new Promise((r) => setTimeout(r, 800));
      await fetchScripts();
    } finally {
      setPolling(false);
    }
  }

  const filtered = scripts.filter((s) =>
    filter === "all" ? true : s.status === filter
  );

  const pendingCount = scripts.filter((s) => s.status === "pending").length;
  const approvedCount = scripts.filter((s) => s.status === "approved").length;

  return (
    <div className="scripts-board">
      {/* Header */}
      <div className="scripts-board-header">
        <div className="scripts-board-stats">
          <span className="scripts-stat">
            <span className="scripts-stat-num">{scripts.length}</span>
            <span className="scripts-stat-label">Total</span>
          </span>
          <span className="scripts-stat-divider" />
          <span className="scripts-stat">
            <span className="scripts-stat-num scripts-stat-pending">{pendingCount}</span>
            <span className="scripts-stat-label">Pending</span>
          </span>
          <span className="scripts-stat-divider" />
          <span className="scripts-stat">
            <span className="scripts-stat-num scripts-stat-approved">{approvedCount}</span>
            <span className="scripts-stat-label">Approved</span>
          </span>
        </div>

        <div className="scripts-board-controls">
          {/* Filter tabs */}
          <div className="scripts-filter-tabs">
            {(["all", "pending", "approved"] as const).map((f) => (
              <button
                key={f}
                className={`scripts-filter-tab ${filter === f ? "active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Manual refresh */}
          <button
            className={`scripts-refresh-btn ${polling ? "scripts-refreshing" : ""}`}
            onClick={handleManualPoll}
            disabled={polling}
            title="Check for new emails"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {polling ? "Checking…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="scripts-list">
        {loading ? (
          <div className="scripts-empty">
            <div className="scripts-empty-spinner" />
            <span>Loading scripts…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="scripts-empty">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <span>
              {filter === "all"
                ? `No scripts yet. Send an email to raunaq@rmmedia.in with "Scripts to check" in the subject.`
                : `No ${filter} scripts.`}
            </span>
          </div>
        ) : (
          filtered.map((script) => (
            <ScriptCard
              key={script.id}
              script={script}
              isAdmin={isAdmin}
              onApprove={handleApprove}
              onUnapprove={handleUnapprove}
            />
          ))
        )}
      </div>
    </div>
  );
}
