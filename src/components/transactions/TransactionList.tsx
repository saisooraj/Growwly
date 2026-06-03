'use client'

import { useState, useMemo } from 'react'
import { format, parseISO, isToday, isYesterday } from 'date-fns'
import { TrendingUp, TrendingDown, ArrowLeftRight, ChevronDown, ChevronRight, ArrowUp, ArrowDown, UserMinus, UserPlus } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { formatCurrencyFull, CATEGORY_COLORS, getTransactionsForMonth, TRANSFER_KINDS } from '@/lib/utils'
import { getCycleRange } from '@/lib/cycle'
import type { Transaction, Borrowing } from '@/types'
import TransactionDetailModal from './TransactionDetailModal'

interface Props {
  filterMonth?: boolean
  limit?: number
  transactions?: Transaction[]
  groupByDay?: boolean
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

function transferLabel(tx: Transaction): string {
  return TRANSFER_KINDS.find(k => k.id === tx.transferKind)?.label ?? 'Transfer'
}

function transferDir(tx: Transaction): 'in' | 'out' {
  return TRANSFER_KINDS.find(k => k.id === tx.transferKind)?.dir ?? 'out'
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
      ? <UserMinus size={15} style={{ color }} />
      : <UserPlus  size={15} style={{ color }} />
    label       = tx._person ?? (isLent ? 'Lent' : 'Borrowed')
    amountColor = isLent ? 'var(--warn-ink)' : 'var(--info-ink)'
    prefix      = isLent ? '−' : '+'
  } else if (isTransfer) {
    const dir = transferDir(tx)
    color       = 'var(--info)'
    icon        = <ArrowLeftRight size={15} style={{ color }} />
    label       = transferLabel(tx)
    amountColor = dir === 'in' ? 'var(--good-ink)' : 'var(--text-2)'
    prefix      = dir === 'in' ? '+' : '−'
  } else {
    color       = CATEGORY_COLORS[tx.category] ?? '#94a3b8'
    icon        = isIncome
      ? <TrendingUp   size={15} style={{ color }} />
      : <TrendingDown size={15} style={{ color }} />
    label       = tx.category
    amountColor = isIncome ? 'var(--good-ink)' : 'var(--text)'
    prefix      = isIncome ? '+' : '−'
  }

  return (
    <button
      onClick={() => onSelect(tx)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 12px', borderRadius: 12,
        background: 'transparent', border: 'none',
        cursor: 'pointer', textAlign: 'left', width: '100%',
        transition: 'background .12s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: color + '20',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
            <span className="pill info" style={{ fontSize: 10.5, padding: '1px 7px', flexShrink: 0 }}>transfer</span>
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
      </div>

      <span className="num" style={{ fontSize: 13, fontWeight: 600, color: amountColor, flexShrink: 0 }}>
        {prefix}{formatCurrencyFull(tx.amount)}
      </span>
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

  const { income, expenses } = useMemo(() => {
    let income = 0, expenses = 0
    for (const tx of txs) {
      if (tx._borrowDir) continue  // borrowings don't count in P&L summary
      if (tx.type === 'income') income += tx.amount
      else if (tx.type === 'expense') expenses += tx.amount
      else {
        const dir = transferDir(tx)
        if (dir === 'in') income += tx.amount
        else expenses += tx.amount
      }
    }
    return { income, expenses }
  }, [txs])

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 10,
          background: 'transparent', border: 'none', cursor: 'pointer',
          transition: 'background .12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        {open
          ? <ChevronDown  size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          : <ChevronRight size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
        }
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', flex: 1, textAlign: 'left' }}>
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

export default function TransactionList({ filterMonth = false, limit, transactions: txOverride, groupByDay = false }: Props) {
  const { transactions: storeTxs, borrowings, selectedMonth, settings } = useAppStore()
  const [selected, setSelected] = useState<Transaction | null>(null)

  const base: ViewTx[] = useMemo(() => {
    const txs: Transaction[] = txOverride ?? (filterMonth
      ? getTransactionsForMonth(storeTxs, selectedMonth, settings)
      : storeTxs)

    // Filter borrowings to the same date range
    const { start, end } = getCycleRange(selectedMonth, settings)
    const borrowingRows = borrowings
      .filter(b => b.date >= start && b.date <= end)
      .map(borrowingToViewTx)

    return [...txs, ...borrowingRows]
  }, [txOverride, storeTxs, borrowings, selectedMonth, settings, filterMonth])

  const list  = [...base].sort((a, b) => b.date.localeCompare(a.date))
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
            defaultOpen={date === today}
            onSelect={setSelected}
          />
        ))}
      </div>
      <TransactionDetailModal tx={selected} onClose={() => setSelected(null)} />
    </>
  )
}
