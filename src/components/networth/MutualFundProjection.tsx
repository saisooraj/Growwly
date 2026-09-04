'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, Info, Wallet } from 'lucide-react'
import type { Asset } from '@/types'
import {
  projectPortfolio, SCENARIO_CAGR_OFFSETS,
  type MFScenario, type ProjectionFund,
} from '@/lib/mfProjection'
import { getCAGR, inferCategory, CATEGORY_LABELS } from '@/services/mfCAGR'

// ── Config ────────────────────────────────────────────────────────────────────

const HORIZONS = [5, 10, 15, 20] as const
const DEFAULT_SIP = 5000
const PREFS_KEY = 'mf_proj_prefs'
const DEBOUNCE_MS = 150

const SCENARIO_META: Record<MFScenario, { label: string; soft: string; ink: string; border: string }> = {
  conservative: { label: 'Conservative', soft: 'var(--bad-soft)',  ink: 'var(--bad-ink)',  border: 'var(--bad)' },
  base:         { label: 'Base case',    soft: 'var(--good-soft)', ink: 'var(--good-ink)', border: 'var(--good)' },
  optimistic:   { label: 'Optimistic',   soft: 'var(--info-soft)', ink: 'var(--info-ink)', border: 'var(--info)' },
}

interface FundPref { sip: number; active: boolean }
interface Prefs {
  scenario: MFScenario
  horizon: number
  stepUp: number
  funds: Record<string, FundPref>
}

const DEFAULT_PREFS: Prefs = { scenario: 'base', horizon: 10, stepUp: 10, funds: {} }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBig(v: number, masked: boolean): string {
  if (masked) return '₹ •••'
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(0)}K`
  return `₹${Math.round(v)}`
}

function fmtSip(v: number): string {
  return v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`
}

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

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
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
    const existingCorpus = nav && a.units ? nav * a.units : (a.investedAmount ?? a.value)
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
  const chartData = yearByYear.map(p => ({
    label: p.year === 0 ? 'Now' : `Yr ${p.year}`,
    invested: p.invested,
    corpus: p.corpus,
  }))

  const setFundPref = (id: string, patch: Partial<FundPref>) => {
    setPrefs(p => {
      const current = p.funds[id] ?? { sip: DEFAULT_SIP, active: true }
      return { ...p, funds: { ...p.funds, [id]: { ...current, ...patch } } }
    })
  }

  const sc = SCENARIO_META[prefs.scenario]

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Wealth projection</h2>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0' }}>
            If you keep investing at these rates
          </p>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-4)', whiteSpace: 'nowrap' }}>
          <Info size={12} /> AMFI 5-yr CAGR
        </span>
      </div>

      {/* Scenario selector */}
      <div style={{ display: 'flex', gap: 6, background: 'var(--surface-2)', padding: 4, borderRadius: 12 }}>
        {(Object.keys(SCENARIO_META) as MFScenario[]).map(key => {
          const m = SCENARIO_META[key]
          const active = prefs.scenario === key
          return (
            <button
              key={key}
              onClick={() => setPrefs(p => ({ ...p, scenario: key }))}
              style={{
                flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                borderRadius: 9, border: '1px solid',
                borderColor: active ? m.border : 'transparent',
                background: active ? m.soft : 'transparent',
                color: active ? m.ink : 'var(--text-3)',
                transition: 'all .15s ease',
              }}
            >
              {m.label}
            </button>
          )
        })}
      </div>

      {/* Horizon selector */}
      <div style={{ display: 'flex', gap: 5 }}>
        {HORIZONS.map(y => {
          const active = prefs.horizon === y
          return (
            <button
              key={y}
              onClick={() => setPrefs(p => ({ ...p, horizon: y }))}
              style={{
                flex: 1, padding: '6px 0', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                borderRadius: 8, border: '1px solid var(--border)',
                background: active ? 'var(--text)' : 'var(--surface-2)',
                color: active ? 'var(--bg)' : 'var(--text-3)',
                transition: 'all .15s ease',
              }}
            >
              {y} yr
            </button>
          )
        })}
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <KPI
          label="Projected corpus"
          value={fmtBig(summary.totalCorpus, masked)}
          sub={`at ${prefs.horizon} yr · ${sc.label.toLowerCase()}`}
        />
        <KPI
          label="Your gain"
          value={(masked ? '₹ •••' : `+${fmtBig(summary.totalGain, false)}`)}
          valueColor="var(--good-ink)"
          sub={masked ? 'on invested' : `on ${fmtBig(summary.totalInvested, false)} invested`}
        />
        <KPI
          label="Post-tax (est.)"
          value={fmtBig(summary.postTaxCorpus, masked)}
          sub="after LTCG @ 12.5%"
        />
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="mfCorpusGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.24} />
              <stop offset="95%" stopColor="var(--brand)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false}
            tickFormatter={(v: number) => (masked ? '•••' : fmtBig(v, false))}
            width={54}
          />
          <Tooltip content={<ChartTooltip masked={masked} />} cursor={{ stroke: 'var(--border)' }} />
          <Area
            type="monotone" dataKey="corpus" name="Projected"
            stroke="var(--brand)" strokeWidth={2.5} fill="url(#mfCorpusGrad)"
            dot={false} activeDot={{ r: 4 }}
          />
          <Line
            type="monotone" dataKey="invested" name="Invested"
            stroke="var(--text-4)" strokeWidth={1.5} strokeDasharray="4 4"
            dot={false} activeDot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', gap: 14, marginTop: -6 }}>
        <LegendDot color="var(--brand)" label="Projected corpus" />
        <LegendDot color="var(--text-4)" label="Total invested" dashed />
      </div>

      {/* Step-up */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 12 }}>
        <TrendingUp size={15} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: 'var(--text-2)', flex: 1 }}>Annual SIP step-up</span>
        <input
          type="range" min={0} max={20} step={1} value={prefs.stepUp}
          onChange={e => setPrefs(p => ({ ...p, stepUp: Number(e.target.value) }))}
          style={{ flex: 1, maxWidth: 120, accentColor: 'var(--brand)' }}
        />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', minWidth: 52, textAlign: 'right' }}>
          {prefs.stepUp === 0 ? 'None' : `+${prefs.stepUp}%/yr`}
        </span>
      </div>

      {/* Per-fund assumptions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>Your funds &amp; assumptions</span>
        {mfAssets.map(a => {
          const pref = prefs.funds[a.id]
          const active = pref?.active ?? true
          const sip = pref?.sip ?? DEFAULT_SIP
          const category = inferCategory(a.name)
          const cagr = cagrByFund[a.id]
          return (
            <div
              key={a.id}
              style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12,
                padding: '12px 14px', opacity: active ? 1 : 0.6, transition: 'opacity .15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.name}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0 0' }}>
                    {cagr != null ? `${(cagr * 100).toFixed(1)}% CAGR` : 'CAGR…'} · {CATEGORY_LABELS[category] ?? 'Equity'}
                  </p>
                </div>
                <Toggle on={active} onClick={() => setFundPref(a.id, { active: !active })} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)', minWidth: 46 }}>SIP / mo</span>
                <input
                  type="range" min={0} max={100000} step={500} value={sip}
                  disabled={!active}
                  onChange={e => setFundPref(a.id, { sip: Number(e.target.value) })}
                  style={{ flex: 1, accentColor: 'var(--brand)' }}
                />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', minWidth: 40, textAlign: 'right' }}>
                  {active ? fmtSip(sip) : '—'}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footnote */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-3)' }}>
          <Wallet size={13} />
          {masked ? '•••' : `${summary.wealthMultiplier.toFixed(1)}×`} your money
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
          LTCG 12.5% above ₹1.25L gain
        </span>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KPI({ label, value, sub, valueColor }: { label: string; value: string; sub: string; valueColor?: string }) {
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px' }}>
      <p style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 3px' }}>{label}</p>
      <p style={{ fontSize: 17, fontWeight: 700, color: valueColor ?? 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>{value}</p>
      <p style={{ fontSize: 10.5, color: 'var(--text-4)', margin: '2px 0 0' }}>{sub}</p>
    </div>
  )
}

function LegendDot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-3)' }}>
      <span style={{
        width: dashed ? 12 : 8, height: dashed ? 0 : 8,
        borderRadius: dashed ? 0 : '50%',
        borderTop: dashed ? `2px dashed ${color}` : undefined,
        background: dashed ? undefined : color,
        display: 'inline-block',
      }} />
      {label}
    </span>
  )
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      style={{
        position: 'relative', width: 32, height: 18, borderRadius: 999, border: 'none', cursor: 'pointer',
        background: on ? 'var(--brand)' : 'var(--border-strong)', flexShrink: 0, transition: 'background .2s ease', padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? 16 : 2, width: 14, height: 14, borderRadius: '50%',
        background: '#fff', transition: 'left .2s ease',
      }} />
    </button>
  )
}

interface TooltipPoint { label: string; invested: number; corpus: number }

function ChartTooltip({ active, payload, masked }: { active?: boolean; payload?: { payload: TooltipPoint }[]; masked: boolean }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
      padding: '10px 12px', boxShadow: 'var(--elev)', fontSize: 12.5, minWidth: 150,
    }}>
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{d.label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: 'var(--text-3)' }}>
        <span>Corpus</span>
        <span style={{ fontWeight: 700, color: 'var(--brand-ink)' }}>{fmtBig(d.corpus, masked)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: 'var(--text-3)', marginTop: 2 }}>
        <span>Invested</span>
        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{fmtBig(d.invested, masked)}</span>
      </div>
    </div>
  )
}
