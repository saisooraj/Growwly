'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { fiTargetAt, growth, projectPath, SCENARIO_KEYS, sipForMonth, type FireAssumptions, type FireResult, type PlanInput, type ScenarioKey } from '@/lib/fire'
import { CARD, fmtAxis, fmtShort, fmtFull, MONO, SCENARIO_META, SectionHead, Tip, TIPS } from './shared'

interface Props {
  input: PlanInput
  assumptions: FireAssumptions
  results: Record<ScenarioKey, FireResult>
  scenario: ScenarioKey
  masked: boolean
}

type Mode = 'future' | 'today'
const STEP = 6 // months between plotted points

export default function ProjectionChart({ input, assumptions: a, results, scenario, masked }: Props) {
  const [mode, setMode] = useState<Mode>('future')
  const [hov, setHov] = useState<number | null>(null) // whole years from now
  const wrapRef = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(720)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const narrow = W < 560
  const H = narrow ? 230 : 300
  const ML = narrow ? 44 : 58, MR = narrow ? 12 : 104, MT = 24, MB = 26
  const PW = W - ML - MR, PH = H - MT - MB
  const today = mode === 'today'
  const hasAge = input.age != null
  const sel = results[scenario]
  const fiM = sel.status === 'reached' ? sel.months : null

  // Show the selected scenario reaching FI plus five years (at least 12, at most to age 100)
  const maxYears = Math.max(12, Math.floor(input.horizonMonths / 12))
  const Y = Math.min(maxYears, Math.max(12, fiM != null ? Math.ceil(fiM / 12) + 5 : 30))

  const series = useMemo(() => {
    const months = Y * 12
    const defl = (m: number) => (today ? growth(a.inflation, m) : 1)
    const paths = Object.fromEntries(SCENARIO_KEYS.map(k => [k, projectPath({
      start: input.portfolio, startSip: input.monthlySip, stepUp: a.stepUp, annualReturn: a.returns[k], months,
    }).balance])) as Record<ScenarioKey, number[]>
    const pts: { m: number; v: Record<ScenarioKey, number>; target: number }[] = []
    for (let m = 0; m <= months; m += STEP) {
      pts.push({
        m,
        v: Object.fromEntries(SCENARIO_KEYS.map(k => [k, paths[k][m] / defl(m)])) as Record<ScenarioKey, number>,
        target: fiTargetAt(input.spend, a, a.withdrawalRates[scenario], m) / defl(m),
      })
    }
    return pts
  }, [input, a, Y, today, scenario])

  let ymax = 1
  for (const p of series) ymax = Math.max(ymax, p.target, ...SCENARIO_KEYS.map(k => p.v[k]))
  const raw = (ymax * 1.06) / 4
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map(x => x * mag).find(x => x >= raw) ?? raw
  const top = step * Math.ceil((ymax * 1.06) / step)

  const X = (m: number) => ML + (m / (Y * 12)) * PW
  const Yp = (v: number) => MT + PH - (Math.max(0, Math.min(v, top)) / top) * PH
  const path = (f: (p: (typeof series)[number]) => number) => series.map((p, i) => `${i ? 'L' : 'M'}${X(p.m).toFixed(1)} ${Yp(f(p)).toFixed(1)}`).join('')

  const ticks: number[] = []
  for (let v = 0; v <= top + 1; v += step) ticks.push(v)
  const xStep = narrow ? 5 : Y > 24 ? 5 : 2
  const xTicks: number[] = []
  for (let k = 0; k <= Y; k += xStep) xTicks.push(k)
  const xLabel = (k: number) => hasAge ? String(Math.floor(input.age! + k)) : String(input.startYear + k)

  // End labels on the right, nudged apart so they never overlap
  const last = series[series.length - 1]
  const ends = narrow ? [] : (() => {
    const it = [
      ...SCENARIO_KEYS.map(k => ({ y: Yp(last.v[k]), label: SCENARIO_META[k].label, sel: k === scenario })),
      { y: Yp(last.target), label: today ? 'Target (flat)' : 'FI target', sel: false },
    ].sort((p, q) => p.y - q.y)
    for (let i = 1; i < it.length; i++) it[i].y = Math.max(it[i].y, it[i - 1].y + 16)
    const over = it[it.length - 1].y - (MT + PH)
    if (over > 0) it.forEach(e => { e.y -= over })
    return it
  })()

  const fiX = fiM != null && fiM <= Y * 12 ? X(fiM) : null
  const fiLabel = fiM != null ? `FI · ${hasAge && sel.retirementAge != null ? `age ${Math.floor(sel.retirementAge)}` : sel.retirementYear}` : ''

  // Hover: snap to whole years
  const hk = hov != null ? Math.min(hov, Y) : null
  const hm = hk != null ? hk * 12 : null
  const hp = hm != null ? series.find(p => p.m === hm) ?? null : null
  const hx = hm != null ? X(hm) : 0
  const sipThatYear = hk != null
    ? sipForMonth(input.monthlySip, a.stepUp, hk * 12 + 1) / (today ? growth(a.inflation, hk * 12) : 1)
    : 0
  const onMove = (clientX: number, rect: DOMRect) => {
    const fr = (clientX - rect.left) / rect.width
    setHov(Math.max(0, Math.min(Y, Math.round(fr * Y))))
  }

  const lineW = (k: ScenarioKey) => (k === scenario ? 3 : 1.75)
  const order = SCENARIO_KEYS.filter(k => k !== scenario).concat(scenario) // selected drawn last, on top
  const inf = +(a.inflation * 100).toFixed(2)
  const stepPct = +(a.stepUp * 100).toFixed(2)

  return (
    <section id="fire-projection" className="card fire-anchor" style={{ ...CARD, gap: 14 }}>
      <SectionHead
        title="Portfolio projection" kind="projection"
        right={
          <div role="radiogroup" aria-label="Units" style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--surface-2)', borderRadius: 10 }}>
            {([['future', 'Future ₹'], ['today', 'Today’s ₹']] as const).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => setMode(k)}
                style={{
                  border: 0, cursor: 'pointer', minHeight: 36, padding: '0 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                  background: mode === k ? 'var(--surface)' : 'transparent', color: mode === k ? 'var(--text)' : 'var(--text-2)',
                  boxShadow: mode === k ? 'var(--elev)' : 'none',
                }}>
                {l}
              </button>
            ))}
          </div>
        }
      />

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
        {SCENARIO_KEYS.map(k => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text-2)', fontWeight: k === scenario ? 700 : 500 }}>
            <span style={{ width: 20, borderTop: `${k === scenario ? 3 : 2}px solid ${SCENARIO_META[k].color}` }} />
            {SCENARIO_META[k].label}{k === scenario ? ' · selected' : ''}
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text-2)' }}>
          <span style={{ width: 20, borderTop: '1.5px dashed var(--text-2)' }} />{today ? 'FI target (flat in today’s ₹)' : 'FI target'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text-2)' }}>
          <span style={{ width: 20, borderTop: '1px dotted var(--text)' }} />FI date
        </span>
      </div>

      <div ref={wrapRef} style={{ position: 'relative', height: H, userSelect: 'none', WebkitUserSelect: 'none' }}>
        <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }} aria-hidden>
          <path d={ticks.map(v => `M${ML} ${Yp(v).toFixed(1)}H${ML + PW}`).join('')} style={{ stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '3 4', fill: 'none' }} />
          <path d={`M${ML} ${MT + PH}H${ML + PW}`} style={{ stroke: 'var(--border-strong)', strokeWidth: 1, fill: 'none' }} />
          <path d={`${path(p => p.v[scenario])}L${X(Y * 12).toFixed(1)} ${Yp(0)}L${ML} ${Yp(0)}Z`} style={{ fill: SCENARIO_META[scenario].color, fillOpacity: 0.09, stroke: 'none' }} />
          <path d={path(p => p.target)} style={{ fill: 'none', stroke: 'var(--text-2)', strokeWidth: 1.5, strokeDasharray: '6 5' }} />
          {order.map(k => (
            <path key={k} d={path(p => p.v[k])} style={{
              fill: 'none', stroke: SCENARIO_META[k].color, strokeWidth: lineW(k), opacity: k === scenario ? 1 : 0.62,
              strokeLinejoin: 'round', strokeLinecap: 'round',
            }} />
          ))}
          {fiX != null && <path d={`M${fiX.toFixed(1)} ${MT}V${MT + PH}`} style={{ stroke: 'var(--text)', strokeWidth: 1, strokeDasharray: '2 3', fill: 'none' }} />}
          {hp && <path d={`M${hx.toFixed(1)} ${MT}V${MT + PH}`} style={{ stroke: 'var(--text-3)', strokeWidth: 1, fill: 'none' }} />}
        </svg>

        {ticks.map(v => (
          <span key={v} style={{ position: 'absolute', left: 0, top: Yp(v), transform: 'translateY(-50%)', font: `500 11px/1 ${MONO}`, color: 'var(--text-3)' }}>
            {masked && v !== 0 ? '•••' : fmtAxis(v)}
          </span>
        ))}
        {xTicks.map(k => (
          <span key={k} style={{ position: 'absolute', left: X(k * 12), bottom: 2, transform: 'translateX(-50%)', font: `500 11px/1 ${MONO}`, color: 'var(--text-3)' }}>
            {xLabel(k)}
          </span>
        ))}
        {ends.map(e => (
          <span key={e.label} style={{ position: 'absolute', left: X(Y * 12) + 8, top: e.y, transform: 'translateY(-50%)', fontSize: 12, fontWeight: e.sel ? 700 : 500, color: e.sel ? 'var(--text)' : 'var(--text-2)', whiteSpace: 'nowrap' }}>
            {e.label}
          </span>
        ))}
        {fiX != null && (
          <span style={{ position: 'absolute', left: fiX, top: 0, transform: 'translate(-50%, -30%)', fontSize: 11.5, fontWeight: 700, color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 999, padding: '3px 8px', whiteSpace: 'nowrap' }}>
            {fiLabel}
          </span>
        )}
        {hp && [...SCENARIO_KEYS.map(k => ({ k, v: hp.v[k], c: SCENARIO_META[k].color })), { k: 'target', v: hp.target, c: 'var(--text-2)' }].map(d => (
          <span key={d.k} style={{ position: 'absolute', left: hx, top: Yp(d.v), width: 9, height: 9, margin: '-6.5px 0 0 -6.5px', borderRadius: '50%', background: 'var(--surface)', border: `2px solid ${d.c}`, pointerEvents: 'none' }} />
        ))}

        <div
          onMouseMove={e => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
          onMouseLeave={() => setHov(null)}
          onTouchStart={e => onMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
          onTouchMove={e => onMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
          style={{ position: 'absolute', top: 0, bottom: 0, left: ML, width: PW, cursor: 'crosshair', touchAction: 'pan-y' }}
        />

        {hp && hk != null && (
          <div style={{
            position: 'absolute', top: 28, left: hx, transform: hx > W * 0.55 ? 'translateX(calc(-100% - 14px))' : 'translateX(14px)',
            width: 220, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--elev-lg)',
            padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, pointerEvents: 'none', zIndex: 3,
          }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>
              {input.startYear + hk}{hasAge ? ` · age ${Math.floor(input.age! + hk)}` : hk === 0 ? ' · now' : ` · in ${hk} yrs`}
            </div>
            {[...SCENARIO_KEYS].reverse().map(k => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-2)' }}>
                <span style={{ width: 12, borderTop: `${k === scenario ? 3 : 2}px solid ${SCENARIO_META[k].color}` }} />
                <span style={{ flex: 1, fontWeight: k === scenario ? 700 : 500 }}>{SCENARIO_META[k].label}</span>
                <span style={{ color: 'var(--text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtShort(hp.v[k], masked)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-2)' }}>
              <span style={{ width: 12, borderTop: '1.5px dashed var(--text-2)' }} />
              <span style={{ flex: 1 }}>FI target</span>
              <span style={{ color: 'var(--text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtShort(hp.target, masked)}</span>
            </div>
            <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-2)' }}>
              <span>Monthly SIP that year</span>
              <span style={{ color: 'var(--text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtFull(sipThatYear, masked)}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {hk === 0 ? 'Your SIP today' : stepPct > 0 ? `After ${hk} step-up${hk > 1 ? 's' : ''} of ${stepPct}%` : 'No yearly step-up'}{today ? ' · in today’s ₹' : ''}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5, background: 'var(--surface-2)', borderRadius: 12, padding: '10px 12px' }}>
        <span style={{ flex: 1 }}>
          {today
            ? `Today’s ₹ — every value has ${inf}% inflation taken out, so you can compare with prices now. The target line is flat because it’s already in today’s money; your portfolio climbs more slowly, but it crosses at the same date.`
            : `Future ₹ — the amounts your statements will actually show. The dashed target rises ${inf}% a year with inflation, so the finish line moves while you run toward it.${masked ? ' Amounts are hidden; the shape of each line is still accurate.' : ''}`}
          {' '}Real markets won’t move in smooth lines like these.
        </span>
        <span style={{ color: 'var(--text-3)', display: 'inline-flex', marginTop: 4 }}><Tip tip={TIPS.money} /></span>
      </div>
    </section>
  )
}
