'use client'

import { Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { ChevronLeft, ChevronRight, X, TrendingUp, TrendingDown, Minus, Download } from 'lucide-react'
import { IconChartBar, IconTrophy, IconPigMoney, IconCoin } from '@tabler/icons-react'
import { useAppStore } from '@/store/appStore'
import { useAuth } from '@/context/AuthContext'
import { buildMonthlySummary, formatCurrencyFull, downloadJSON, getCycleMonth } from '@/lib/utils'
import { exportAllUserData } from '@/lib/firestore'
import { getCategoryDisplayName } from '@/lib/categoryIcons'
import { format, subMonths, parseISO } from 'date-fns'
import toast from 'react-hot-toast'

const STORAGE_KEY = 'recap_seen_month'

// Stat tile used in slides
function StatTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--surface-2)' }}>
      <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '0 0 5px' }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 800, color, margin: 0, letterSpacing: '-0.02em' }}>{value}</p>
    </div>
  )
}

// Up/down comparison row (e.g. "+12% vs August (₹52,340 avg)") — for spending,
// up is bad (red) and down is good (green).
function TrendRow({ diff, pct, label }: { diff: number; pct: number; label: string }) {
  const color = diff > 0 ? 'var(--bad-ink)' : diff < 0 ? 'var(--good-ink)' : 'var(--text-3)'
  const Icon  = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 12.5, fontWeight: 600 }}>
      <Icon size={14} style={{ color, flexShrink: 0 }} />
      <span style={{ color }}>{diff > 0 ? '+' : ''}{pct}% {label}</span>
    </div>
  )
}

export default function MonthlyRecap() {
  const { transactions, emergencyFund, borrowings, settings } = useAppStore()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [slide, setSlide] = useState(0)
  const [exporting, setExporting] = useState(false)

  const currMonth     = getCycleMonth(settings)
  const prevMonth     = format(subMonths(parseISO(`${currMonth}-01`), 1), 'yyyy-MM')
  const twoMonthsAgo  = format(subMonths(parseISO(`${currMonth}-01`), 2), 'yyyy-MM')
  const prevSummary   = buildMonthlySummary(transactions, prevMonth, settings, borrowings)
  const twoAgoSummary = buildMonthlySummary(transactions, twoMonthsAgo, settings, borrowings)

  useEffect(() => {
    if (transactions.length === 0) return
    const seen = localStorage.getItem(STORAGE_KEY)
    if (seen === currMonth) return
    if (prevSummary.totalExpenses === 0 && prevSummary.totalIncome === 0) return
    setOpen(true)
  }, [transactions])

  function close() { localStorage.setItem(STORAGE_KEY, currMonth); setOpen(false) }

  async function handleExport() {
    if (!user) return
    setExporting(true)
    try {
      const data = await exportAllUserData(user.uid)
      downloadJSON(data, `growwly-backup-${new Date().toISOString().split('T')[0]}.json`)
      toast.success('Data exported successfully')
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const prevLabel  = format(parseISO(`${prevMonth}-01`), 'MMMM yyyy')
  const topCategory = Object.entries(prevSummary.byCategory).sort(([, a], [, b]) => b - a)[0]

  // vs last month (the month right before the recapped one)
  const lastMonthDiff = prevSummary.totalExpenses - twoAgoSummary.totalExpenses
  const lastMonthPct  = twoAgoSummary.totalExpenses > 0
    ? Math.round((lastMonthDiff / twoAgoSummary.totalExpenses) * 100) : null

  // vs trailing average, over however many of the 6 months before that have data
  const trailingExpenses = [3, 4, 5, 6, 7, 8]
    .map(o => buildMonthlySummary(transactions, format(subMonths(parseISO(`${currMonth}-01`), o), 'yyyy-MM'), settings, borrowings))
    .filter(s => s.totalIncome > 0 || s.totalExpenses > 0)
    .map(s => s.totalExpenses)
  const avgExpenses = trailingExpenses.length > 0
    ? trailingExpenses.reduce((a, b) => a + b, 0) / trailingExpenses.length : null
  const avgDiff = avgExpenses !== null ? prevSummary.totalExpenses - avgExpenses : null
  const avgPct  = avgDiff !== null && avgExpenses! > 0
    ? Math.round((avgDiff / avgExpenses!) * 100) : null

  const netSaved = prevSummary.savingsContributed - prevSummary.savingsWithdrawn

  const efPct = emergencyFund
    ? Math.round((emergencyFund.currentBalance / emergencyFund.targetAmount) * 100) : null

  const slides = [
    // Slide 0: Total spent, vs last month, vs average
    <div key="spend" style={{ textAlign: 'center', padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconChartBar size={28} style={{ color: 'var(--brand-ink)' }} stroke={1.5} />
        </div>
      </div>
      <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', margin: 0 }}>{prevLabel} recap</p>
      <div style={{ padding: '14px', borderRadius: 14, background: 'var(--bad-soft)' }}>
        <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '0 0 4px' }}>Total Spent</p>
        <p style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: 'var(--bad-ink)' }}>
          {formatCurrencyFull(prevSummary.totalExpenses)}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lastMonthPct !== null && (
          <TrendRow diff={lastMonthDiff} pct={lastMonthPct} label={`vs ${format(parseISO(`${twoMonthsAgo}-01`), 'MMMM')}`} />
        )}
        {avgPct !== null && avgExpenses !== null && (
          <TrendRow diff={avgDiff!} pct={avgPct} label={`vs your ${trailingExpenses.length}-mo avg (${formatCurrencyFull(Math.round(avgExpenses))})`} />
        )}
      </div>
    </div>,

    // Slide 1: Saved + money in
    <div key="saved" style={{ textAlign: 'center', padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--good-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconPigMoney size={28} style={{ color: 'var(--good-ink)' }} stroke={1.5} />
        </div>
      </div>
      <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Saved</p>
      <div style={{
        padding: '14px', borderRadius: 14,
        background: netSaved >= 0 ? 'var(--good-soft)' : 'var(--bad-soft)',
      }}>
        <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '0 0 4px' }}>Saved</p>
        <p style={{
          fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 4px',
          color: netSaved >= 0 ? 'var(--good-ink)' : 'var(--bad-ink)',
        }}>
          {netSaved >= 0 ? '+' : ''}{formatCurrencyFull(netSaved)}
        </p>
        {prevSummary.savingsWithdrawn > 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            {formatCurrencyFull(prevSummary.savingsContributed)} contributed, {formatCurrencyFull(prevSummary.savingsWithdrawn)} withdrawn
          </p>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            {netSaved > 0 ? 'Moved into savings last month' : 'No savings transfers logged'}
          </p>
        )}
      </div>
      <StatTile label="Money In" value={formatCurrencyFull(prevSummary.totalIncome)} color="var(--good-ink)" />
    </div>,

    // Slide 2: Top category
    <div key="category" style={{ textAlign: 'center', padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--warn-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconTrophy size={28} style={{ color: 'var(--warn-ink)' }} stroke={1.5} />
        </div>
      </div>
      <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Biggest spend</p>
      {topCategory ? (
        <div style={{ padding: '16px', borderRadius: 14, background: 'var(--warn-soft)' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--warn-ink)', margin: '0 0 4px' }}>{getCategoryDisplayName(topCategory[0])}</p>
          <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>{formatCurrencyFull(topCategory[1])}</p>
          {prevSummary.totalExpenses > 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
              {Math.round((topCategory[1] / prevSummary.totalExpenses) * 100)}% of total spending
            </p>
          )}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text-4)' }}>No spending data</p>
      )}
    </div>,

    // Slide 3: Borrowed, repayment received, debt settled + emergency fund
    <div key="money" style={{ textAlign: 'center', padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--info-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconCoin size={28} style={{ color: 'var(--info-ink)' }} stroke={1.5} />
        </div>
      </div>
      <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Borrowing & repayments</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <StatTile label="Borrowed"           value={formatCurrencyFull(prevSummary.totalBorrowed)}     color="var(--bad-ink)"  />
        <StatTile label="Repayment Received" value={formatCurrencyFull(prevSummary.repaymentReceived)} color="var(--good-ink)" />
      </div>
      {prevSummary.repaymentPaid > 0 && (
        <StatTile label="Debt Settled" value={formatCurrencyFull(prevSummary.repaymentPaid)} color="var(--info-ink)" />
      )}
      {emergencyFund && efPct !== null && (
        <div style={{ padding: '14px', borderRadius: 14, background: 'var(--surface-2)' }}>
          <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '0 0 10px' }}>Emergency Fund</p>
          <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: '100%', width: `${Math.min(efPct, 100)}%`, borderRadius: 999,
              background: efPct >= 100 ? 'var(--good)' : efPct >= 50 ? 'var(--brand)' : 'var(--warn)',
              transition: 'width .6s ease',
            }} />
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '0 0 2px' }}>{efPct}% of target</p>
          <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: 0 }}>
            {formatCurrencyFull(emergencyFund.currentBalance)} / {formatCurrencyFull(emergencyFund.targetAmount)}
          </p>
        </div>
      )}
    </div>,
  ]

  const btnBase: React.CSSProperties = {
    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background .15s',
  }

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" style={{ position: 'relative', zIndex: 50 }} onClose={close}>
        <Transition.Child as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,6,20,.5)', backdropFilter: 'blur(4px)' }} />
        </Transition.Child>

        <div style={{ position: 'fixed', inset: 0, overflowY: 'auto' }}>
          <div style={{ display: 'flex', minHeight: '100%', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <Transition.Child as={Fragment}
              enter="ease-out duration-300" enterFrom="opacity-0 scale-90"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200" leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-90"
            >
              <Dialog.Panel style={{
                width: '100%', maxWidth: 380,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 26, boxShadow: 'var(--elev-lg)', overflow: 'hidden',
              }}>
                {/* Header: dots + close */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {slides.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setSlide(i)}
                        style={{
                          height: 6, borderRadius: 999, border: 'none', cursor: 'pointer',
                          width: i === slide ? 20 : 6,
                          background: i === slide ? 'var(--brand)' : 'var(--surface-3)',
                          transition: 'all .25s cubic-bezier(.22,1,.36,1)',
                        }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={close}
                    style={{ ...btnBase, width: 32, height: 32, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--text-2)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Slide */}
                <div style={{ padding: '0 20px', minHeight: 300 }}>
                  {slides[slide]}
                </div>

                {/* Nav */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
                  <button
                    onClick={() => setSlide(s => Math.max(s - 1, 0))}
                    disabled={slide === 0}
                    style={{ ...btnBase, width: 38, height: 38, borderRadius: 12, background: 'var(--surface-2)', color: 'var(--text-2)', opacity: slide === 0 ? 0.3 : 1 }}
                    onMouseEnter={e => { if (slide > 0) (e.currentTarget.style.background = 'var(--surface-3)') }}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  >
                    <ChevronLeft size={18} />
                  </button>

                  {slide < slides.length - 1 ? (
                    <button
                      onClick={() => setSlide(s => s + 1)}
                      style={{ ...btnBase, padding: '9px 20px', borderRadius: 12, background: 'var(--brand)', color: '#fff', fontSize: 13, fontWeight: 700, gap: 6 }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--brand-deep)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--brand)')}
                    >
                      Next →
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button
                        onClick={handleExport}
                        disabled={exporting}
                        style={{ ...btnBase, width: 38, height: 38, borderRadius: 12, background: 'var(--surface-2)', color: 'var(--text-2)', flexShrink: 0, opacity: exporting ? 0.6 : 1 }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                        title="Export full backup as JSON"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        onClick={close}
                        style={{ ...btnBase, padding: '9px 20px', borderRadius: 12, background: 'var(--brand)', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--brand-deep)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'var(--brand)')}
                      >
                        Start {format(new Date(), 'MMMM')} fresh
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => setSlide(s => Math.min(s + 1, slides.length - 1))}
                    disabled={slide === slides.length - 1}
                    style={{ ...btnBase, width: 38, height: 38, borderRadius: 12, background: 'var(--surface-2)', color: 'var(--text-2)', opacity: slide === slides.length - 1 ? 0.3 : 1 }}
                    onMouseEnter={e => { if (slide < slides.length - 1) (e.currentTarget.style.background = 'var(--surface-3)') }}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
