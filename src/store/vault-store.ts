"use client";
import { create } from "zustand";

export type VaultSyncStatus =
  | "disconnected"
  | "connecting"
  | "synced"
  | "syncing"
  | "error";

interface VaultStore {
  vaultPath: string | null;
  syncStatus: VaultSyncStatus;
  setVaultPath: (path: string | null) => void;
  setSyncStatus: (status: VaultSyncStatus) => void;
  disconnect: () => void;
}

export const useVaultStore = create<VaultStore>((set) => ({
  vaultPath: null,
  syncStatus: "disconnected",
  setVaultPath: (vaultPath) =>
    set({ vaultPath, syncStatus: vaultPath ? "synced" : "disconnected" }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  disconnect: () => set({ vaultPath: null, syncStatus: "disconnected" }),
}));
