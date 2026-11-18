'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { pendingUnitContributions } from '@/lib/assetValuation'
import type { Asset } from '@/types'
import {
  projectPortfolio, SCENARIO_CAGR_OFFSETS,
  type MFScenario, type ProjectionFund,
} from '@/lib/mfProjection'
import { getCAGR, inferCategory, CATEGORY_LABELS } from '@/services/mfCAGR'
import { CARD, Chevron, EYEBROW, Toggle, cpt, maskWith, rs } from './nwUi'

// ── Config ────────────────────────────────────────────────────────────────────

const HORIZONS = [5, 10, 15, 20] as const
const DEFAULT_SIP = 5000
const PREFS_KEY = 'mf_proj_prefs'
const DEBOUNCE_MS = 150

const SCENARIO_LABEL: Record<MFScenario, string> = { conservative: 'Conservative', base: 'Base case', optimistic: 'Optimistic' }

interface FundPref { sip: number; active: boolean }
interface Prefs {
  scenario: MFScenario
  horizon: number
  stepUp: number
  funds: Record<string, FundPref>
}

const DEFAULT_PREFS: Prefs = { scenario: 'base', horizon: 10, stepUp: 10, funds: {} }

// ── Helpers ───────────────────────────────────────────────────────────────────

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

function loadPrefs(): Prefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return {
      scenario: parsed.scenario ?? DEFAULT_PREFS.scenario,
      horizon: HORIZONS.includes(parsed.horizon as 5) ? (parsed.horizon as number) : DEFAULT_PREFS.horizon,
      stepUp: typeof parsed.stepUp === 'number' ? Math.min(20, Math.max(0, parsed.stepUp)) : DEFAULT_PREFS.stepUp,
      funds: parsed.funds ?? {},
    }
  } catch {
    return DEFAULT_PREFS
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  assets: Asset[]
  masked: boolean
}

export default function MutualFundProjection({ assets, masked }: Props) {
  const mfAssets = useMemo(() => assets.filter(a => a.kind === 'mutual_fund'), [assets])
  const M = maskWith(masked)

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [expanded, setExpanded] = useState(false)
  const [cagrByFund, setCagrByFund] = useState<Record<string, number>>({})
  const [navByCode, setNavByCode] = useState<Record<string, number>>({})
  const skipPersist = useRef(true)

  // Hydrate saved prefs once, client-side.
  useEffect(() => {
    setPrefs(loadPrefs())
  }, [])

  // Persist prefs on change (skips the initial render so we don't clobber
  // saved prefs with defaults before hydration lands).
  useEffect(() => {
    if (skipPersist.current) { skipPersist.current = false; return }
    if (typeof window === 'undefined') return
    try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch {}
  }, [prefs])

  // Live NAVs (for current corpus) via the app's existing proxy.
  useEffect(() => {
    const codes = mfAssets.map(a => a.schemeCode).filter(Boolean) as string[]
    if (codes.length === 0) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/market/mf/nav?codes=${encodeURIComponent(codes.join(','))}`)
        const d = await r.json()
        if (cancelled) return
        const map: Record<string, number> = {}
        for (const [code, v] of Object.entries(d.nav ?? {})) {
          const nav = (v as { nav?: number }).nav
          if (typeof nav === 'number' && nav > 0) map[code] = nav
        }
        setNavByCode(map)
      } catch { /* fall back to invested amount */ }
    })()
    return () => { cancelled = true }
  }, [mfAssets])

  // Base CAGR per fund from AMFI history (cached 24h in the service).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const entries = await Promise.all(
        mfAssets.map(async a => {
          const category = inferCategory(a.name)
          const cagr = await getCAGR(a.schemeCode ?? '', category)
          return [a.id, cagr] as const
        }),
      )
      if (!cancelled) setCagrByFund(Object.fromEntries(entries))
    })()
    return () => { cancelled = true }
  }, [mfAssets])

  // Continuous inputs (sliders) are debounced; taps (scenario/horizon) are not.
  const debouncedFundPrefs = useDebounced(prefs.funds, DEBOUNCE_MS)
  const debouncedStepUp = useDebounced(prefs.stepUp, DEBOUNCE_MS)

  const projectionFunds: ProjectionFund[] = useMemo(() => mfAssets.map(a => {
    const pref = debouncedFundPrefs[a.id]
    const nav = a.schemeCode ? navByCode[a.schemeCode] : undefined
    const existingCorpus = nav && a.units ? nav * a.units + pendingUnitContributions(a).amount : (a.investedAmount ?? a.value)
    return {
      id: a.id,
      name: a.name,
      category: inferCategory(a.name),
      existingCorpus: Math.max(0, existingCorpus),
      monthlySIP: pref?.sip ?? DEFAULT_SIP,
      isActive: pref?.active ?? true,
      cagrOverride: cagrByFund[a.id],
    }
  }), [mfAssets, debouncedFundPrefs, navByCode, cagrByFund])

  const result = useMemo(() => projectPortfolio({
    funds: projectionFunds,
    horizon: prefs.horizon,
    scenario: prefs.scenario,
    annualStepUpPercent: debouncedStepUp,
    scenarioCAGROffsets: SCENARIO_CAGR_OFFSETS,
  }), [projectionFunds, prefs.horizon, prefs.scenario, debouncedStepUp])

  if (mfAssets.length === 0) return null

  const { summary, yearByYear } = result

  const setFundPref = (id: string, patch: Partial<FundPref>) => {
    setPrefs(p => {
      const current = p.funds[id] ?? { sip: DEFAULT_SIP, active: true }
      return { ...p, funds: { ...p.funds, [id]: { ...current, ...patch } } }
    })
  }

  // Chart in a 600×200 box: projected corpus (area + line) over money put in (dashed)
  const H = Math.max(1, yearByYear.length - 1)
  const top = Math.max(...yearByYear.map(p => p.corpus), 1) * 1.06
  const X = (i: number) => ((i / H) * 600).toFixed(1)
  const Y = (v: number) => (200 - (v / top) * 190).toFixed(1)
  const line = 'M' + yearByYear.map((p, i) => `${X(i)},${Y(p.corpus)}`).join(' L')
  const invLine = 'M' + yearByYear.map((p, i) => `${X(i)},${Y(p.invested)}`).join(' L')

  const kpis = [
    { label: 'PROJECTED CORPUS', val: M(cpt(summary.totalCorpus)), sub: `in ${prefs.horizon} years`, color: 'var(--text)' },
    { label: 'YOUR GAIN', val: M(cpt(summary.totalGain)), sub: `on ${M(cpt(summary.totalInvested))} invested`, color: 'var(--good-ink)' },
    { label: 'POST-TAX (EST.)', val: M(cpt(summary.postTaxCorpus)), sub: 'after LTCG @ 12.5%', color: 'var(--text)' },
  ]

  return (
    <div style={{ ...CARD, overflow: 'hidden' }}>
      <button
        type="button" onClick={() => setExpanded(v => !v)} aria-expanded={expanded}
        style={{ width: '100%', padding: 18, display: 'flex', flexDirection: 'column', gap: 14, border: 'none', background: 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%' }}>
          <div>
            <div style={EYEBROW}>WEALTH PROJECTION</div>
            <div style={{ fontSize: 14.5, fontWeight: 600, marginTop: 4 }}>Mutual funds · {SCENARIO_LABEL[prefs.scenario].toLowerCase()} · {prefs.horizon} yrs</div>
          </div>
          <Chevron open={expanded} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, width: '100%' }}>
          {kpis.map(k => (
            <div key={k.label} style={{ padding: '11px 12px', borderRadius: 14, background: 'var(--surface-2)', minWidth: 0 }}>
              <div className="nw-mono" style={{ fontSize: 9, letterSpacing: '.1em', color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.label}</div>
              <div className="nw-num" style={{ fontSize: 17, fontWeight: 700, marginTop: 5, color: k.color }}>{k.val}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.3 }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </button>

      {expanded && (
        <div style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: 16, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            <div role="radiogroup" aria-label="Scenario" style={{ display: 'flex', padding: 3, borderRadius: 11, background: 'var(--surface-3)', gap: 2 }}>
              {(Object.keys(SCENARIO_LABEL) as MFScenario[]).map(k => {
                const on = prefs.scenario === k
                return (
                  <button key={k} type="button" role="radio" aria-checked={on} onClick={() => setPrefs(p => ({ ...p, scenario: k }))}
                    style={{ height: 30, padding: '0 11px', borderRadius: 8, border: 'none', display: 'flex', alignItems: 'center', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: on ? 'var(--surface)' : 'transparent', boxShadow: on ? 'var(--elev)' : 'none', color: on ? 'var(--text)' : 'var(--text-3)' }}>
                    {SCENARIO_LABEL[k]}
                  </button>
                )
              })}
            </div>
            <div role="radiogroup" aria-label="Years" style={{ display: 'flex', gap: 4 }}>
              {HORIZONS.map(y => {
                const on = prefs.horizon === y
                return (
                  <button key={y} type="button" role="radio" aria-checked={on} onClick={() => setPrefs(p => ({ ...p, horizon: y }))} className="nw-mono"
                    style={{ height: 30, padding: '0 10px', borderRadius: 999, border: 'none', display: 'flex', alignItems: 'center', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: on ? 'var(--brand)' : 'var(--surface-2)', color: on ? '#fff' : 'var(--text-2)' }}>
                    {y} YR
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="nw-mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-3)' }}>
              <span>{M(cpt(top))}</span>
              <span style={{ display: 'flex', gap: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 2.5, background: 'var(--brand)', borderRadius: 2 }} />Projected</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, borderTop: '1.5px dashed var(--text-3)' }} />Total invested</span>
              </span>
            </div>
            <svg viewBox="0 0 600 200" preserveAspectRatio="none" role="img" aria-label="Projected corpus over the years" style={{ width: '100%', height: 170, display: 'block', overflow: 'visible' }}>
              <defs>
                <linearGradient id="nwProjGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" style={{ stopColor: 'var(--brand)', stopOpacity: 0.32 }} />
                  <stop offset="1" style={{ stopColor: 'var(--brand)', stopOpacity: 0 }} />
                </linearGradient>
              </defs>
              <path d={`${line} L600,200 L0,200 Z`} fill="url(#nwProjGrad)" />
              <path d={invLine} style={{ fill: 'none', stroke: 'var(--text-3)', strokeWidth: 1.5, strokeDasharray: '5 5', vectorEffect: 'non-scaling-stroke' }} />
              <path key={`${prefs.scenario}-${prefs.horizon}`} d={line} pathLength={1} className="nw-draw" style={{ fill: 'none', stroke: 'var(--brand)', strokeWidth: 2.5, vectorEffect: 'non-scaling-stroke' }} />
            </svg>
            <div className="nw-mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-3)' }}>
              <span>TODAY</span><span>{new Date().getFullYear() + prefs.horizon}</span>
            </div>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>Annual SIP step-up</span>
              <span className="nw-num" style={{ fontWeight: 700, color: 'var(--brand-ink)' }}>{prefs.stepUp}% / yr</span>
            </span>
            <input type="range" min={0} max={20} step={1} value={prefs.stepUp} className="nw-range"
              onChange={e => setPrefs(p => ({ ...p, stepUp: Number(e.target.value) }))} />
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mfAssets.map(a => {
              const pref = prefs.funds[a.id]
              const active = pref?.active ?? true
              const sip = pref?.sip ?? DEFAULT_SIP
              const cagr = cagrByFund[a.id]
              const op = active ? 1 : 0.45
              return (
                <div key={a.id} style={{ padding: '12px 14px', borderRadius: 15, background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0, opacity: op }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3, textWrap: 'pretty' } as React.CSSProperties}>{a.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>
                        {CATEGORY_LABELS[inferCategory(a.name)] ?? 'Equity'} · 5-yr CAGR {cagr != null ? `${(cagr * 100).toFixed(1)}%` : '…'} (AMFI)
                      </div>
                    </div>
                    <Toggle on={active} onClick={() => setFundPref(a.id, { active: !active })} label={`Include ${a.name}`} />
                  </div>
                  <label style={{ opacity: op, display: 'block' }}>
                    <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'var(--text-3)' }}>SIP / month</span>
                      <span className="nw-num" style={{ fontWeight: 700 }}>{M(rs(sip))}</span>
                    </span>
                    <input type="range" min={0} max={100000} step={500} value={sip} disabled={!active} className="nw-range" style={{ marginTop: 4 }}
                      onChange={e => setFundPref(a.id, { sip: Number(e.target.value) })} />
                  </label>
                </div>
              )
            })}
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.45, textWrap: 'pretty' } as React.CSSProperties}>
            Projection, not a promise. Each fund grows at its past 5-year CAGR, adjusted for the scenario; past returns are no guarantee.
          </div>
        </div>
      )}
    </div>
  )
}
