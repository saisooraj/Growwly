'use client'

import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { MASK, TONE, dirOf, inr, pctOf, signedPct } from './format'
import { AreaChart, CardState, ChartTitle, PATH, StatGrid, change30, type ChartMark } from './ui'
import { thinGoldHistory, type GoldBuy, type GoldDayPrice } from '@/lib/gold'

const day = (d: string, pattern: string) => { try { return format(parseISO(d), pattern) } catch { return d } }
const gramsText = (g: number) => g.toLocaleString('en-IN', { maximumFractionDigits: 3 })
const note = { marginTop: 6, fontSize: 11.5, color: 'var(--text-3)', textWrap: 'pretty' } as const

// The selected karat's price since the first purchase (or a year), with each buy at the price paid
export default function GoldHistoryChart({ history, loading, error, onRetry, karat, rate, buys, unplotted, masked }: {
  history: GoldDayPrice[] | null
  loading: boolean
  error: boolean
  onRetry: () => void
  karat: 18 | 22 | 24
  rate: number
  buys: GoldBuy[]
  unplotted: number
  masked: boolean
}) {
  const scale = karat / 22
  const shown = useMemo(() => buys.filter(b => b.karat === karat), [buys, karat])
  const thin = useMemo(() => history ? thinGoldHistory(history) : [], [history])

  if (error) {
    return (
      <CardState icon={PATH.offline} bg="var(--bad-soft)" ink="var(--bad-ink)" title="Price history unavailable"
        text="We couldn't load past gold prices." onRetry={onRetry} pad="18px 0 6px" border={false} />
    )
  }
  if (loading || !history) {
    return <div className="mkt-skel" style={{ height: 240, borderRadius: 12, background: 'var(--surface-2)', marginTop: 16 }} />
  }

  const high = history.reduce((best, d) => d.price22k > best.price22k ? d : best)
  const low = history.reduce((best, d) => d.price22k < best.price22k ? d : best)
  const highValue = high.price22k * scale
  const vsHigh = pctOf(rate - highValue, highValue)

  const grams = shown.reduce((s, b) => s + b.grams, 0)
  const paid = shown.reduce((s, b) => s + b.grams * b.pricePerGram, 0)
  const avgPaid = grams > 0 ? paid / grams : null

  // A buy sits on the last trading day up to its date
  const indexOf = (date: string) => {
    for (let i = thin.length - 1; i >= 0; i--) if (thin[i].date <= date) return i
    return 0
  }
  const marks: ChartMark[] = masked ? [] : shown.map(b => ({
    index: indexOf(b.date),
    value: b.pricePerGram,
    color: b.pricePerGram <= rate ? 'var(--good)' : 'var(--bad)',
    label: `Bought ${gramsText(b.grams)} g at ${inr(b.pricePerGram)}/g`,
  }))

  const values = thin.map(d => d.price22k * scale)
  const firstOfficial = history.find(d => !d.estimated)
  const otherBuys = buys.length - shown.length

  return (
    <>
      <div style={{ margin: '18px 0 12px' }}>
        <ChartTitle label={`${karat}K SINCE ${day(history[0].date, 'MMM yyyy').toUpperCase()}`} change={change30(values)} period="overall" />
      </div>
      <AreaChart
        values={values} dates={thin.map(d => day(d.date, 'd MMM yy'))} axisDates={thin.map(d => day(d.date, 'MMM yy'))}
        color="var(--brand)" height={170} gutter={44}
        formatY={v => `₹${(v / 1000).toFixed(1)}K`} formatValue={v => `${inr(v)}/g`}
        avg={rate} avgLabel={`Today ₹${(rate / 1000).toFixed(2)}K`} marks={marks}
      />
      {marks.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 6, fontSize: 12, color: 'var(--text-2)' }}>
          <Legend color="var(--good)" text="Bought below today" />
          <Legend color="var(--bad)" text="Bought above today" />
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <StatGrid cols="repeat(2, minmax(0,1fr))" stats={[
          { label: `High · ${day(high.date, 'd MMM yy')}`, value: inr(highValue) },
          { label: `Low · ${day(low.date, 'd MMM yy')}`, value: inr(low.price22k * scale) },
          { label: 'Today vs high', value: signedPct(vsHigh), ink: TONE[dirOf(vsHigh)].ink },
          { label: `Your avg ${karat}K buy`, value: avgPaid !== null ? (masked ? MASK : `${inr(avgPaid)}/g`) : '—' },
        ]} />
      </div>
      {masked ? (
        <div style={note}>Your purchases are hidden while amounts are private.</div>
      ) : (
        <>
          {shown.length === 0 && <div style={note}>You have no {karat}K purchases to plot.</div>}
          {otherBuys > 0 && <div style={note}>{otherBuys} {otherBuys === 1 ? 'purchase is' : 'purchases are'} in another karat. Switch karat to see {otherBuys === 1 ? 'it' : 'them'}.</div>}
          {unplotted > 0 && <div style={note}>{unplotted} {unplotted === 1 ? 'purchase has' : 'purchases have'} no date or buy price, so {unplotted === 1 ? 'it isn’t' : 'they aren’t'} plotted.</div>}
        </>
      )}
      <div style={note}>
        {firstOfficial ? `IBJA rates from ${day(firstOfficial.date, 'd MMM')}. Earlier prices are estimated from the GOLDBEES gold ETF.` : 'Prices are estimated from the GOLDBEES gold ETF.'}
        {' '}Prices paid can include making charges and GST.
      </div>
    </>
  )
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />{text}
    </span>
  )
}
