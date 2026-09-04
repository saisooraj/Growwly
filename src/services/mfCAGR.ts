// ── CAGR data service ───────────────────────────────────────────────────────
//
// Resolves a base annual CAGR for a mutual-fund scheme from its AMFI NAV
// history (mfapi.in), with a 24h client-side cache and category fallbacks.
// Runs entirely in the browser — mfapi.in serves `Access-Control-Allow-Origin: *`.

import { CATEGORY_DEFAULT_CAGR } from '@/lib/mfProjection'

const TTL_MS = 24 * 60 * 60 * 1000
const FALLBACK_CAGR = 0.12
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000

const cacheKey = (code: string) => `mf_cagr_${code}`

interface NavRow {
  date: string // "dd-mm-yyyy"
  nav: string
}

/**
 * Base annual CAGR (decimal) for a scheme. Tries the 24h cache, then the AMFI
 * 5-year NAV history, then the category default, then a flat 12%.
 */
export async function getCAGR(schemeCode: string, category: string): Promise<number> {
  const fallback = CATEGORY_DEFAULT_CAGR[category] ?? FALLBACK_CAGR
  if (!schemeCode) return fallback

  const cached = readCache(schemeCode)
  if (cached != null) return cached

  try {
    const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}`)
    if (!res.ok) throw new Error(`mfapi ${res.status}`)
    const json = await res.json()
    const cagr = computeFiveYearCAGR(json?.data ?? [])
    const value = cagr ?? fallback
    writeCache(schemeCode, value)
    return value
  } catch {
    return fallback
  }
}

// ── NAV history → CAGR ──────────────────────────────────────────────────────

function toTime(ddmmyyyy: string | undefined): number {
  if (!ddmmyyyy) return NaN
  const [d, m, y] = ddmmyyyy.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1).getTime()
}

/**
 * mfapi.in returns NAV history newest-first. Anchors on the point closest to
 * 5 years back (or the oldest available if the fund is younger) and annualises.
 * Returns null when the data is too thin or the result is implausible.
 */
export function computeFiveYearCAGR(rows: NavRow[]): number | null {
  if (!Array.isArray(rows) || rows.length < 2) return null

  const latestNav = parseFloat(rows[0]?.nav)
  const latestT = toTime(rows[0]?.date)
  if (!(latestNav > 0) || !Number.isFinite(latestT)) return null

  const targetT = latestT - 5 * YEAR_MS
  let anchor: NavRow | undefined
  for (const row of rows) {
    if (toTime(row.date) <= targetT) {
      anchor = row
      break
    }
  }
  if (!anchor) anchor = rows[rows.length - 1]

  const anchorNav = parseFloat(anchor.nav)
  const years = (latestT - toTime(anchor.date)) / YEAR_MS
  if (!(anchorNav > 0) || years < 1) return null

  const cagr = Math.pow(latestNav / anchorNav, 1 / years) - 1
  if (!Number.isFinite(cagr) || cagr < -0.9 || cagr > 1.5) return null
  return cagr
}

// ── Cache ──────────────────────────────────────────────────────────────────

function readCache(code: string): number | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(cacheKey(code))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { cagr: number; ts: number }
    if (typeof parsed.cagr !== 'number' || !Number.isFinite(parsed.cagr)) return null
    if (Date.now() - parsed.ts > TTL_MS) return null
    return parsed.cagr
  } catch {
    return null
  }
}

function writeCache(code: string, cagr: number): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(cacheKey(code), JSON.stringify({ cagr, ts: Date.now() }))
  } catch {
    // storage full / disabled — projection still works off the live value
  }
}

// ── Category inference ──────────────────────────────────────────────────────

const CATEGORY_MATCHERS: [RegExp, string][] = [
  [/small\s*cap/i, 'small_cap'],
  [/mid\s*cap/i, 'mid_cap'],
  [/flexi\s*cap|multi\s*cap/i, 'flexi_cap'],
  [/elss|tax\s*saver|long\s*term\s*equity/i, 'elss'],
  [/hybrid|balanced|asset\s*alloc(?:ation)?|equity\s*savings/i, 'aggressive_hybrid'],
]

/** Best-effort category key from a scheme name, for CAGR fallbacks + labels. */
export function inferCategory(schemeName: string | undefined | null): string {
  if (!schemeName) return 'flexi_cap'
  for (const [re, cat] of CATEGORY_MATCHERS) {
    if (re.test(schemeName)) return cat
  }
  return 'flexi_cap'
}

export const CATEGORY_LABELS: Record<string, string> = {
  flexi_cap: 'Flexi cap',
  mid_cap: 'Mid cap',
  small_cap: 'Small cap',
  elss: 'ELSS',
  aggressive_hybrid: 'Hybrid',
}
