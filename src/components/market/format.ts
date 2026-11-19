// Number formatting and tones shared by the market cards

const NF0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const NF2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const MINUS = '−'

// What a hidden ₹ amount reads as
export const MASK = '₹ ••••'

export function inr(v: number, decimals = false) {
  return `${v < 0 ? MINUS : ''}₹${(decimals ? NF2 : NF0).format(Math.abs(v))}`
}

export function signedInr(v: number, decimals = false) {
  if (Math.abs(v) < (decimals ? 0.005 : 0.5)) return '₹0'
  return `${v > 0 ? '+' : MINUS}₹${(decimals ? NF2 : NF0).format(Math.abs(v))}`
}

export function signedPct(v: number) {
  if (Math.abs(v) < 0.005) return '0.00%'
  return `${v > 0 ? '+' : MINUS}${Math.abs(v).toFixed(2)}%`
}

export const whole = (v: number) => NF0.format(v)

export type Dir = 'up' | 'down' | 'flat'
export const dirOf = (v: number): Dir => v > 0.004 ? 'up' : v < -0.004 ? 'down' : 'flat'

export const TONE: Record<Dir, { ink: string; soft: string; line: string }> = {
  up:   { ink: 'var(--good-ink)', soft: 'var(--good-soft)', line: 'var(--good)' },
  down: { ink: 'var(--bad-ink)',  soft: 'var(--bad-soft)',  line: 'var(--bad)' },
  flat: { ink: 'var(--text-3)',   soft: 'var(--surface-2)', line: 'var(--brand)' },
}

export const ARROW: Record<Dir, string> = {
  up: 'M7 17 17 7M8 7h9v9',
  down: 'M7 7l10 10M17 8v9H8',
  flat: 'M5 12h14',
}

export const pctOf = (part: number, base: number) => base ? part / base * 100 : 0

// "2:32 pm"
export const clock = (d: Date) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
