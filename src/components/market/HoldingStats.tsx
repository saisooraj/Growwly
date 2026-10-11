import type { ReactNode } from 'react'

// Shared pieces for showing what the user holds on the market cards

export function rupees(n: number, decimals = 0) {
  const abs = Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return `${n < 0 ? '−' : ''}₹${abs}`
}

export function signedRupees(n: number, decimals = 0) {
  return `${n > 0 ? '+' : ''}${rupees(n, decimals)}`
}

export function signedPct(n: number) {
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(2)}%`
}

const toneColor = (n: number) => n > 0 ? 'var(--good-ink)' : n < 0 ? 'var(--bad-ink)' : 'var(--text-3)'

export function ListTag({ holding }: { holding: boolean }) {
  return holding ? (
    <span className="flex-shrink-0 text-[10px] font-semibold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-full">Holding</span>
  ) : (
    <span className="flex-shrink-0 text-[10px] font-semibold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded-full">Watchlist</span>
  )
}

export interface Stat { label: string; value: ReactNode; change?: number }

// A small grid of label/value pairs; `change` colours the value green or red
export function StatGrid({ stats, cols = 3 }: { stats: Stat[]; cols?: 2 | 3 | 4 }) {
  return (
    <div className="grid gap-x-3 gap-y-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {stats.map(s => (
        <div key={s.label} className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium truncate">{s.label}</p>
          <p className="text-xs font-semibold break-words" style={{ color: s.change === undefined ? 'var(--text)' : toneColor(s.change) }}>
            {s.value}
          </p>
        </div>
      ))}
    </div>
  )
}

// Totals across everything the user holds of one kind
export function HoldingSummary({ title, invested, current, dayChange, note }: {
  title: string
  invested: number
  current: number
  dayChange: number
  note?: ReactNode
}) {
  const gain = current - invested
  const gainPct = invested > 0 ? (gain / invested) * 100 : null
  const prev = current - dayChange
  const dayPct = prev > 0 ? (dayChange / prev) * 100 : null
  return (
    <div className="rounded-xl p-3 space-y-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-slate-500">{title}</p>
          <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>{rupees(current)}</p>
        </div>
        {gainPct !== null && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{
            color: toneColor(gain),
            background: gain > 0 ? 'var(--good-soft)' : gain < 0 ? 'var(--bad-soft)' : 'var(--surface-3)',
          }}>
            {signedPct(gainPct)} overall
          </span>
        )}
      </div>
      <StatGrid stats={[
        { label: 'Invested', value: invested > 0 ? rupees(invested) : '—' },
        { label: 'Total P&L', value: invested > 0 ? signedRupees(gain) : '—', change: invested > 0 ? gain : undefined },
        { label: 'Day change', value: <>{signedRupees(dayChange)}{dayPct !== null && <span className="font-normal"> ({signedPct(dayPct)})</span>}</>, change: dayChange },
      ]} />
      {note && <p className="text-[11px] text-slate-400">{note}</p>}
    </div>
  )
}

export function HiddenHoldingsNote({ count, onRestore }: { count: number; onRestore: () => void }) {
  if (count === 0) return null
  return (
    <p className="text-xs text-slate-400 text-center">
      {count} {count === 1 ? 'holding' : 'holdings'} hidden ·{' '}
      <button onClick={onRestore} className="text-purple-600 font-medium hover:underline">Show again</button>
    </p>
  )
}
