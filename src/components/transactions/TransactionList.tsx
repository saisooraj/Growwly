'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Edit2, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { deleteTransaction } from '@/lib/firestore'
import { useRefreshData } from '@/hooks/useData'
import { formatCurrencyFull, CATEGORY_COLORS, getTransactionsForMonth } from '@/lib/utils'
import type { Transaction } from '@/types'
import AddTransactionModal from './AddTransactionModal'
import toast from 'react-hot-toast'

interface Props {
  filterMonth?: boolean
  limit?: number
}

export default function TransactionList({ filterMonth = false, limit }: Props) {
  const { transactions, selectedMonth } = useAppStore()
  const refresh = useRefreshData()
  const [editTx, setEditTx] = useState<Transaction | null>(null)

  const list = filterMonth
    ? getTransactionsForMonth(transactions, selectedMonth)
    : transactions

  const shown = limit ? list.slice(0, limit) : list

  async function handleDelete(id: string) {
    if (!confirm('Delete this transaction?')) return
    try {
      await deleteTransaction(id)
      await refresh()
      toast.success('Deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  if (shown.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-400 text-sm">No transactions found.</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {shown.map((tx) => {
          const color = CATEGORY_COLORS[tx.category] ?? '#94a3b8'
          return (
            <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: color + '20' }}
              >
                {tx.type === 'income'
                  ? <TrendingUp size={16} style={{ color }} />
                  : <TrendingDown size={16} style={{ color }} />
                }
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800 truncate">{tx.category}</span>
                  {tx.notes && (
                    <span className="text-xs text-slate-400 truncate hidden sm:block">— {tx.notes}</span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {format(parseISO(tx.date), 'dd MMM yyyy')}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-slate-800'}`}>
                  {tx.type === 'income' ? '+' : '-'}{formatCurrencyFull(tx.amount)}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditTx(tx)}
                    className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(tx.id)}
                    className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <AddTransactionModal
        open={!!editTx}
        onClose={() => setEditTx(null)}
        editTx={editTx}
      />
    </>
  )
}
