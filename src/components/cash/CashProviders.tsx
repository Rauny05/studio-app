'use client'

import AddTransactionModal from './AddTransactionModal'
import ToastContainer from './ToastContainer'

export default function CashProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AddTransactionModal />
      <ToastContainer />
    </>
  )
}
