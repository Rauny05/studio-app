"use client";
import { ConnectVault } from "@/components/vault/ConnectVault";
import { usePush } from "@/hooks/use-push";
import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import type { Reminder } from "@/app/api/reminders/route";
import type { DeliverableRow } from "@/app/api/deliverables/route";

// ─── Push Notifications ──────────────────────────────────────────────────────

function PushNotificationsSection() {
  const { state, subscribe, unsubscribe } = usePush();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "ok" | "error">("idle");
  const [ntfyTopic, setNtfyTopic] = useState<string | null>(null);

  useEffect(() => {
    if (state === "unsupported") {
      fetch("/api/push/ntfy-info")
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d?.topic) setNtfyTopic(d.topic); })
        .catch(() => {});
    }
  }, [state]);

  async function sendTest() {
    setTesting(true);
    setTestResult("idle");
    try {
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "📅 Samsung Reel goes live tomorrow",
          body: "60-second Instagram Reel · 29 May",
          url: "/deliverables",
        }),
      });
      setTestResult(res.ok ? "ok" : "error");
    } catch {
      setTestResult("error");
    } finally {
      setTesting(false);
      setTimeout(() => setTestResult("idle"), 3000);
    }
  }

  return (
    <section style={{ marginBottom: 32 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--app-text)", margin: "0 0 6px", letterSpacing: "-0.01em" }}>
        Push Notifications
      </h3>
      <p style={{ fontSize: 13, color: "var(--app-text-muted)", margin: "0 0 14px", lineHeight: 1.5 }}>
        Get reminded at <strong>8:00 AM</strong> when a campaign is going live today or tomorrow.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {state === "unsupported" && (
          <div style={{ width: "100%" }}>
            <p style={{ fontSize: 13, color: "#f59e0b", margin: "0 0 16px", lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: 6 }}>
              <span>⚠️</span>
              <span>Brave and Chrome on iOS don&apos;t support Web Push — Apple only allows it in Safari. Use one of the options below to still get reminders.</span>
            </p>
            <div style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)", borderRadius: 10, padding: "14px 16px", marginBottom: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--app-text)", margin: "0 0 4px" }}>
                Option 1 — ntfy app <span style={{ fontWeight: 400, color: "var(--app-text-muted)" }}>(easiest)</span>
              </p>
              <p style={{ fontSize: 12, color: "var(--app-text-muted)", margin: "0 0 10px", lineHeight: 1.6 }}>
                Install the free ntfy app, then subscribe to your private channel to receive go-live reminders on any browser or device.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a href="https://apps.apple.com/app/ntfy/id1625396347" target="_blank" rel="noopener noreferrer" className="kanban-btn-primary" style={{ fontSize: 12, textDecoration: "none" }}>
                  Get ntfy on App Store ↗
                </a>
                {ntfyTopic && (
                  <a href={`https://ntfy.sh/${ntfyTopic}`} target="_blank" rel="noopener noreferrer" className="kanban-btn-secondary" style={{ fontSize: 12, textDecoration: "none" }}>
                    Subscribe to channel ↗
                  </a>
                )}
              </div>
              {ntfyTopic && <p style={{ fontSize: 11, color: "var(--app-text-muted)", marginTop: 8, fontFamily: "monospace" }}>Channel: ntfy.sh/{ntfyTopic}</p>}
            </div>
            <div style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)", borderRadius: 10, padding: "14px 16px" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--app-text)", margin: "0 0 4px" }}>
                Option 2 — Safari PWA <span style={{ fontWeight: 400, color: "var(--app-text-muted)" }}>(native feel)</span>
              </p>
              <p style={{ fontSize: 12, color: "var(--app-text-muted)", margin: "0 0 10px", lineHeight: 1.6 }}>
                Open this app in Safari → tap the Share icon → <strong style={{ color: "var(--app-text)" }}>Add to Home Screen</strong>. Launch from your home screen and enable notifications from Settings above.
              </p>
              <a href={typeof window !== "undefined" ? window.location.origin : "#"} target="_blank" rel="noopener noreferrer" className="kanban-btn-secondary" style={{ fontSize: 12, textDecoration: "none" }}>
                Open in Safari ↗
              </a>
            </div>
          </div>
        )}
        {state === "denied" && (
          <span style={{ fontSize: 13, color: "#ef4444" }}>Notifications blocked — allow them in browser settings.</span>
        )}
        {(state === "unsubscribed" || state === "loading") && (
          <button className="kanban-btn-primary" onClick={subscribe} disabled={state === "loading"} style={{ fontSize: 13 }}>
            {state === "loading" ? "Loading…" : "Enable notifications"}
          </button>
        )}
        {state === "subscribed" && (
          <>
            <span style={{ fontSize: 13, color: "#22c55e", fontWeight: 600 }}>✓ Notifications enabled</span>
            <button className="kanban-btn-secondary" onClick={sendTest} disabled={testing} style={{ fontSize: 13 }}>
              {testing ? "Sending…" : testResult === "ok" ? "✓ Sent!" : testResult === "error" ? "Failed" : "Send test notification"}
            </button>
            <button className="kanban-btn-secondary" onClick={unsubscribe} style={{ fontSize: 13, color: "var(--app-text-muted)" }}>
              Disable
            </button>
          </>
        )}
      </div>

      {state === "subscribed" && (
        <p style={{ fontSize: 12, color: "var(--app-text-muted)", marginTop: 10, lineHeight: 1.5 }}>
          Reminders fire daily at 8:00 AM IST for campaigns with a go-live date set.
          Set dates by opening any deliverable card → <em>Go-live date</em> field.
        </p>
      )}
    </section>
  );
}

// ─── Reminders (admin only) ───────────────────────────────────────────────────

function RemindersSection() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [deliverables, setDeliverables] = useState<DeliverableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedId, setSelectedId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, dRes] = await Promise.all([
        fetch("/api/reminders"),
        fetch("/api/deliverables"),
      ]);
      const rData = await rRes.json();
      const dData = await dRes.json();
      setReminders(rData.reminders ?? []);
      setDeliverables(dData.deliverables ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addReminder() {
    if (!date || !time) return;
    setSaving(true);
    const dl = deliverables.find((d) => d.id === selectedId);
    const firstLabel = dl?.deliverables?.[0]?.label ?? "";
    try {
      await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliverableId: selectedId,
          deliverableLabel: firstLabel,
          brand: dl?.brand ?? "",
          date,
          time,
        }),
      });
      setDate("");
      setTime("09:00");
      setSelectedId("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function deleteReminder(id: string) {
    await fetch(`/api/reminders/${id}`, { method: "DELETE" });
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }

  const upcoming = reminders
    .filter((r) => !r.sent)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  const past = reminders.filter((r) => r.sent);

  function fmtDate(d: string) {
    try {
      return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    } catch { return d; }
  }

  function fmtTime(t: string) {
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hr = h % 12 || 12;
    return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  return (
    <section style={{ marginBottom: 32 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--app-text)", margin: "0 0 4px", letterSpacing: "-0.01em" }}>
        Reminders
      </h3>
      <p style={{ fontSize: 13, color: "var(--app-text-muted)", margin: "0 0 16px", lineHeight: 1.5 }}>
        Set custom reminders for any deliverable. Notifications fire within 15 minutes of the set time.
      </p>

      {/* Add reminder form */}
      <div style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--app-text-muted)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          New Reminder
        </p>

        {/* Deliverable picker */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: "var(--app-text-muted)", display: "block", marginBottom: 4 }}>Deliverable (optional)</label>
          <select
            className="settings-reminder-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">— General reminder —</option>
            {deliverables.map((d) => (
              <option key={d.id} value={d.id}>
                {d.brand} {d.pnNo ? `(${d.pnNo})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Date + Time row */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 130 }}>
            <label style={{ fontSize: 12, color: "var(--app-text-muted)", display: "block", marginBottom: 4 }}>Date</label>
            <input
              type="date"
              className="settings-reminder-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div style={{ flex: 1, minWidth: 110 }}>
            <label style={{ fontSize: 12, color: "var(--app-text-muted)", display: "block", marginBottom: 4 }}>Time (IST)</label>
            <input
              type="time"
              className="settings-reminder-input"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        <button
          className="kanban-btn-primary"
          onClick={addReminder}
          disabled={saving || !date || !time}
          style={{ fontSize: 13 }}
        >
          {saving ? "Saving…" : "+ Add Reminder"}
        </button>
      </div>

      {/* Upcoming reminders */}
      {loading ? (
        <p style={{ fontSize: 13, color: "var(--app-text-muted)" }}>Loading…</p>
      ) : upcoming.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--app-text-muted)" }}>No upcoming reminders.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {upcoming.map((r) => (
            <div key={r.id} className="settings-reminder-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--app-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.brand || r.deliverableLabel || "General reminder"}
                </p>
                {r.deliverableLabel && r.brand && (
                  <p style={{ fontSize: 12, color: "var(--app-text-muted)", margin: 0 }}>{r.deliverableLabel}</p>
                )}
              </div>
              <div style={{ flexShrink: 0, textAlign: "right" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--app-text)", margin: 0 }}>{fmtDate(r.date)}</p>
                <p style={{ fontSize: 12, color: "var(--app-text-muted)", margin: 0 }}>{fmtTime(r.time)} IST</p>
              </div>
              <button
                onClick={() => deleteReminder(r.id)}
                className="settings-reminder-del"
                aria-label="Delete reminder"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <p style={{ fontSize: 12, color: "var(--app-text-muted)", marginTop: 12 }}>
          {past.length} sent reminder{past.length > 1 ? "s" : ""} hidden.
        </p>
      )}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const isAdmin = status === "authenticated" && session?.user?.role === "admin";

  return (
    <div style={{ maxWidth: 640, padding: "0 0 40px" }}>
      <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.03em", margin: "0 0 24px", color: "var(--app-text)" }}>
        Settings
      </h2>

      <PushNotificationsSection />

      {isAdmin && <RemindersSection />}

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--app-text)", margin: "0 0 6px", letterSpacing: "-0.01em" }}>
          Obsidian Vault
        </h3>
        <p style={{ fontSize: 13, color: "var(--app-text-muted)", margin: "0 0 14px", lineHeight: 1.5 }}>
          Connect your local Obsidian vault to sync all cards as markdown files.
          Cards will be written to{" "}
          <code style={{ fontSize: 12, background: "var(--app-surface)", padding: "1px 5px", borderRadius: 4, border: "1px solid var(--app-border)" }}>
            ContentApp/Projects/
          </code>{" "}
          inside your vault, with full frontmatter for status, tags, priority, and more.
        </p>
        <ConnectVault />
      </section>
    </div>
  );
}
