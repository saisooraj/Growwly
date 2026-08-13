import type { Transaction } from '@/types'

interface Candidate {
  amount: number
  category: string
  date: string
  merchant: string | null
}

export function findPossibleDuplicate(candidate: Candidate, transactions: Transaction[]): Transaction | null {
  const merchantLower = candidate.merchant?.toLowerCase().trim()

  return transactions.find(t => {
    if (t.amount !== candidate.amount) return false
    if (t.date !== candidate.date) return false
    if (t.category === candidate.category) return true
    if (merchantLower && t.notes?.toLowerCase().includes(merchantLower)) return true
    return false
  }) ?? null
}
