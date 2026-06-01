"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import type { Script, ScriptDoc } from "@/lib/scripts-store";

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
  const hue = Array.from(email).reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <span className="script-card-avatar" style={{ background: `hsl(${hue},50%,40%)` }} title={`${name || email} <${email}>`}>
      {initials}
    </span>
  );
}

function ScriptCard({
  script,
  isAdmin,
  onUpdateDoc,
  onDelete,
}: {
  script: Script;
  isAdmin: boolean;
  onUpdateDoc: (scriptId: string, docId: string, status: "approved" | "pending") => void;
  onDelete: (scriptId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const approvedCount = script.docs.filter((d) => d.status === "approved").length;
  const totalCount = script.docs.length;
  const allApproved = totalCount > 0 && approvedCount === totalCount;

  return (
    <div className={`script-card ${allApproved ? "script-card-approved" : ""}`}>
      {/* Card header */}
      <div className="script-card-header">
        <InitialAvatar name={script.sender_name} email={script.sender_email} />
        <div className="script-card-sender">
          <span className="script-card-sender-name">{script.sender_name || script.sender_email}</span>
          <span className="script-card-sender-email">{script.sender_email}</span>
        </div>
        <div className="script-card-meta-right">
          <span className="script-card-time">{formatDate(script.received_at)}</span>
          {isAdmin && (
            <button className="script-card-delete-btn" onClick={() => onDelete(script.id)} title="Delete">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Title + progress */}
      <div className="script-card-title-row" onClick={() => setExpanded((v) => !v)}>
        <div className="script-card-title-text">
          <span className="script-card-title">{script.title}</span>
          <span className={`script-card-badge ${allApproved ? "badge-approved" : "badge-pending"}`}>
            {allApproved ? "✓ All Approved" : `${approvedCount}/${totalCount} approved`}
          </span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, opacity: 0.4, transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="script-progress-bar">
          <div className="script-progress-fill" style={{ width: `${(approvedCount / totalCount) * 100}%` }} />
        </div>
      )}

      {/* Docs list — expanded by default */}
      {expanded && (
        <div className="script-docs-list">
          {totalCount === 0 ? (
            <div className="script-docs-empty">No Google Docs found in this email.</div>
          ) : (
            script.docs.map((doc) => (
              <ScriptDocRow key={doc.id} doc={doc} isAdmin={isAdmin} onToggle={(status) => onUpdateDoc(script.id, doc.id, status)} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ScriptDocRow({
  doc,
  isAdmin,
  onToggle,
}: {
  doc: ScriptDoc;
  isAdmin: boolean;
  onToggle: (status: "approved" | "pending") => void;
}) {
  const approved = doc.status === "approved";
  return (
    <div className={`script-doc-row ${approved ? "script-doc-approved" : ""}`}>
      <div className="script-doc-info">
        {isAdmin && (
          <button
            className={`script-doc-checkbox ${approved ? "checked" : ""}`}
            onClick={() => onToggle(approved ? "pending" : "approved")}
            title={approved ? "Mark as pending" : "Approve"}
          >
            {approved && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        )}
        <span className={`script-doc-name ${approved ? "script-doc-name-done" : ""}`}>{doc.name}</span>
      </div>
      <div className="script-doc-actions">
        {approved && doc.approved_by && (
          <span className="script-doc-approved-by">✓ {doc.approved_by.split("@")[0]}</span>
        )}
        <a
          href={doc.doc_url}
          target="_blank"
          rel="noopener noreferrer"
          className="script-card-doc-link"
          onClick={(e) => e.stopPropagation()}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Open
        </a>
      </div>
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
  const [pollError, setPollError] = useState<string | null>(null);

  const fetchScripts = useCallback(async () => {
    try {
      const res = await fetch("/api/scripts");
      if (!res.ok) return;
      const data = await res.json() as { scripts: Script[] };
      setScripts(data.scripts);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchScripts(); }, [fetchScripts]);
  useEffect(() => {
    const id = setInterval(() => void fetchScripts(), 30_000);
    return () => clearInterval(id);
  }, [fetchScripts]);

  async function handleManualPoll() {
    setPolling(true);
    setPollError(null);
    try {
      const res = await fetch("/api/gmail/poll-trigger", { method: "POST" });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) setPollError(data.error ?? `Error ${res.status}`);
      await new Promise((r) => setTimeout(r, 400));
      await fetchScripts();
    } catch (e) {
      setPollError(String(e));
    } finally {
      setPolling(false);
    }
  }

  async function handleUpdateDoc(scriptId: string, docId: string, status: "approved" | "pending") {
    const res = await fetch(`/api/scripts/${scriptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, docId }),
    });
    if (res.ok) {
      const data = await res.json() as { script: Script };
      setScripts((prev) => prev.map((s) => s.id === scriptId ? data.script : s));
    }
  }

  async function handleDelete(scriptId: string) {
    const res = await fetch(`/api/scripts/${scriptId}`, { method: "DELETE" });
    if (res.ok) setScripts((prev) => prev.filter((s) => s.id !== scriptId));
  }

  const filtered = scripts.filter((s) =>
    filter === "all" ? true : s.status === filter
  );

  const pendingCount = scripts.filter((s) => s.status === "pending").length;
  const approvedCount = scripts.filter((s) => s.status === "approved").length;

  return (
    <div className="scripts-board">
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
          <div className="scripts-filter-tabs">
            {(["all", "pending", "approved"] as const).map((f) => (
              <button key={f} className={`scripts-filter-tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button className={`scripts-refresh-btn ${polling ? "scripts-refreshing" : ""}`} onClick={handleManualPoll} disabled={polling} title="Check for new emails">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {polling ? "Checking…" : "Refresh"}
          </button>
        </div>
      </div>

      {pollError && (
        <div style={{ padding: "8px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, fontSize: 12, color: "#ef4444", marginBottom: 12 }}>
          Gmail error: {pollError}
        </div>
      )}

      <div className="scripts-list">
        {loading ? (
          <div className="scripts-empty"><div className="scripts-empty-spinner" /><span>Loading scripts…</span></div>
        ) : filtered.length === 0 ? (
          <div className="scripts-empty">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <span>{filter === "all" ? `No scripts yet. Send an email to raunaq@rmmedia.in with "Scripts to check" in the subject.` : `No ${filter} scripts.`}</span>
          </div>
        ) : (
          filtered.map((script) => (
            <ScriptCard key={script.id} script={script} isAdmin={isAdmin} onUpdateDoc={handleUpdateDoc} onDelete={handleDelete} />
          ))
        )}
      </div>
    </div>
  );
}
