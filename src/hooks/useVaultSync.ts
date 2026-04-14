"use client";
import { useEffect, useRef } from "react";
import { useVaultStore } from "@/store/vault-store";
import { useKanbanStore } from "@/store/kanban-store";

export function useVaultSync() {
  const { vaultPath, setVaultPath, setSyncStatus } = useVaultStore();
  const { loadFromVault } = useKanbanStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount: check server config
  useEffect(() => {
    fetch("/api/vault/config")
      .then((r) => r.json())
      .then((data) => {
        if (data.vaultPath) {
          setVaultPath(data.vaultPath);
          setSyncStatus("syncing");
          return loadFromVault().then(() => setSyncStatus("synced"));
        }
      })
      .catch(() => setSyncStatus("error"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SSE for external file changes — only reload when .md files actually change
  useEffect(() => {
    if (!vaultPath) return;
    const es = new EventSource("/api/vault/watch");
    es.onmessage = (e) => {
      const event = JSON.parse(e.data);
      // Ignore non-.md events (directory creations don't have .md extension)
      if (!event.filePath?.endsWith(".md")) return;
      if (event.type === "add" || event.type === "change" || event.type === "unlink") {
        setSyncStatus("syncing");
        // Debounce: wait 600ms after last event before reloading
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          loadFromVault()
            .then(() => setSyncStatus("synced"))
            .catch(() => setSyncStatus("error"));
        }, 600);
      }
    };
    es.onerror = () => es.close();
    return () => {
      es.close();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [vaultPath, setSyncStatus, loadFromVault]);
}
