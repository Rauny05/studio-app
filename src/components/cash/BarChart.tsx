'use client'

interface DataPoint {
  label: string
  income: number
  expense: number
}

interface BarChartProps {
  data: DataPoint[]
  height?: number
}

import { formatCompactPlain } from '@/lib/currency'

export default function BarChart({ data, height = 100 }: BarChartProps) {
  if (data.length === 0) return null

  let maxVal = 1
  for (const d of data) {
    if (d.income > maxVal) maxVal = d.income
    if (d.expense > maxVal) maxVal = d.expense
  }

  return (
    <div className="w-full">
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d, i) => {
          const incomeH = Math.max((d.income / maxVal) * height, d.income > 0 ? 4 : 0)
          const expenseH = Math.max((d.expense / maxVal) * height, d.expense > 0 ? 4 : 0)

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full flex items-end justify-center gap-[2px]" style={{ height }}>
                {d.income > 0 && (
                  <div
                    className="flex-1 bg-emerald-400 rounded-t-[3px] transition-all duration-500"
                    style={{ height: incomeH }}
                    title={`Income ₹${formatCompactPlain(d.income)}`}
                  />
                )}
                {d.expense > 0 && (
                  <div
                    className="flex-1 bg-[#E5E5E5] rounded-t-[3px] transition-all duration-500"
                    style={{ height: expenseH }}
                    title={`Expense ₹${formatCompactPlain(d.expense)}`}
                  />
                )}
                {d.income === 0 && d.expense === 0 && (
                  <div className="flex-1 bg-[#F0F0F0] rounded-t-[3px]" style={{ height: 3 }} />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex items-center gap-1.5 mt-2">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-[#CCCCCC] font-medium">
            {d.label}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
          <span className="text-[11px] text-[#AAAAAA]">Income</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-[#E5E5E5]" />
          <span className="text-[11px] text-[#AAAAAA]">Expense</span>
        </div>
      </div>
    </div>
  )
}
