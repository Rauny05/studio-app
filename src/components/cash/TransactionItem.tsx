'use client'

import { Transaction, CATEGORY_ICONS, CATEGORY_COLORS, useCashStore } from '@/store/cash-store'
import { formatAmount } from '@/lib/currency'

interface TransactionItemProps {
  transaction: Transaction
}

export default function TransactionItem({ transaction }: TransactionItemProps) {
  const { openEditModal } = useCashStore()
  const { amount, type, category, note, time } = transaction
  const icon = CATEGORY_ICONS[category] ?? '💰'
  const color = CATEGORY_COLORS[category] ?? '#6B7280'
  const isIncome = type === 'income'

  return (
    <button
      onClick={() => openEditModal(transaction)}
      className="w-full flex items-center gap-3 py-3 px-4 hover:bg-[#FAFAFA] transition-colors duration-150 text-left group"
    >
      {/* Category icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-[18px] flex-shrink-0 transition-transform duration-150 group-hover:scale-105"
        style={{ backgroundColor: color + '18' }}
      >
        {icon}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[14px] font-medium text-[#111] truncate">{category}</span>
          <span
            className={`text-[14px] font-semibold flex-shrink-0 tabular-nums ${
              isIncome ? 'text-emerald-600' : 'text-[#111]'
            }`}
          >
            {isIncome ? '+' : '-'}₹{formatAmount(amount)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          {note ? (
            <span className="text-[12px] text-[#AAAAAA] truncate">{note}</span>
          ) : (
            <span className="text-[12px] text-[#DDDDDD]">No note</span>
          )}
          <span className="text-[11px] text-[#CCCCCC] flex-shrink-0 tabular-nums">{time}</span>
        </div>
      </div>
    </button>
  )
}
