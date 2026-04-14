"use client";
import { ConnectVault } from "@/components/vault/ConnectVault";

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
