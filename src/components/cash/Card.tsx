import { cn } from '@/lib/utils'

interface CardProps {
  className?: string
  children: React.ReactNode
  onClick?: () => void
}

export default function Card({ className, children, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-2xl border border-[#EBEBEB] shadow-[0_1px_4px_rgba(0,0,0,0.05)]',
        onClick && 'cursor-pointer hover:border-[#D5D5D5] transition-colors duration-150',
        className
      )}
    >
      {children}
    </div>
  )
}
