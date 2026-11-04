import type { Liability } from '@/types'

// ── EMI / Loan calculations ────────────────────────────────────────────────────

export function calcEMI(principal: number, annualRate: number, tenureMonths: number): number {
  if (annualRate === 0 || tenureMonths === 0) return tenureMonths > 0 ? principal / tenureMonths : 0
  const r = annualRate / 12 / 100
  return principal * r * Math.pow(1 + r, tenureMonths) / (Math.pow(1 + r, tenureMonths) - 1)
}

export function calcOutstanding(principal: number, annualRate: number, tenureMonths: number, startDate: string): number {
  if (tenureMonths === 0) return principal
  const start = new Date(startDate)
  const now = new Date()
  const monthsPaid = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()))
  if (monthsPaid >= tenureMonths) return 0
  if (annualRate === 0) return principal - (principal / tenureMonths) * monthsPaid
  const r = annualRate / 12 / 100
  const emi = calcEMI(principal, annualRate, tenureMonths)
  return principal * Math.pow(1 + r, monthsPaid) - emi * (Math.pow(1 + r, monthsPaid) - 1) / r
}

export function monthsRemaining(tenureMonths: number, startDate: string): number {
  const start = new Date(startDate)
  const now = new Date()
  const paid = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()))
  return Math.max(0, tenureMonths - paid)
}

/** Outstanding balance of a liability today (credit cards and untimed loans: the principal). */
export function liabilityOutstanding(l: Liability): number {
  return l.tenureMonths > 0 ? calcOutstanding(l.principal, l.interestRate, l.tenureMonths, l.startDate) : l.principal
}
