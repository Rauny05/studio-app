'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useCashStore } from '@/store/cash-store'
import { formatCompact } from '@/lib/currency'
import SummaryCard from '@/components/cash/SummaryCard'
import TransactionItem from '@/components/cash/TransactionItem'
import Card from '@/components/cash/Card'
import BarChart from '@/components/cash/BarChart'

function formatBalance(amount: number): string {
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.abs(amount))
}

function isoDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function getWeekDates(anchorDate: string): string[] {
  const anchor = new Date(anchorDate + 'T00:00:00')
  const monday = new Date(anchor)
  monday.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return isoDate(d)
  })
}

export default function CashDashboard() {
  const { transactions, selectedDate } = useCashStore()

  // ── Today ──────────────────────────────────────
  const dayTxs = useMemo(
    () =>
      transactions
        .filter((tx) => tx.date === selectedDate)
        .sort((a, b) => b.time.localeCompare(a.time)),
    [transactions, selectedDate]
  )

  const { incomeTxs, expenseTxs, totalIncome, totalExpense } = useMemo(() => {
    const inc = dayTxs.filter((tx) => tx.type === 'income')
    const exp = dayTxs.filter((tx) => tx.type === 'expense')
    return {
      incomeTxs: inc,
      expenseTxs: exp,
      totalIncome: inc.reduce((s, tx) => s + tx.amount, 0),
      totalExpense: exp.reduce((s, tx) => s + tx.amount, 0),
    }
  }, [dayTxs])

  const balance = totalIncome - totalExpense

  // ── Weekly summary ─────────────────────────────
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate])

  const weekData = useMemo(() => {
    // Single pass: bucket transactions by date
    const byDate: Record<string, { income: number; expense: number }> = {}
    for (const date of weekDates) byDate[date] = { income: 0, expense: 0 }

    for (const tx of transactions) {
      if (byDate[tx.date]) {
        byDate[tx.date][tx.type] += tx.amount
      }
    }

    return weekDates.map((date) => ({
      label: new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 1),
      income: byDate[date].income,
      expense: byDate[date].expense,
    }))
  }, [transactions, weekDates])

  const weekIncome = weekData.reduce((s, d) => s + d.income, 0)
  const weekExpense = weekData.reduce((s, d) => s + d.expense, 0)

  // ── Monthly summary ────────────────────────────
  const yearMonth = selectedDate.slice(0, 7) // 'YYYY-MM'

  const { monthTxs, monthName } = useMemo(() => {
    return {
      monthTxs: transactions.filter((tx) => tx.date.startsWith(yearMonth)),
      monthName: new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { month: 'long' }),
    }
  }, [transactions, yearMonth, selectedDate])

  const monthIncome = monthTxs.filter((tx) => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0)
  const monthExpense = monthTxs.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0)

  return (
    <div className="max-w-xl mx-auto px-4 pt-6 pb-8 space-y-4">

      {/* Balance Hero */}
      <Card className="p-6">
        <p className="text-[11px] font-semibold text-[#BBBBBB] uppercase tracking-[0.1em] mb-2">
          Balance
        </p>
        <h2 className={`text-[44px] font-bold tracking-tight leading-none ${balance < 0 ? 'text-red-500' : 'text-[#111]'}`}>
          {balance < 0 ? '-' : ''}{formatBalance(balance)}
        </h2>
        <p className="text-[13px] text-[#BBBBBB] mt-2.5">
          {dayTxs.length === 0
            ? 'No transactions yet'
            : `${dayTxs.length} transaction${dayTxs.length !== 1 ? 's' : ''}`}
        </p>
      </Card>

      {/* Day Summary Cards */}
      <div className="flex gap-3">
        <SummaryCard type="income" amount={totalIncome} count={incomeTxs.length} />
        <SummaryCard type="expense" amount={totalExpense} count={expenseTxs.length} />
      </div>

      {/* Weekly Chart */}
      <Card className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[11px] font-semibold text-[#BBBBBB] uppercase tracking-[0.1em]">
              This Week
            </p>
            <p className="text-[15px] font-semibold text-[#111] mt-1">
              {formatCompact(weekIncome - weekExpense)}
              <span className="text-[12px] font-normal text-[#BBBBBB] ml-1.5">net</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-emerald-600 font-medium">+{formatCompact(weekIncome)}</p>
            <p className="text-[11px] text-[#AAAAAA] font-medium mt-0.5">-{formatCompact(weekExpense)}</p>
          </div>
        </div>
        <BarChart data={weekData} height={80} />
      </Card>

      {/* Monthly Summary */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold text-[#BBBBBB] uppercase tracking-[0.1em]">
            {monthName}
          </p>
          <span className="text-[11px] text-[#CCCCCC]">{monthTxs.length} txns</span>
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <p className="text-[12px] text-[#BBBBBB] mb-1">Income</p>
            <p className="text-[18px] font-bold text-emerald-600 tracking-tight">
              {formatCompact(monthIncome)}
            </p>
          </div>
          <div className="w-px bg-[#F0F0F0]" />
          <div className="flex-1">
            <p className="text-[12px] text-[#BBBBBB] mb-1">Expenses</p>
            <p className="text-[18px] font-bold text-[#111] tracking-tight">
              {formatCompact(monthExpense)}
            </p>
          </div>
          <div className="w-px bg-[#F0F0F0]" />
          <div className="flex-1">
            <p className="text-[12px] text-[#BBBBBB] mb-1">Net</p>
            <p className={`text-[18px] font-bold tracking-tight ${monthIncome >= monthExpense ? 'text-emerald-600' : 'text-red-500'}`}>
              {formatCompact(Math.abs(monthIncome - monthExpense))}
            </p>
          </div>
        </div>
      </Card>

      {/* Recent Transactions */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-[11px] font-semibold text-[#BBBBBB] uppercase tracking-[0.1em]">
            Recent
          </h3>
          {dayTxs.length > 5 && (
            <Link
              href="/cash/transactions"
              className="text-[12px] text-[#AAAAAA] hover:text-[#111] transition-colors duration-150"
            >
              See all →
            </Link>
          )}
        </div>

        {dayTxs.length === 0 ? (
          <Card className="py-14 text-center">
            <p className="text-4xl mb-2.5">💸</p>
            <p className="text-[14px] font-medium text-[#999]">No transactions yet</p>
            <p className="text-[12px] text-[#CCCCCC] mt-1">
              Tap <strong className="font-semibold text-[#999]">+ Add</strong> to log your first one
            </p>
          </Card>
        ) : (
          <Card className="divide-y divide-[#F5F5F5] overflow-hidden">
            {dayTxs.slice(0, 10).map((tx) => (
              <TransactionItem key={tx.id} transaction={tx} />
            ))}
          </Card>
        )}
      </div>

    </div>
  )
}
