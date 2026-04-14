'use client'

import { useToastStore } from '@/store/toast-store'

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 6.5V9.5M7 4.5V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-lg pointer-events-auto cash-toast-enter ${
            toast.type === 'success'
              ? 'bg-[#111] text-white'
              : toast.type === 'error'
              ? 'bg-red-500 text-white'
              : 'bg-white text-[#111] border border-[#EBEBEB]'
          }`}
        >
          <span
            className={`flex-shrink-0 ${
              toast.type === 'success'
                ? 'text-emerald-400'
                : toast.type === 'error'
                ? 'text-red-200'
                : 'text-[#888]'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckIcon />
            ) : toast.type === 'error' ? (
              <XIcon />
            ) : (
              <InfoIcon />
            )}
          </span>
          <span className="text-[13px] font-medium whitespace-nowrap">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="opacity-50 hover:opacity-100 transition-opacity ml-1"
          >
            <XIcon />
          </button>
        </div>
      ))}
    </div>
  )
}
