/**
 * Phase 8: Cloud sync hook stub.
 * Swap implementation with your backend (Supabase, Firebase, custom API, etc.)
 * The useCashStore is already structured with addTransaction/updateTransaction/deleteTransaction
 * that map cleanly to REST or realtime endpoints.
 */

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

export function useCloudSync() {
  // TODO: connect to real sync backend
  return {
    status: 'idle' as SyncStatus,
    lastSynced: null as Date | null,
    sync: async () => {
      throw new Error('Cloud sync not implemented yet')
    },
    isSyncing: false,
  }
}
