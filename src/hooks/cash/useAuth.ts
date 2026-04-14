/**
 * Phase 8: Auth hook stub — ready for future backend integration.
 * Replace the implementation with your auth provider (Clerk, NextAuth, Supabase, etc.)
 */

export interface User {
  id: string
  email: string
  name?: string
}

export function useAuth() {
  // TODO: integrate real auth provider
  return {
    user: null as User | null,
    isLoading: false,
    isAuthenticated: false,
    signIn: async (_email: string, _password: string) => {
      throw new Error('Auth not implemented yet')
    },
    signOut: async () => {
      throw new Error('Auth not implemented yet')
    },
  }
}
