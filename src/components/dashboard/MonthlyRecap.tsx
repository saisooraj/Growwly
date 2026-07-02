'use client'

import { Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { ChevronLeft, ChevronRight, X, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { IconChartBar, IconTrophy, IconCoin } from '@tabler/icons-react'
import { useAppStore } from '@/store/appStore'
import { buildMonthlySummary, formatCurrencyFull, getLast6Months } from '@/lib/utils'
import { getCategoryDisplayName } from '@/lib/categoryIcons'
import { format, subMonths, parseISO } from 'date-fns'

const STORAGE_KEY = 'recap_seen_month'

function getPrevMonth(): string {
  return format(subMonths(new Date(), 1), 'yyyy-MM')
}

// Stat tile used in slides
function StatTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--surface-2)' }}>
      <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '0 0 5px' }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 800, color, margin: 0, letterSpacing: '-0.02em' }}>{value}</p>
    </div>
  )
}

export default function MonthlyRecap() {
  const { transactions, emergencyFund, borrowings } = useAppStore()
  const [open, setOpen] = useState(false)
  const [slide, setSlide] = useState(0)

  const prevMonth = getPrevMonth()
  const currMonth = format(new Date(), 'yyyy-MM')
  const prevSummary   = buildMonthlySummary(transactions, prevMonth)
  const twoMonthsAgo  = format(subMonths(new Date(), 2), 'yyyy-MM')
  const twoAgoSummary = buildMonthlySummary(transactions, twoMonthsAgo)

  useEffect(() => {
    if (transactions.length === 0) return
    const seen = localStorage.getItem(STORAGE_KEY)
    if (seen === currMonth) return
    if (prevSummary.totalExpenses === 0 && prevSummary.totalIncome === 0) return
    setOpen(true)
  }, [transactions])

  function close() { localStorage.setItem(STORAGE_KEY, currMonth); setOpen(false) }

  const prevLabel  = format(parseISO(`${prevMonth}-01`), 'MMMM yyyy')
  const topCategory = Object.entries(prevSummary.byCategory).sort(([, a], [, b]) => b - a)[0]
  const spendDiff  = prevSummary.totalExpenses - twoAgoSummary.totalExpenses
  const spendPct   = twoAgoSummary.totalExpenses > 0
    ? Math.round((spendDiff / twoAgoSummary.totalExpenses) * 100) : null
  const pendingLent     = borrowings.filter(b => b.type === 'lent'     && b.status !== 'repaid').reduce((s, b) => s + (b.amount - b.repaidAmount), 0)
  const pendingBorrowed = borrowings.filter(b => b.type === 'borrowed' && b.status !== 'repaid').reduce((s, b) => s + (b.amount - b.repaidAmount), 0)
  const efPct = emergencyFund
    ? Math.round((emergencyFund.currentBalance / emergencyFund.targetAmount) * 100) : null

  const slides = [
    // Slide 0: Spending overview
    <div key="spend" style={{ textAlign: 'center', padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconChartBar size={28} style={{ color: 'var(--brand-ink)' }} stroke={1.5} />
        </div>
      </div>
      <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', margin: 0 }}>{prevLabel} recap</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <StatTile label="Total Spent"  value={formatCurrencyFull(prevSummary.totalExpenses)} color="var(--bad-ink)" />
        <StatTile label="Total Income" value={formatCurrencyFull(prevSummary.totalIncome)}   color="var(--good-ink)" />
      </div>
      <div style={{
        padding: '14px', borderRadius: 14,
        background: prevSummary.net >= 0 ? 'var(--good-soft)' : 'var(--bad-soft)',
      }}>
        <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '0 0 4px' }}>Net</p>
        <p style={{
          fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 4px',
          color: prevSummary.net >= 0 ? 'var(--good-ink)' : 'var(--bad-ink)',
        }}>
          {prevSummary.net >= 0 ? '+' : ''}{formatCurrencyFull(prevSummary.net)}
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
          {prevSummary.net >= 0 ? 'You saved money last month' : 'Spending exceeded income'}
        </p>
      </div>
    </div>,

    // Slide 1: Top category + trend
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
      {spendPct !== null && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
          {spendDiff > 0
            ? <TrendingUp size={16} style={{ color: 'var(--bad-ink)' }} />
            : spendDiff < 0
              ? <TrendingDown size={16} style={{ color: 'var(--good-ink)' }} />
              : <Minus size={16} style={{ color: 'var(--text-3)' }} />}
          <span style={{ color: spendDiff > 0 ? 'var(--bad-ink)' : spendDiff < 0 ? 'var(--good-ink)' : 'var(--text-3)' }}>
            {spendDiff > 0 ? '+' : ''}{spendPct}% vs {format(parseISO(`${twoMonthsAgo}-01`), 'MMMM')}
          </span>
        </div>
      )}
    </div>,

    // Slide 2: Borrowings + emergency fund
    <div key="money" style={{ textAlign: 'center', padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--info-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconCoin size={28} style={{ color: 'var(--info-ink)' }} stroke={1.5} />
        </div>
      </div>
      <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Money owed</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <StatTile label="You owe"     value={formatCurrencyFull(pendingBorrowed)} color="var(--bad-ink)"  />
        <StatTile label="Owed to you" value={formatCurrencyFull(pendingLent)}     color="var(--good-ink)" />
      </div>
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
                    <button
                      onClick={close}
                      style={{ ...btnBase, padding: '9px 20px', borderRadius: 12, background: 'var(--brand)', color: '#fff', fontSize: 13, fontWeight: 700 }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--brand-deep)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--brand)')}
                    >
                      Start {format(new Date(), 'MMMM')} fresh
                    </button>
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
