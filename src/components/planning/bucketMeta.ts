import { formatCurrencyFull } from '@/lib/utils'
import type { Bucket } from '@/lib/budgetPlan'

// Bucket colours are identity only. Status colours (amber = ahead of pace,
// red = over, green = on target) never double as a bucket colour.
export const BUCKET_META: Record<Bucket, { label: string; desc: string; color: string; ink: string; soft: string }> = {
  needs:   { label: 'Needs',   desc: 'Essentials you can’t skip',   color: 'var(--info)',  ink: 'var(--info-ink)',  soft: 'var(--info-soft)' },
  wants:   { label: 'Wants',   desc: 'Lifestyle and discretionary', color: 'var(--wants)', ink: 'var(--wants-ink)', soft: 'var(--wants-soft)' },
  savings: { label: 'Savings', desc: 'Paying your future self',     color: 'var(--good)',  ink: 'var(--good-ink)',  soft: 'var(--good-soft)' },
}

export const MASK = '₹ ••••'

export function money(n: number, masked: boolean): string {
  if (masked) return MASK
  return `${n < 0 ? '−' : ''}${formatCurrencyFull(Math.round(Math.abs(n)))}`
}
