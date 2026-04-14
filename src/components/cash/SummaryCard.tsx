import { cn } from '@/lib/utils'
import { formatCompact } from '@/lib/currency'

function ArrowUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 11V3M3 7L7 3L11 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArrowDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 3V11M3 7L7 11L11 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface SummaryCardProps {
  type: 'income' | 'expense'
  amount: number
  count: number
}

export default function SummaryCard({ type, amount, count }: SummaryCardProps) {
  const isIncome = type === 'income'

  return (
    <div className={cn('flex-1 bg-white rounded-2xl border p-4', isIncome ? 'border-emerald-100' : 'border-red-100')}>
      <div className="flex items-center justify-between mb-3">
        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500')}>
          {isIncome ? <ArrowUp /> : <ArrowDown />}
        </div>
        <span className="text-[11px] text-[#BBBBBB] font-medium">
          {count} txn{count !== 1 ? 's' : ''}
        </span>
      </div>

      <p className={cn('text-[22px] font-bold tracking-tight leading-none', isIncome ? 'text-emerald-600' : 'text-red-500')}>
        {isIncome ? '+' : '-'}{formatCompact(amount)}
      </p>
      <p className="text-[12px] text-[#BBBBBB] mt-1 font-medium">
        {isIncome ? 'Income' : 'Expenses'}
      </p>
    </div>
  )
}
