'use client'

import { useCashStore } from '@/store/cash-store'

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2V12M2 7H12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function formatDisplayDate(dateStr: string): string {
  const todayStr = new Date().toISOString().split('T')[0]
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  if (dateStr === todayStr) return 'Today'
  if (dateStr === yesterdayStr) return 'Yesterday'

  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  })
}

export default function TopBar() {
  const { selectedDate, setSelectedDate, openAddModal } = useCashStore()
  const todayStr = new Date().toISOString().split('T')[0]
  const isToday = selectedDate === todayStr

  const navigate = (delta: number) => {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-white/90 backdrop-blur-md border-b border-[#EBEBEB] flex items-center justify-between px-4 md:px-6">
      {/* Logo */}
      <div className="flex items-center gap-2 min-w-[80px]">
        <div className="w-7 h-7 bg-[#111] rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[10px] font-bold tracking-tight">FT</span>
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-[#111] hidden sm:block">
          FlowTrack
        </span>
      </div>

      {/* Date Navigator */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => navigate(-1)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#999] hover:bg-[#F2F2F2] hover:text-[#111] transition-colors duration-150"
          aria-label="Previous day"
        >
          <ChevronLeft />
        </button>
        <button
          onClick={() => !isToday && setSelectedDate(todayStr)}
          className="px-3 h-8 rounded-lg text-[13px] font-medium text-[#111] hover:bg-[#F2F2F2] transition-colors duration-150 min-w-[90px] text-center"
        >
          {formatDisplayDate(selectedDate)}
        </button>
        <button
          onClick={() => navigate(1)}
          disabled={isToday}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#999] hover:bg-[#F2F2F2] hover:text-[#111] transition-colors duration-150 disabled:opacity-25 disabled:cursor-not-allowed"
          aria-label="Next day"
        >
          <ChevronRight />
        </button>
      </div>

      {/* Add Button */}
      <div className="min-w-[80px] flex justify-end">
        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 pl-2.5 pr-3.5 h-8 bg-[#111] text-white text-[13px] font-medium rounded-full hover:bg-[#2A2A2A] transition-colors duration-150 active:scale-95"
        >
          <PlusIcon />
          <span>Add</span>
        </button>
      </div>
    </header>
  )
}
