/**
 * Phase 8: CSV export hook.
 * Fully functional — exports transactions from the store as CSV.
 */

import { useCashStore } from '@/store/cash-store'

export function useExport() {
  const { transactions } = useCashStore()

  const exportCSV = (filename = 'flowtrack-export.csv') => {
    const headers = ['Date', 'Time', 'Type', 'Category', 'Amount', 'Note']

    const rows = [...transactions]
      .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
      .map((tx) => [
        tx.date,
        tx.time,
        tx.type,
        tx.category,
        tx.amount.toString(),
        tx.note ?? '',
      ])

    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((cell) => (cell.includes(',') || cell.includes('"') ? `"${cell.replace(/"/g, '""')}"` : cell)).join(',')
      )
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  return { exportCSV, transactionCount: transactions.length }
}
