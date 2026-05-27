"use client";
import { ConnectVault } from "@/components/vault/ConnectVault";
import { usePush } from "@/hooks/use-push";
import { useState } from "react";

function PushNotificationsSection() {
  const { state, subscribe, unsubscribe } = usePush();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "ok" | "error">("idle");

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
        Enable notifications, then use the bell icon in the top bar to toggle anytime.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {state === "unsupported" && (
          <span style={{ fontSize: 13, color: "var(--app-text-muted)" }}>Not supported in this browser.</span>
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
