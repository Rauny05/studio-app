"use client";
import { ConnectVault } from "@/components/vault/ConnectVault";
import { usePush } from "@/hooks/use-push";
import { useState, useEffect } from "react";

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

            {/* Option 1: ntfy app */}
            <div style={{
              background: "var(--app-surface)",
              border: "1px solid var(--app-border)",
              borderRadius: 10,
              padding: "14px 16px",
              marginBottom: 10,
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--app-text)", margin: "0 0 4px" }}>
                Option 1 — ntfy app <span style={{ fontWeight: 400, color: "var(--app-text-muted)" }}>(easiest)</span>
              </p>
              <p style={{ fontSize: 12, color: "var(--app-text-muted)", margin: "0 0 10px", lineHeight: 1.6 }}>
                Install the free ntfy app, then subscribe to your private channel to receive go-live reminders on any browser or device.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a
                  href="https://apps.apple.com/app/ntfy/id1625396347"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="kanban-btn-primary"
                  style={{ fontSize: 12, textDecoration: "none" }}
                >
                  Get ntfy on App Store ↗
                </a>
                {ntfyTopic && (
                  <a
                    href={`https://ntfy.sh/${ntfyTopic}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="kanban-btn-secondary"
                    style={{ fontSize: 12, textDecoration: "none" }}
                  >
                    Subscribe to channel ↗
                  </a>
                )}
              </div>
              {ntfyTopic && (
                <p style={{ fontSize: 11, color: "var(--app-text-muted)", marginTop: 8, fontFamily: "monospace" }}>
                  Channel: ntfy.sh/{ntfyTopic}
                </p>
              )}
            </div>

            {/* Option 2: Safari PWA */}
            <div style={{
              background: "var(--app-surface)",
              border: "1px solid var(--app-border)",
              borderRadius: 10,
              padding: "14px 16px",
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--app-text)", margin: "0 0 4px" }}>
                Option 2 — Safari PWA <span style={{ fontWeight: 400, color: "var(--app-text-muted)" }}>(native feel)</span>
              </p>
              <p style={{ fontSize: 12, color: "var(--app-text-muted)", margin: "0 0 10px", lineHeight: 1.6 }}>
                Open this app in Safari → tap the Share icon → <strong style={{ color: "var(--app-text)" }}>Add to Home Screen</strong>. Launch from your home screen and enable notifications from Settings above.
              </p>
              <a
                href={typeof window !== "undefined" ? window.location.origin : "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="kanban-btn-secondary"
                style={{ fontSize: 12, textDecoration: "none" }}
              >
                Open in Safari ↗
              </a>
            </div>
          </div>
        )}
        {state === "denied" && (
          <span style={{ fontSize: 13, color: "#ef4444" }}>Notifications blocked — allow them in browser settings.</span>
        )}
        {(state === "unsubscribed" || state === "loading") && (
          <button
            className="kanban-btn-primary"
            onClick={subscribe}
            disabled={state === "loading"}
            style={{ fontSize: 13 }}
          >
            {state === "loading" ? "Loading…" : "Enable notifications"}
          </button>
        )}
        {state === "subscribed" && (
          <>
            <span style={{ fontSize: 13, color: "#22c55e", fontWeight: 600 }}>✓ Notifications enabled</span>
            <button
              className="kanban-btn-secondary"
              onClick={sendTest}
              disabled={testing}
              style={{ fontSize: 13 }}
            >
              {testing ? "Sending…" : testResult === "ok" ? "✓ Sent!" : testResult === "error" ? "Failed" : "Send test notification"}
            </button>
            <button
              className="kanban-btn-secondary"
              onClick={unsubscribe}
              style={{ fontSize: 13, color: "var(--app-text-muted)" }}
            >
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

export default function SettingsPage() {
  return (
    <div style={{ maxWidth: 640, padding: "0 0 40px" }}>
      <h2
        style={{
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "-0.03em",
          margin: "0 0 24px",
          color: "var(--app-text)",
        }}
      >
        Settings
      </h2>

      <PushNotificationsSection />

      <section style={{ marginBottom: 32 }}>
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--app-text)",
            margin: "0 0 6px",
            letterSpacing: "-0.01em",
          }}
        >
          Obsidian Vault
        </h3>
        <p
          style={{
            fontSize: 13,
            color: "var(--app-text-muted)",
            margin: "0 0 14px",
            lineHeight: 1.5,
          }}
        >
          Connect your local Obsidian vault to sync all cards as markdown files.
          Cards will be written to{" "}
          <code
            style={{
              fontSize: 12,
              background: "var(--app-surface)",
              padding: "1px 5px",
              borderRadius: 4,
              border: "1px solid var(--app-border)",
            }}
          >
            ContentApp/Projects/
          </code>{" "}
          inside your vault, with full frontmatter for status, tags, priority, and more.
        </p>
        <ConnectVault />
      </section>
    </div>
  );
}
