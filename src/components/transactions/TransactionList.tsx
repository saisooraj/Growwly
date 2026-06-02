'use client'

import { useState, useMemo } from 'react'
import { format, parseISO, isToday, isYesterday } from 'date-fns'
import { TrendingUp, TrendingDown, ArrowLeftRight, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { formatCurrencyFull, CATEGORY_COLORS, getTransactionsForMonth, TRANSFER_KINDS } from '@/lib/utils'
import type { Transaction } from '@/types'
import TransactionDetailModal from './TransactionDetailModal'

interface Props {
  filterMonth?: boolean
  limit?: number
  transactions?: Transaction[]
  groupByDay?: boolean
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

function TxRow({ tx, onSelect }: { tx: Transaction; onSelect: (t: Transaction) => void }) {
  const isTransfer = tx.type === 'transfer'
  const isIncome   = tx.type === 'income'
  const color      = isTransfer ? 'var(--info)' : (CATEGORY_COLORS[tx.category] ?? '#94a3b8')
  const dir        = isTransfer ? transferDir(tx) : (isIncome ? 'in' : 'out')
  const label      = isTransfer ? transferLabel(tx) : tx.category
  const amountColor = isTransfer
    ? dir === 'in' ? 'var(--good-ink)' : 'var(--text-2)'
    : isIncome ? 'var(--good-ink)' : 'var(--text)'
  const prefix = (isTransfer ? dir === 'in' : isIncome) ? '+' : '−'

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
        {isTransfer
          ? <ArrowLeftRight size={15} style={{ color }} />
          : isIncome
            ? <TrendingUp size={15} style={{ color }} />
            : <TrendingDown size={15} style={{ color }} />
        }
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {label}
          </span>
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
  txs: Transaction[]
  defaultOpen: boolean
  onSelect: (t: Transaction) => void
}) {
  const [open, setOpen] = useState(defaultOpen)

  const { income, expenses } = useMemo(() => {
    let income = 0, expenses = 0
    for (const tx of txs) {
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
      {/* Day header */}
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
          ? <ChevronDown size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          : <ChevronRight size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
        }
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', flex: 1, textAlign: 'left' }}>
          {dayLabel(date)}
        </span>
        {/* Collapsed summary — always visible */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {income > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600, color: 'var(--good-ink)' }}>
              <ArrowDown size={11} />
              {formatCurrencyFull(income)}
            </span>
          )}
          {expenses > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600, color: 'var(--bad-ink)' }}>
              <ArrowUp size={11} />
              {formatCurrencyFull(expenses)}
            </span>
          )}
        </div>
      </button>

      {/* Expanded rows */}
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
  const { transactions: storeTxs, selectedMonth } = useAppStore()
  const [selected, setSelected] = useState<Transaction | null>(null)

  const base = txOverride ?? (filterMonth
    ? getTransactionsForMonth(storeTxs, selectedMonth)
    : storeTxs)

  const list  = [...base].sort((a, b) => b.date.localeCompare(a.date))
  const shown = limit ? list.slice(0, limit) : list

  const today = format(new Date(), 'yyyy-MM-dd')

  const groups: [string, Transaction[]][] = useMemo(() => {
    if (!groupByDay) return []
    const map = new Map<string, Transaction[]>()
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
