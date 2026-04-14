'use client'

import { useState, useMemo } from 'react'
import { useCashStore, Transaction, CATEGORY_ICONS, CATEGORY_COLORS } from '@/store/cash-store'
import { formatCompact } from '@/lib/currency'
import TransactionItem from '@/components/cash/TransactionItem'
import Card from '@/components/cash/Card'

type SortOption = 'latest' | 'oldest' | 'highest' | 'lowest'
type FilterType = 'all' | 'income' | 'expense'

function groupByDate(txs: Transaction[]): [string, Transaction[]][] {
  const groups: Record<string, Transaction[]> = {}
  for (const tx of txs) {
    if (!groups[tx.date]) groups[tx.date] = []
    groups[tx.date].push(tx)
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
}

function formatGroupDate(dateStr: string): string {
  const todayStr = new Date().toISOString().split('T')[0]
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]
  if (dateStr === todayStr) return 'Today'
  if (dateStr === yesterdayStr) return 'Yesterday'
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}


function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 10.5L13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function FilterIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M2 4h11M4 7.5h7M6 11h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export default function TransactionsPage() {
  const { transactions, categories } = useCashStore()

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [sort, setSort] = useState<SortOption>('latest')
  const [showFilters, setShowFilters] = useState(false)

  const filtered = useMemo(() => {
    let txs = [...transactions]

    if (search.trim()) {
      const q = search.toLowerCase()
      txs = txs.filter(
        (tx) =>
          tx.category.toLowerCase().includes(q) ||
          tx.note?.toLowerCase().includes(q)
      )
    }

    if (filterType !== 'all') txs = txs.filter((tx) => tx.type === filterType)
    if (filterCategory !== 'all') txs = txs.filter((tx) => tx.category === filterCategory)
    if (filterDateFrom) txs = txs.filter((tx) => tx.date >= filterDateFrom)
    if (filterDateTo) txs = txs.filter((tx) => tx.date <= filterDateTo)

    txs.sort((a, b) => {
      if (sort === 'latest') {
        const d = b.date.localeCompare(a.date)
        return d !== 0 ? d : b.time.localeCompare(a.time)
      }
      if (sort === 'oldest') {
        const d = a.date.localeCompare(b.date)
        return d !== 0 ? d : a.time.localeCompare(b.time)
      }
      if (sort === 'highest') return b.amount - a.amount
      return a.amount - b.amount
    })

    return txs
  }, [transactions, search, filterType, filterCategory, filterDateFrom, filterDateTo, sort])

  const grouped = groupByDate(filtered)

  const hasActiveFilters =
    filterType !== 'all' || filterCategory !== 'all' || filterDateFrom || filterDateTo || search

  const clearFilters = () => {
    setSearch('')
    setFilterType('all')
    setFilterCategory('all')
    setFilterDateFrom('')
    setFilterDateTo('')
    setSort('latest')
  }

  return (
    <div className="max-w-xl mx-auto px-4 pt-6 pb-8 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h1 className="text-[16px] font-semibold text-[#111]">Transactions</h1>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-[12px] text-red-500 hover:text-red-700 transition-colors"
            >
              Clear
            </button>
          )}
          <span className="text-[12px] text-[#BBBBBB]">{filtered.length} of {transactions.length}</span>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 h-10 px-3.5 bg-white rounded-2xl border border-[#EBEBEB] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <span className="text-[#CCCCCC] flex-shrink-0">
          <SearchIcon />
        </span>
        <input
          type="text"
          placeholder="Search by category or note..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 text-[13px] text-[#111] placeholder-[#CCCCCC] bg-transparent border-none outline-none"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-[#CCCCCC] hover:text-[#999] transition-colors">
            <XIcon />
          </button>
        )}
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 overflow-x-auto cash-no-scrollbar pb-0.5">
        {/* Type filter */}
        {(['all', 'income', 'expense'] as FilterType[]).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`flex-shrink-0 h-7 px-3 rounded-full text-[12px] font-medium transition-all duration-150 capitalize ${
              filterType === t
                ? 'bg-[#111] text-white'
                : 'bg-white text-[#999] border border-[#EBEBEB] hover:border-[#DDDDDD]'
            }`}
          >
            {t}
          </button>
        ))}

        <div className="w-px h-4 bg-[#EBEBEB] flex-shrink-0" />

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="flex-shrink-0 h-7 px-2.5 rounded-full text-[12px] text-[#999] bg-white border border-[#EBEBEB] outline-none cursor-pointer"
          style={{ colorScheme: 'light' }}
        >
          <option value="latest">Latest</option>
          <option value="oldest">Oldest</option>
          <option value="highest">Highest</option>
          <option value="lowest">Lowest</option>
        </select>

        {/* Toggle advanced filters */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex-shrink-0 flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-medium transition-all duration-150 ${
            showFilters || filterCategory !== 'all' || filterDateFrom || filterDateTo
              ? 'bg-[#111] text-white'
              : 'bg-white text-[#999] border border-[#EBEBEB] hover:border-[#DDDDDD]'
          }`}
        >
          <FilterIcon />
          Filter
        </button>
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <Card className="p-4 space-y-3">
          {/* Category */}
          <div>
            <p className="text-[10px] font-semibold text-[#CCCCCC] uppercase tracking-[0.1em] mb-2">
              Category
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterCategory('all')}
                className={`h-7 px-3 rounded-full text-[12px] font-medium transition-all ${
                  filterCategory === 'all'
                    ? 'bg-[#111] text-white'
                    : 'bg-[#F5F5F5] text-[#666] hover:bg-[#EBEBEB]'
                }`}
              >
                All
              </button>
              {categories.map((cat) => {
                const icon = CATEGORY_ICONS[cat] ?? '📦'
                const color = CATEGORY_COLORS[cat] ?? '#6B7280'
                const isSelected = filterCategory === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`flex items-center gap-1.5 h-7 pl-2 pr-3 rounded-full text-[12px] font-medium transition-all ${
                      isSelected ? 'text-white' : 'bg-[#F5F5F5] text-[#666] hover:bg-[#EBEBEB]'
                    }`}
                    style={isSelected ? { backgroundColor: color } : undefined}
                  >
                    <span className="text-[12px]">{icon}</span>
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date range */}
          <div>
            <p className="text-[10px] font-semibold text-[#CCCCCC] uppercase tracking-[0.1em] mb-2">
              Date Range
            </p>
            <div className="flex gap-2">
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                placeholder="From"
                className="flex-1 h-8 px-3 bg-[#F5F5F5] rounded-xl text-[12px] text-[#111] border-none outline-none"
                style={{ colorScheme: 'light' }}
              />
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                placeholder="To"
                className="flex-1 h-8 px-3 bg-[#F5F5F5] rounded-xl text-[12px] text-[#111] border-none outline-none"
                style={{ colorScheme: 'light' }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Results */}
      {filtered.length === 0 ? (
        <Card className="py-16 text-center">
          {hasActiveFilters ? (
            <>
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-[15px] font-medium text-[#999]">No results found</p>
              <p className="text-[12px] text-[#CCCCCC] mt-1.5">Try adjusting your filters</p>
              <button
                onClick={clearFilters}
                className="mt-4 text-[13px] font-medium text-[#111] underline underline-offset-2"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="text-4xl mb-3">💸</p>
              <p className="text-[15px] font-medium text-[#999]">No transactions yet</p>
              <p className="text-[12px] text-[#CCCCCC] mt-1.5">
                Tap <strong className="font-semibold text-[#999]">+ Add</strong> to get started
              </p>
            </>
          )}
        </Card>
      ) : (
        grouped.map(([date, txs]) => {
          const dayIncome = txs.filter((tx) => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0)
          const dayExpense = txs.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0)
          return (
            <div key={date}>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[11px] font-semibold text-[#BBBBBB] uppercase tracking-[0.1em]">
                  {formatGroupDate(date)}
                </span>
                <div className="flex items-center gap-3">
                  {dayIncome > 0 && (
                    <span className="text-[11px] font-semibold text-emerald-600">
                      +{formatCompact(dayIncome)}
                    </span>
                  )}
                  {dayExpense > 0 && (
                    <span className="text-[11px] font-semibold text-red-500">
                      -{formatCompact(dayExpense)}
                    </span>
                  )}
                </div>
              </div>
              <Card className="divide-y divide-[#F5F5F5] overflow-hidden">
                {txs.map((tx) => (
                  <TransactionItem key={tx.id} transaction={tx} />
                ))}
              </Card>
            </div>
          )
        })
      )}

    </div>
  )
}
