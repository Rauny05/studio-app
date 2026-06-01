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
    <span className="script-card-avatar" style={{ background: `hsl(${hue},50%,40%)` }} title={`${name} <${email}>`}>
      {initials}
    </span>
  );
}

function saveToObsidian(script: Script, doc: ScriptDoc) {
  const approvedDate = doc.approved_at
    ? new Date(doc.approved_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const content = [
    "---",
    `status: approved`,
    `sender: "${script.sender_name} <${script.sender_email}>"`,
    `campaign: "${script.title}"`,
    `approved: ${approvedDate}`,
    `approved_by: "${doc.approved_by ?? ""}"`,
    `doc_url: "${doc.doc_url}"`,
    "tags: [scripts, approved]",
    "---",
    "",
    `# ${doc.name}`,
    "",
    `**Campaign:** ${script.title}`,
    `**From:** ${script.sender_name} (${script.sender_email})`,
    `**Approved:** ${approvedDate}${doc.approved_by ? ` by ${doc.approved_by}` : ""}`,
    "",
    "## Document",
    "",
    `[Open in Google Docs](${doc.doc_url})`,
    "",
    "## Notes",
    "",
  ].join("\n");

  const noteName = `Scripts/${doc.name.replace(/[/\\:*?"<>|]/g, "-")}`;
  const uri = `obsidian://new?name=${encodeURIComponent(noteName)}&content=${encodeURIComponent(content)}&silent`;
  window.open(uri, "_blank");
}

/** A single script doc shown as its own full card */
function ScriptDocCard({
  script,
  doc,
  isAdmin,
  onToggle,
  onDeleteScript,
  showDeleteOnFirst,
}: {
  script: Script;
  doc: ScriptDoc;
  isAdmin: boolean;
  onToggle: (status: "approved" | "pending") => void;
  onDeleteScript: () => void;
  showDeleteOnFirst: boolean;
}) {
  const approved = doc.status === "approved";

  return (
    <div className={`script-doc-card ${approved ? "script-doc-card-approved" : ""}`}>
      {/* Top row: sender + meta */}
      <div className="script-doc-card-top">
        <div className="script-doc-card-sender">
          <InitialAvatar name={script.sender_name} email={script.sender_email} />
          <div>
            <div className="script-doc-card-sender-name">{script.sender_name || script.sender_email}</div>
            <div className="script-doc-card-campaign">{script.title}</div>
          </div>
        </div>
        <div className="script-doc-card-meta">
          <span className={`script-card-badge ${approved ? "badge-approved" : "badge-pending"}`}>
            {approved ? "Approved" : "Pending"}
          </span>
          <span className="script-card-time">{formatDate(script.received_at)}</span>
          {isAdmin && showDeleteOnFirst && (
            <button className="script-card-delete-btn" onClick={onDeleteScript} title="Delete entire submission">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6M9 6V4h6v2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Script name */}
      <div className="script-doc-card-name">{doc.name}</div>

      {/* Footer: open + approve */}
      <div className="script-doc-card-footer">
        <a
          href={doc.doc_url}
          target="_blank"
          rel="noopener noreferrer"
          className="script-doc-card-open-btn"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Open Doc
        </a>

        {approved && doc.approved_by && (
          <span className="script-doc-card-approved-by">
            ✓ Approved by {doc.approved_by.split("@")[0]}
          </span>
        )}

        <div className="script-doc-card-actions-right">
          {approved && (
            <button
              className="script-obsidian-btn"
              onClick={() => saveToObsidian(script, doc)}
              title="Save to Obsidian"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C8.5 2 6 4.5 6 8c0 1.5.5 2.9 1.4 4L4 19l2 1 2-3h8l2 3 2-1-3.4-7C17.5 10.9 18 9.5 18 8c0-3.5-2.5-6-6-6zm0 2c2.4 0 4 1.6 4 4s-1.6 4-4 4-4-1.6-4-4 1.6-4 4-4z"/>
              </svg>
              Save to Obsidian
            </button>
          )}

          {isAdmin && (
            approved ? (
              <button className="script-doc-card-unapprove-btn" onClick={() => onToggle("pending")}>
                Unapprove
              </button>
            ) : (
              <button className="script-doc-card-approve-btn" onClick={() => onToggle("approved")}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Approve
              </button>
            )
          )}
        </div>
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

  // Flatten scripts → individual doc cards for display
  const allDocCards = scripts.flatMap((script) =>
    script.docs.map((doc, i) => ({ script, doc, isFirst: i === 0 }))
  );

  const filtered = allDocCards.filter(({ doc }) =>
    filter === "all" ? true : doc.status === filter
  );

  const totalDocs = allDocCards.length;
  const pendingDocs = allDocCards.filter(({ doc }) => doc.status === "pending").length;
  const approvedDocs = allDocCards.filter(({ doc }) => doc.status === "approved").length;

  return (
    <div className="scripts-board">
      <div className="scripts-board-header">
        <div className="scripts-board-stats">
          <span className="scripts-stat">
            <span className="scripts-stat-num">{totalDocs}</span>
            <span className="scripts-stat-label">Scripts</span>
          </span>
          <span className="scripts-stat-divider" />
          <span className="scripts-stat">
            <span className="scripts-stat-num scripts-stat-pending">{pendingDocs}</span>
            <span className="scripts-stat-label">Pending</span>
          </span>
          <span className="scripts-stat-divider" />
          <span className="scripts-stat">
            <span className="scripts-stat-num scripts-stat-approved">{approvedDocs}</span>
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
          <button
            className={`scripts-refresh-btn ${polling ? "scripts-refreshing" : ""}`}
            onClick={handleManualPoll}
            disabled={polling}
            title="Check for new emails"
          >
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
            <span>
              {filter === "all"
                ? `No scripts yet. Send an email to raunaq@rmmedia.in with "Scripts to check" in the subject.`
                : `No ${filter} scripts.`}
            </span>
          </div>
        ) : (
          filtered.map(({ script, doc, isFirst }) => (
            <ScriptDocCard
              key={doc.id}
              script={script}
              doc={doc}
              isAdmin={isAdmin}
              onToggle={(status) => handleUpdateDoc(script.id, doc.id, status)}
              onDeleteScript={() => handleDelete(script.id)}
              showDeleteOnFirst={isFirst}
            />
          ))
        )}
      </div>
    </div>
  );
}
