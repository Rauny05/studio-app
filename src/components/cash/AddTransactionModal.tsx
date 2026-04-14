'use client'

import { useState, useEffect, useRef } from 'react'
import { useCashStore, TransactionType, CATEGORY_ICONS, CATEGORY_COLORS } from '@/store/cash-store'
import { toast } from '@/store/toast-store'

function getCurrentTime(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export default function AddTransactionModal() {
  const {
    isModalOpen,
    editingTransaction,
    closeModal,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    categories,
    addCategory,
    selectedDate,
  } = useCashStore()

  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Food')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(selectedDate)
  const [time, setTime] = useState(getCurrentTime())
  const [newCat, setNewCat] = useState('')
  const [addingCat, setAddingCat] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [amountError, setAmountError] = useState(false)

  const amountRef = useRef<HTMLInputElement>(null)
  const isIncome = type === 'income'

  useEffect(() => {
    if (!isModalOpen) return
    if (editingTransaction) {
      setType(editingTransaction.type)
      setAmount(String(editingTransaction.amount))
      setCategory(editingTransaction.category)
      setNote(editingTransaction.note ?? '')
      setDate(editingTransaction.date)
      setTime(editingTransaction.time)
    } else {
      setType('expense')
      setAmount('')
      setCategory('Food')
      setNote('')
      setDate(selectedDate)
      setTime(getCurrentTime())
    }
    setConfirmDelete(false)
    setAddingCat(false)
    setNewCat('')
    setAmountError(false)
    const t = setTimeout(() => amountRef.current?.focus(), 180)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    if (isModalOpen) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isModalOpen, closeModal])

  const handleSubmit = () => {
    const parsed = parseFloat(amount.replace(/,/g, ''))
    if (!parsed || parsed <= 0) {
      setAmountError(true)
      amountRef.current?.focus()
      setTimeout(() => setAmountError(false), 600)
      return
    }

    const txData = {
      type,
      amount: parsed,
      category,
      note: note.trim() || undefined,
      date,
      time,
    }

    if (editingTransaction) {
      updateTransaction(editingTransaction.id, txData)
      toast.success('Transaction updated')
    } else {
      addTransaction(txData)
      toast.success(`${txData.type === 'income' ? 'Income' : 'Expense'} added`)
    }
    closeModal()
  }

  const handleDelete = () => {
    if (!editingTransaction) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    deleteTransaction(editingTransaction.id)
    toast.info('Transaction deleted')
    closeModal()
  }

  const handleAddCategory = () => {
    const name = newCat.trim()
    if (name) {
      addCategory(name)
      setCategory(name)
    }
    setNewCat('')
    setAddingCat(false)
  }

  if (!isModalOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => e.target === e.currentTarget && closeModal()}
    >
      <div
        className="w-full md:max-w-sm bg-white rounded-t-[28px] md:rounded-2xl overflow-hidden cash-modal-enter"
        style={{ boxShadow: '0 -4px 40px rgba(0,0,0,0.15)' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2 md:hidden">
          <div className="w-8 h-[3px] bg-[#E5E5E5] rounded-full" />
        </div>

        {/* Type toggle */}
        <div className="px-4 pt-2 pb-4">
          <div className="flex bg-[#F2F2F2] rounded-2xl p-1 gap-1">
            {(['expense', 'income'] as TransactionType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 h-9 rounded-xl text-[13.5px] font-semibold transition-all duration-200 capitalize ${
                  type === t
                    ? 'bg-white text-[#111] shadow-sm'
                    : 'text-[#AAAAAA] hover:text-[#666]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div
          className={`px-5 pb-5 flex items-baseline gap-1 transition-colors duration-200 ${
            amountError ? 'animate-shake' : ''
          }`}
        >
          <span
            className={`text-[30px] font-bold leading-none pb-1 ${
              isIncome ? 'text-emerald-600' : 'text-[#999]'
            }`}
          >
            ₹
          </span>
          <input
            ref={amountRef}
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className={`text-[44px] font-bold tracking-tight bg-transparent border-none outline-none w-full min-w-0 cash-amount-input transition-colors duration-200 ${
              isIncome
                ? 'text-emerald-600 placeholder:text-emerald-200'
                : 'text-[#111] placeholder:text-[#E0E0E0]'
            } ${amountError ? 'text-red-500' : ''}`}
          />
        </div>

        <div className="h-px bg-[#F0F0F0]" />

        {/* Category */}
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold text-[#CCCCCC] uppercase tracking-[0.1em] mb-2.5">
            Category
          </p>
          <div className="flex gap-2 overflow-x-auto pb-0.5 cash-no-scrollbar">
            {categories.map((cat) => {
              const icon = CATEGORY_ICONS[cat] ?? '📦'
              const color = CATEGORY_COLORS[cat] ?? '#6B7280'
              const isSelected = category === cat
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`flex items-center gap-1.5 pl-2 pr-3 h-8 rounded-full text-[13px] font-medium flex-shrink-0 transition-all duration-150 ${
                    isSelected ? 'text-white scale-105' : 'bg-[#F5F5F5] text-[#555] hover:bg-[#EBEBEB]'
                  }`}
                  style={isSelected ? { backgroundColor: color } : undefined}
                >
                  <span className="text-[14px] leading-none">{icon}</span>
                  {cat}
                </button>
              )
            })}
            {addingCat ? (
              <input
                type="text"
                autoFocus
                placeholder="Name..."
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddCategory()
                  if (e.key === 'Escape') {
                    setAddingCat(false)
                    setNewCat('')
                  }
                }}
                onBlur={handleAddCategory}
                className="h-8 px-3 rounded-full bg-[#F5F5F5] text-[13px] text-[#111] outline-none border border-[#DDDDDD] focus:border-[#BBBBBB] min-w-[110px] flex-shrink-0"
              />
            ) : (
              <button
                onClick={() => setAddingCat(true)}
                className="flex items-center gap-1 px-3 h-8 rounded-full bg-[#F5F5F5] text-[13px] text-[#AAAAAA] flex-shrink-0 hover:bg-[#EBEBEB] transition-colors"
              >
                + New
              </button>
            )}
          </div>
        </div>

        <div className="h-px bg-[#F0F0F0]" />

        {/* Note */}
        <div className="px-4 py-3.5">
          <input
            type="text"
            placeholder="Add a note..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="w-full text-[14px] text-[#111] placeholder-[#CCCCCC] bg-transparent border-none outline-none"
          />
        </div>

        <div className="h-px bg-[#F0F0F0]" />

        {/* Date & Time */}
        <div className="px-4 py-3 flex gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 h-9 px-3 bg-[#F5F5F5] rounded-xl text-[13px] text-[#111] border-none outline-none"
            style={{ colorScheme: 'light' }}
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-[112px] h-9 px-3 bg-[#F5F5F5] rounded-xl text-[13px] text-[#111] border-none outline-none"
            style={{ colorScheme: 'light' }}
          />
        </div>

        <div className="h-px bg-[#F0F0F0]" />

        {/* Footer */}
        <div
          className="px-4 py-3 flex items-center gap-2"
          style={{ paddingBottom: 'max(12px, calc(env(safe-area-inset-bottom, 0px) + 12px))' }}
        >
          {editingTransaction && (
            <button
              onClick={handleDelete}
              onMouseLeave={() => setConfirmDelete(false)}
              className={`h-9 px-4 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                confirmDelete
                  ? 'bg-red-500 text-white'
                  : 'text-red-500 bg-red-50 hover:bg-red-100'
              }`}
            >
              {confirmDelete ? 'Confirm?' : 'Delete'}
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={closeModal}
            className="h-9 px-4 rounded-xl text-[13px] font-medium text-[#999] hover:bg-[#F2F2F2] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className={`h-9 px-5 rounded-xl text-[13px] font-semibold text-white transition-all duration-150 active:scale-95 ${
              isIncome
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-[#111] hover:bg-[#2A2A2A]'
            }`}
          >
            {editingTransaction ? 'Update' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
