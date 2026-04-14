"use client";
import { useState } from "react";
import { useVaultStore } from "@/store/vault-store";
import { useKanbanStore } from "@/store/kanban-store";

export function ConnectVault() {
  const { vaultPath, setVaultPath, setSyncStatus, disconnect } = useVaultStore();
  const { loadFromVault } = useKanbanStore();
  const [inputPath, setInputPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function connect() {
    if (!inputPath.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/vault/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaultPath: inputPath.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to connect");
        return;
      }
      setVaultPath(data.vaultPath);
      setSyncStatus("syncing");
      await loadFromVault();
      setSyncStatus("synced");
      setInputPath("");
    } catch {
      setError("Connection failed");
      setSyncStatus("error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    await fetch("/api/vault/config", { method: "DELETE" });
    disconnect();
  }

  if (vaultPath) {
    return (
      <div style={{
        background: "var(--app-surface)",
        border: "1px solid var(--app-border)",
        borderRadius: 10,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "#16a34a22",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--app-text)", marginBottom: 2 }}>
            Vault connected
          </div>
          <div style={{
            fontSize: 12,
            color: "var(--app-text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {vaultPath}
          </div>
        </div>
        <button
          onClick={handleDisconnect}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid var(--app-border)",
            background: "transparent",
            color: "var(--app-text-muted)",
            fontSize: 12,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div style={{
      background: "var(--app-surface)",
      border: "1px solid var(--app-border)",
      borderRadius: 10,
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={inputPath}
          onChange={(e) => setInputPath(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") connect(); }}
          placeholder="/Users/username/Documents/ObsidianVault"
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 7,
            border: "1px solid var(--app-border)",
            background: "var(--app-bg)",
            color: "var(--app-text)",
            fontSize: 13,
            outline: "none",
          }}
        />
        <button
          onClick={connect}
          disabled={loading || !inputPath.trim()}
          style={{
            padding: "8px 16px",
            borderRadius: 7,
            border: "none",
            background: loading || !inputPath.trim() ? "var(--app-border)" : "#7c3aed",
            color: loading || !inputPath.trim() ? "var(--app-text-muted)" : "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: loading || !inputPath.trim() ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
            transition: "background 0.15s",
          }}
        >
          {loading ? "Connecting…" : "Connect"}
        </button>
      </div>
      {error && (
        <div style={{
          fontSize: 12,
          color: "#ef4444",
          padding: "8px 12px",
          background: "#ef444411",
          borderRadius: 6,
          border: "1px solid #ef444433",
        }}>
          {error}
        </div>
      )}
      <p style={{ fontSize: 12, color: "var(--app-text-muted)", margin: 0, lineHeight: 1.5 }}>
        Paste the full path to your Obsidian vault folder. Cards will sync as markdown files at{" "}
        <code style={{ fontSize: 11, background: "var(--app-bg)", padding: "1px 4px", borderRadius: 3 }}>
          ContentApp/Projects/
        </code>
      </p>
    </div>
  );
}
