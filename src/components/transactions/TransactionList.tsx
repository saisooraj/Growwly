'use client'

import { useState, useMemo, useEffect } from 'react'
import { format, parseISO, isToday, isYesterday } from 'date-fns'
import { ArrowLeftRight, ChevronDown, ChevronRight, ArrowUp, ArrowDown, UserMinus, UserPlus } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { formatCurrencyFull, CATEGORY_COLORS, getTransactionsForMonth, getTransferDisplay } from '@/lib/utils'
import { getCycleRange } from '@/lib/cycle'
import { getSavingsVehicleMeta, getCategoryDisplayName, CategoryIcon } from '@/lib/categoryIcons'
import type { Transaction, Borrowing } from '@/types'
import TransactionDetailModal from './TransactionDetailModal'

interface Props {
  filterMonth?: boolean
  limit?: number
  transactions?: Transaction[]
  groupByDay?: boolean
  defaultExpandAll?: boolean
  showBorrowings?: boolean
}

// Synthetic row type — Transaction extended with borrowing metadata
type ViewTx = Transaction & { _borrowDir?: 'lent' | 'borrowed'; _person?: string }

// ── Borrowing → synthetic ViewTx ────────────────────────────────────────────

function borrowingToViewTx(b: Borrowing): ViewTx {
  return {
    id: `borrow-${b.id}`,
    userId: b.userId,
    type: b.type === 'lent' ? 'expense' : 'income',
    amount: b.amount,
    category: b.type === 'lent' ? 'Lent' : 'Borrowed',
    date: b.date,
    notes: `${b.type === 'lent' ? 'To' : 'From'} ${b.person}${b.description ? ' · ' + b.description : ''}`,
    createdAt: b.createdAt,
    borrowingId: b.id,
    _borrowDir: b.type as 'lent' | 'borrowed',
    _person: b.person,
  }
}

function dayLabel(dateStr: string): string {
  const d = parseISO(dateStr)
  if (isToday(d))     return `Today · ${format(d, 'MMM d')}`
  if (isYesterday(d)) return `Yesterday · ${format(d, 'MMM d')}`
  return format(d, 'EEE, MMM d')
}

// ── Single transaction row ───────────────────────────────────────────────────

function TxRow({ tx, onSelect }: { tx: ViewTx; onSelect: (t: Transaction) => void }) {
  const isBorrowing = !!tx._borrowDir
  const isTransfer  = tx.type === 'transfer'
  const isIncome    = tx.type === 'income'

  let color: string, icon: React.ReactNode, label: string, amountColor: string, prefix: string

  if (isBorrowing) {
    const isLent = tx._borrowDir === 'lent'
    color       = isLent ? 'var(--warn)' : 'var(--info)'
    icon        = isLent
      ? <UserMinus size={17} style={{ color }} />
      : <UserPlus  size={17} style={{ color }} />
    label       = tx._person ?? (isLent ? 'Lent' : 'Borrowed')
    amountColor = isLent ? 'var(--warn-ink)' : 'var(--info-ink)'
    prefix      = isLent ? '−' : '+'
  } else if (isTransfer) {
    const disp = getTransferDisplay(tx)
    if (disp.isSavings) {
      const vehicle = tx.savingsVehicle || disp.label
      const meta = getSavingsVehicleMeta(vehicle)
      color     = meta.color
      icon      = <meta.Icon size={17} style={{ color }} stroke={1.5} />
      label     = disp.label
    } else {
      color     = 'var(--info)'
      icon      = <ArrowLeftRight size={17} style={{ color }} />
      label     = disp.label
    }
    amountColor = disp.dir === 'in' ? 'var(--good-ink)' : 'var(--text-2)'
    prefix      = disp.dir === 'in' ? '+' : '−'
  } else {
    color       = CATEGORY_COLORS[tx.category] ?? 'var(--text-3)'
    icon        = <CategoryIcon category={tx.category} size={17} color={color} />
    label       = getCategoryDisplayName(tx.category)
    amountColor = isIncome ? 'var(--good-ink)' : 'var(--text)'
    prefix      = isIncome ? '+' : '−'
  }

  return (
    <button
      onClick={() => onSelect(tx)}
      style={{
        display: 'flex', alignItems: 'center', gap: 13,
        padding: '11px 12px', borderRadius: 14,
        background: 'transparent', border: 'none',
        cursor: 'pointer', textAlign: 'left', width: '100%',
        transition: 'background .12s, transform .14s cubic-bezier(.2,.8,.2,1)',
        WebkitTapHighlightColor: 'transparent',
        fontFamily: 'inherit',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.985)')}
      onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {/* Category avatar — 44px matching design */}
      <div style={{
        width: 44, height: 44, borderRadius: 14, flexShrink: 0,
        background: `color-mix(in oklch, ${color} 18%, var(--surface))`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {label}
          </span>
          {isBorrowing && (
            <span
              className="pill"
              style={{ fontSize: 10.5, padding: '1px 7px', flexShrink: 0,
                background: tx._borrowDir === 'lent' ? 'var(--warn-soft)' : 'var(--info-soft)',
                color:      tx._borrowDir === 'lent' ? 'var(--warn-ink)'  : 'var(--info-ink)',
                border: 'none',
              }}
            >
              {tx._borrowDir}
            </span>
          )}
          {isTransfer && (
            getTransferDisplay(tx).isSavings
              ? <span className="pill" style={{ fontSize: 10.5, padding: '1px 7px', flexShrink: 0, background: 'var(--good-soft)', color: 'var(--good-ink)', border: 'none' }}>savings</span>
              : <span className="pill info" style={{ fontSize: 10.5, padding: '1px 7px', flexShrink: 0 }}>transfer</span>
          )}
          {tx.settledPerson && (
            <span className="pill" style={{ fontSize: 10.5, padding: '1px 7px', flexShrink: 0, background: 'var(--warn-soft)', color: 'var(--warn-ink)', border: 'none' }}>
              via {tx.settledPerson}
            </span>
          )}
          {tx.isRecurring && (
            <span className="pill" style={{ fontSize: 10.5, padding: '1px 7px', flexShrink: 0 }}>recurring</span>
          )}
        </div>
        {tx.notes && (
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tx.notes}
          </div>
        )}
        {tx.tags && tx.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {tx.tags.map(tag => (
              <span
                key={tag}
                style={{
                  fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 20,
                  border: '1px solid var(--border)', color: 'var(--text-3)', background: 'var(--surface-2)',
                  whiteSpace: 'nowrap',
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: amountColor, letterSpacing: '-0.01em', fontFamily: "'Geist Mono', monospace" }}>
          {prefix}{formatCurrencyFull(tx.amount)}
        </div>
      </div>
    </button>
  )
}

// ── Day group ────────────────────────────────────────────────────────────────

function DayGroup({ date, txs, defaultOpen, onSelect }: {
  date: string
  txs: ViewTx[]
  defaultOpen: boolean
  onSelect: (t: Transaction) => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  useEffect(() => { setOpen(defaultOpen) }, [defaultOpen])

  const { income, expenses, saved } = useMemo(() => {
    let income = 0, expenses = 0, saved = 0
    for (const tx of txs) {
      if (tx._borrowDir) continue  // borrowings don't count in P&L summary
      if (tx.type === 'income') income += tx.amount
      else if (tx.type === 'expense') expenses += tx.amount
      else {
        const { dir, isSavings } = getTransferDisplay(tx)
        if (dir === 'in') income += tx.amount
        else if (isSavings) saved += tx.amount
        else expenses += tx.amount
      }
    }
    return { income, expenses, saved }
  }, [txs])

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px 6px', borderRadius: 12,
          background: 'transparent', border: 'none', cursor: 'pointer',
          transition: 'background .12s', fontFamily: 'inherit',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        {open
          ? <ChevronDown  size={14} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
          : <ChevronRight size={14} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
        }
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', flex: 1, textAlign: 'left' }}>
          {dayLabel(date)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {income > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600, color: 'var(--good-ink)' }}>
              <ArrowDown size={11} />{formatCurrencyFull(income)}
            </span>
          )}
          {expenses > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600, color: 'var(--bad-ink)' }}>
              <ArrowUp size={11} />{formatCurrencyFull(expenses)}
            </span>
          )}
          {saved > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600, color: 'var(--warn-ink)' }}>
              <ArrowUp size={11} />{formatCurrencyFull(saved)}
            </span>
          )}
        </div>
      </button>

      {open && (
        <div style={{ paddingLeft: 4 }}>
          {txs.map(tx => <TxRow key={tx.id} tx={tx} onSelect={onSelect} />)}
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function TransactionList({ filterMonth = false, limit, transactions: txOverride, groupByDay = false, defaultExpandAll = false, showBorrowings = true }: Props) {
  const { transactions: storeTxs, borrowings, selectedMonth, settings } = useAppStore()
  const [selected, setSelected] = useState<Transaction | null>(null)

  const base: ViewTx[] = useMemo(() => {
    const txs: Transaction[] = txOverride ?? (filterMonth
      ? getTransactionsForMonth(storeTxs, selectedMonth, settings)
      : storeTxs)

    if (!showBorrowings) return txs as ViewTx[]

    // Filter borrowings to the same date range
    const { start, end } = getCycleRange(selectedMonth, settings)
    const borrowingRows = borrowings
      .filter(b => b.date >= start && b.date <= end)
      .map(borrowingToViewTx)

    // Only hide loan_given transactions — they're represented by synthetic borrowing rows.
    // Repayment transactions are shown as real entries so users can delete them and reverse the borrowing.
    const filteredTxs = txs.filter(t => !(t.type === 'transfer' && t.transferKind === 'loan_given'))

    return [...filteredTxs, ...borrowingRows]
  }, [txOverride, storeTxs, borrowings, selectedMonth, settings, filterMonth, showBorrowings])

  const list  = [...base].sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date)
    if (dateDiff !== 0) return dateDiff
    return b.createdAt.localeCompare(a.createdAt) // newest logged first → at top within a day
  })
  const shown = limit ? list.slice(0, limit) : list

  const today = format(new Date(), 'yyyy-MM-dd')

  const groups: [string, ViewTx[]][] = useMemo(() => {
    if (!groupByDay) return []
    const map = new Map<string, ViewTx[]>()
    for (const tx of shown) {
      if (!map.has(tx.date)) map.set(tx.date, [])
      map.get(tx.date)!.push(tx)
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [shown, groupByDay])

  if (shown.length === 0) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No transactions found.</p>
      </div>
    )
  }

  if (!groupByDay) {
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {shown.map(tx => <TxRow key={tx.id} tx={tx} onSelect={setSelected} />)}
        </div>
        <TransactionDetailModal tx={selected} onClose={() => setSelected(null)} />
      </>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {groups.map(([date, txs]) => (
          <DayGroup
            key={date}
            date={date}
            txs={txs}
            defaultOpen={date === today || defaultExpandAll}
            onSelect={setSelected}
          />
        ))}
      </div>
      <TransactionDetailModal tx={selected} onClose={() => setSelected(null)} />
    </>
  )
}
