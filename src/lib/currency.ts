const formatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

/** ₹85,000 */
export function formatAmount(n: number): string {
  return formatter.format(n)
}

/** ₹85K / ₹1.4L / ₹500 */
export function formatCompact(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`
  return `₹${formatter.format(n)}`
}

/** Same as formatCompact but without ₹ prefix (for chart tooltips) */
export function formatCompactPlain(n: number): string {
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`
  return String(n)
}
