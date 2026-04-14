'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect
        x="2.5" y="2.5" width="6" height="6" rx="1.5"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? '0' : '1.5'}
      />
      <rect
        x="11.5" y="2.5" width="6" height="6" rx="1.5"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? '0' : '1.5'}
      />
      <rect
        x="2.5" y="11.5" width="6" height="6" rx="1.5"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? '0' : '1.5'}
      />
      <rect
        x="11.5" y="11.5" width="6" height="6" rx="1.5"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? '0' : '1.5'}
      />
    </svg>
  )
}

function ListIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M4 6h12M4 10h12M4 14h8"
        stroke="currentColor"
        strokeWidth={active ? '2' : '1.5'}
        strokeLinecap="round"
      />
    </svg>
  )
}

const NAV_ITEMS = [
  { href: '/cash', label: 'Dashboard', Icon: DashboardIcon },
  { href: '/cash/transactions', label: 'Transactions', Icon: ListIcon },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-[#EBEBEB]">
      <div
        className="flex items-center justify-around"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)', paddingTop: '8px' }}
      >
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 px-8 py-1 rounded-xl transition-colors duration-150 ${
                isActive ? 'text-[#111]' : 'text-[#BBBBBB]'
              }`}
            >
              <Icon active={isActive} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
