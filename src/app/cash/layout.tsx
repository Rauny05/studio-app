import type { Metadata } from 'next'
import TopBar from '@/components/cash/TopBar'
import BottomNav from '@/components/cash/BottomNav'
import CashProviders from '@/components/cash/CashProviders'

export const metadata: Metadata = {
  title: 'FlowTrack — Cash Tracker',
  description: 'Fast, minimal daily cash tracker',
}

export default function CashLayout({ children }: { children: React.ReactNode }) {
  return (
    <CashProviders>
      <div
        className="min-h-dvh bg-[#F7F7F7]"
        style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif" }}
      >
        <TopBar />
        <main className="pt-14 pb-20 md:pb-6">{children}</main>
        <BottomNav />
      </div>
    </CashProviders>
  )
}
