"use client";
import { useVaultStore } from "@/store/vault-store";

const STATUS_CONFIG = {
  synced: { label: "Synced", color: "#16a34a" },
  syncing: { label: "Syncing…", color: "#d97706" },
  error: { label: "Sync error", color: "#ef4444" },
  connecting: { label: "Connecting…", color: "#d97706" },
  disconnected: { label: "", color: "transparent" },
};

export function SyncIndicator() {
  const { syncStatus, vaultPath } = useVaultStore();
  if (!vaultPath) return null;

  const config = STATUS_CONFIG[syncStatus];
  if (!config.label) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 9px",
        borderRadius: 20,
        background: config.color + "18",
        border: `1px solid ${config.color}33`,
        fontSize: 11,
        fontWeight: 500,
        color: config.color,
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
      }}
      title={`Obsidian vault: ${vaultPath}`}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: config.color,
          flexShrink: 0,
          animation: syncStatus === "syncing" || syncStatus === "connecting"
            ? "pulse 1.2s ease-in-out infinite"
            : "none",
        }}
      />
      {config.label}
    </div>
  );
}
