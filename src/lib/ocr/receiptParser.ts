import { isValid } from 'date-fns'

export type ReceiptTransactionType = 'expense' | 'income'

export interface ParsedReceipt {
  amount: number | null
  merchant: string | null
  date: string | null // YYYY-MM-DD, or null if nothing detected
  type: ReceiptTransactionType
}

const CURRENCY_RE = /(?:₹|\$|\bRs\.?\s*|\bINR\b\s*|\bUSD\b\s*)\s*([\d,]+(?:\.\d{1,2})?)/gi
const LABELED_BARE_RE = /\b(grand total|net amount|transaction amount|amount paid|total|paid|debited|amount)\b\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)\b/i
const POSITIVE_LABEL_RE = /\b(grand total|net amount|transaction amount|amount paid|total|paid|debited|amount)\b/i
const NEGATIVE_LABEL_RE = /\b(sub\s*total|discount|off|cashback|deliver(y|ies)?|packing|item total|tax(es)?|gst|cgst|sgst|convenience fee|service fee)\b/i
// Payment-app screenshots (GPay/PhonePe/UPI) show the amount as a large standalone line with
// no "Amount:" label — and Tesseract's English model frequently misreads the ₹ glyph as a
// stray character (seen in practice as "3" or "%") since it isn't in the eng training set.
// A line that's nothing but one stray leading character plus a plausible amount is almost
// always that misread hero amount. Capped at 7 digits and skipped right after an "ID"/
// "reference" label so it can't grab a transaction/reference number sitting on its own line.
const ISOLATED_AMOUNT_RE = /^[^\d\n]?([\d,]+(?:\.\d{1,2})?)$/
const ID_LABEL_RE = /\b(id|reference|ref\s*no|ref#)\b/i
const MAX_ISOLATED_DIGITS = 7

interface Candidate {
  value: number
  tier: 0 | 1 | 2
}

function parseAmountToken(raw: string): number | null {
  let cleaned = raw.trim()
  if (!cleaned.includes('.')) {
    // No period present — a trailing 2-digit comma group is almost always an OCR-misread
    // decimal point (e.g. "31,24" -> 31.24), while a trailing 3-digit group is thousands
    // grouping (Indian or Western, e.g. "1,25,000" / "1,350" -> 125000 / 1350).
    const parts = cleaned.split(',')
    if (parts.length > 1 && parts[parts.length - 1].length === 2) {
      const decimals = parts.pop()
      cleaned = parts.join('') + '.' + decimals
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  } else {
    cleaned = cleaned.replace(/,/g, '')
  }
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

export function extractAmount(text: string): number | null {
  const candidates: Candidate[] = []
  const lines = text.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lower = line.toLowerCase()
    const isNegative = NEGATIVE_LABEL_RE.test(lower)
    const isPositive = POSITIVE_LABEL_RE.test(lower)

    let matchedOnLine = false
    CURRENCY_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = CURRENCY_RE.exec(line)) !== null) {
      const value = parseAmountToken(m[1])
      if (value == null) continue
      matchedOnLine = true
      const tier: 0 | 1 | 2 = isNegative ? 2 : isPositive ? 0 : 1
      candidates.push({ value, tier })
    }

    if (!matchedOnLine) {
      const labeled = line.match(LABELED_BARE_RE)
      if (labeled) {
        const value = parseAmountToken(labeled[2])
        if (value != null) candidates.push({ value, tier: isNegative ? 2 : 0 })
      } else if (i === 0 || !ID_LABEL_RE.test(lines[i - 1])) {
        const isolated = line.trim().match(ISOLATED_AMOUNT_RE)
        const digitCount = isolated?.[1].replace(/[.,]/g, '').length ?? 0
        if (isolated && digitCount >= 2 && digitCount <= MAX_ISOLATED_DIGITS) {
          const value = parseAmountToken(isolated[1])
          if (value != null) candidates.push({ value, tier: isNegative ? 2 : 1 })
        }
      }
    }
  }

  if (candidates.length === 0) return null

  let best: Candidate | null = null
  for (const c of candidates) {
    if (!best || c.tier < best.tier || (c.tier === best.tier && c.value > best.value)) {
      best = c
    }
  }
  return best?.value ?? null
}

const MERCHANT_PATTERNS = [
  /paid to[:\s]+([^\n₹]{2,40})/i,
  /sent to[:\s]+([^\n₹]{2,40})/i,
  /merchant[:\s]+([^\n₹]{2,40})/i,
  /store[:\s]+([^\n₹]{2,40})/i,
  /restaurant[:\s]+([^\n₹]{2,40})/i,
]

const MERCHANT_NOISE_RE = /payment successful|upi payment|transaction id|order id|order no|receipt|invoice|tax invoice|^bill$|amount|total|date|time|status|debited|credited/i

function cleanMerchantCandidate(raw: string): string {
  return raw.replace(/[.,;:]+$/, '').trim()
}

export function extractMerchant(text: string): string | null {
  const lines = text.split('\n')

  for (const line of lines) {
    for (const pattern of MERCHANT_PATTERNS) {
      const m = line.match(pattern)
      if (m) {
        const candidate = cleanMerchantCandidate(m[1])
        if (candidate.length >= 2) return candidate
      }
    }
  }

  for (const rawLine of lines.slice(0, 6)) {
    const line = rawLine.trim()
    if (line.length < 2 || line.length > 40) continue
    if (/^[\d\s.,₹\-:/]+$/.test(line)) continue
    if (MERCHANT_NOISE_RE.test(line)) continue
    return cleanMerchantCandidate(line)
  }

  return null
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

function normalizeYear(y: number): number {
  return y < 100 ? 2000 + y : y
}

function toIsoDate(year: number, month: number, day: number): string | null {
  const d = new Date(year, month, day)
  if (!isValid(d) || d.getMonth() !== month || d.getDate() !== day) return null
  const mm = String(month + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

const DATE_PATTERNS: { re: RegExp; extract: (m: RegExpMatchArray) => string | null }[] = [
  // 13 Aug 2026 / 13-Aug-26 / 13 August 2026
  {
    re: /\b(\d{1,2})[\s-](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-,]?\s*(\d{2,4})\b/i,
    extract: m => {
      const day = parseInt(m[1], 10)
      const month = MONTHS[m[2].toLowerCase()]
      const year = normalizeYear(parseInt(m[3], 10))
      return toIsoDate(year, month, day)
    },
  },
  // Aug 13, 2026 / August 13 2026
  {
    re: /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s+(\d{2,4})\b/i,
    extract: m => {
      const month = MONTHS[m[1].toLowerCase()]
      const day = parseInt(m[2], 10)
      const year = normalizeYear(parseInt(m[3], 10))
      return toIsoDate(year, month, day)
    },
  },
  // YYYY-MM-DD
  {
    re: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/,
    extract: m => toIsoDate(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)),
  },
  // DD/MM/YYYY or DD-MM-YYYY (day-first, Indian convention)
  {
    re: /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/,
    extract: m => {
      const day = parseInt(m[1], 10)
      const month = parseInt(m[2], 10) - 1
      const year = normalizeYear(parseInt(m[3], 10))
      if (day < 1 || day > 31 || month < 0 || month > 11) return null
      return toIsoDate(year, month, day)
    },
  },
]

export function extractDate(text: string): string | null {
  for (const { re, extract } of DATE_PATTERNS) {
    const m = text.match(re)
    if (m) {
      const iso = extract(m)
      if (iso) return iso
    }
  }
  return null
}

const EXPENSE_KEYWORDS_RE = /\b(debited|paid|payment successful|purchase|sent|spent)\b/i
const INCOME_KEYWORDS_RE = /\b(credited|received|refund|cashback|salary credited|deposit)\b/i

export function extractType(text: string): ReceiptTransactionType {
  const isIncome = INCOME_KEYWORDS_RE.test(text)
  const isExpense = EXPENSE_KEYWORDS_RE.test(text)
  if (isIncome && !isExpense) return 'income'
  return 'expense'
}

export function parseReceiptText(text: string): ParsedReceipt {
  return {
    amount: extractAmount(text),
    merchant: extractMerchant(text),
    date: extractDate(text),
    type: extractType(text),
  }
}
