import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TransactionType = 'income' | 'expense'

export const DEFAULT_CATEGORIES = ['Salary', 'Food', 'Travel', 'Shopping', 'Bills', 'Misc'] as const

export const CATEGORY_ICONS: Record<string, string> = {
  Salary: '💼',
  Food: '🍕',
  Travel: '🚗',
  Shopping: '🛍️',
  Bills: '⚡',
  Misc: '📦',
}

export const CATEGORY_COLORS: Record<string, string> = {
  Salary: '#3B82F6',
  Food: '#F59E0B',
  Travel: '#8B5CF6',
  Shopping: '#EC4899',
  Bills: '#F97316',
  Misc: '#6B7280',
}

export interface Transaction {
  id: string
  amount: number
  type: TransactionType
  category: string
  note?: string
  date: string   // 'YYYY-MM-DD'
  time: string   // 'HH:MM'
  createdAt: string
}

interface CashStore {
  // Data
  transactions: Transaction[]
  categories: string[]
  selectedDate: string

  // Modal state (not persisted)
  isModalOpen: boolean
  editingTransaction: Transaction | null

  // Data actions
  setSelectedDate: (date: string) => void
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void
  updateTransaction: (id: string, updates: Partial<Transaction>) => void
  deleteTransaction: (id: string) => void
  addCategory: (name: string) => void

  // Modal actions
  openAddModal: () => void
  openEditModal: (tx: Transaction) => void
  closeModal: () => void
}

function getToday() {
  return new Date().toISOString().split('T')[0]
}

const SEED_TRANSACTIONS: Transaction[] = [
  {
    id: 'seed-1',
    amount: 85000,
    type: 'income',
    category: 'Salary',
    note: 'Monthly salary — April',
    date: getToday(),
    time: '09:00',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed-2',
    amount: 1400,
    type: 'expense',
    category: 'Food',
    note: 'Lunch + chai',
    date: getToday(),
    time: '13:30',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed-3',
    amount: 2200,
    type: 'expense',
    category: 'Travel',
    note: 'Cab to client meeting',
    date: getToday(),
    time: '11:00',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed-4',
    amount: 4500,
    type: 'expense',
    category: 'Bills',
    note: 'Electricity + internet',
    date: getToday(),
    time: '10:15',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed-5',
    amount: 12000,
    type: 'income',
    category: 'Misc',
    note: 'Freelance project payment',
    date: getToday(),
    time: '16:45',
    createdAt: new Date().toISOString(),
  },
]

export const useCashStore = create<CashStore>()(
  persist(
    (set) => ({
      transactions: SEED_TRANSACTIONS,
      categories: [...DEFAULT_CATEGORIES],
      selectedDate: getToday(),
      isModalOpen: false,
      editingTransaction: null,

      setSelectedDate: (date) => set({ selectedDate: date }),

      addTransaction: (tx) =>
        set((state) => ({
          transactions: [
            { ...tx, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
            ...state.transactions,
          ],
        })),

      updateTransaction: (id, updates) =>
        set((state) => ({
          transactions: state.transactions.map((tx) =>
            tx.id === id ? { ...tx, ...updates } : tx
          ),
        })),

      deleteTransaction: (id) =>
        set((state) => ({
          transactions: state.transactions.filter((tx) => tx.id !== id),
        })),

      addCategory: (name) =>
        set((state) => ({
          categories: state.categories.includes(name)
            ? state.categories
            : [...state.categories, name],
        })),

      openAddModal: () => set({ isModalOpen: true, editingTransaction: null }),
      openEditModal: (tx) => set({ isModalOpen: true, editingTransaction: tx }),
      closeModal: () => set({ isModalOpen: false, editingTransaction: null }),
    }),
    {
      name: 'flowtrack-data',
      partialize: (state) => ({
        transactions: state.transactions,
        categories: state.categories,
      }),
    }
  )
)
