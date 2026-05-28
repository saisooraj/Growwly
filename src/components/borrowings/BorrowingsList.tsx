'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Trash2, Edit2, CheckCircle, MessageCircle } from 'lucide-react'
import { deleteBorrowing, updateBorrowing } from '@/lib/firestore'
import { useRefreshData } from '@/hooks/useData'
import { useAppStore } from '@/store/appStore'
import { formatCurrencyFull } from '@/lib/utils'
import type { Borrowing } from '@/types'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'

interface Props {
  onEdit: (b: Borrowing) => void
}

const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-700',
  partial: 'bg-blue-100 text-blue-700',
  repaid: 'bg-green-100 text-green-700',
}

function buildWhatsAppLink(b: Borrowing): string {
  const outstanding = b.amount - b.repaidAmount
  const msg = b.type === 'lent'
    ? `Hi ${b.person}, just a reminder that you owe me ₹${outstanding.toLocaleString('en-IN')}${b.description ? ` for ${b.description}` : ''}. Please let me know when you can repay. Thanks!`
    : `Hi ${b.person}, I still owe you ₹${outstanding.toLocaleString('en-IN')}${b.description ? ` for ${b.description}` : ''}. I'll arrange to repay soon.`
  return `https://wa.me/?text=${encodeURIComponent(msg)}`
}

export default function BorrowingsList({ onEdit }: Props) {
  const { borrowings } = useAppStore()
  const refresh = useRefreshData()
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null)

  const totalBorrowed = borrowings
    .filter((b) => b.type === 'borrowed' && b.status !== 'repaid')
    .reduce((s, b) => s + (b.amount - b.repaidAmount), 0)

  const totalLent = borrowings
    .filter((b) => b.type === 'lent' && b.status !== 'repaid')
    .reduce((s, b) => s + (b.amount - b.repaidAmount), 0)

  function handleDelete(id: string) {
    setConfirm({
      message: 'Delete this borrowing record?',
      onConfirm: async () => {
        try {
          await deleteBorrowing(id)
          await refresh()
          toast.success('Deleted')
        } catch { toast.error('Failed') }
      },
    })
  }

  async function markRepaid(b: Borrowing) {
    try {
      await updateBorrowing(b.id, { repaidAmount: b.amount, status: 'repaid' })
      await refresh()
      toast.success('Marked as repaid')
    } catch {
      toast.error('Failed')
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card-sm bg-red-50">
          <p className="text-xs text-red-600 font-medium mb-1">You Owe</p>
          <p className="text-xl font-bold text-red-700">{formatCurrencyFull(totalBorrowed)}</p>
        </div>
        <div className="card-sm bg-green-50">
          <p className="text-xs text-green-600 font-medium mb-1">Owed to You</p>
          <p className="text-xl font-bold text-green-700">{formatCurrencyFull(totalLent)}</p>
        </div>
      </div>

      {/* List */}
      {borrowings.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-8">No borrowing records yet.</p>
      ) : (
        borrowings.map((b) => (
          <div key={b.id} className="card-sm">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`badge text-xs font-medium px-2 py-0.5 rounded-full ${
                    b.type === 'borrowed' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                  }`}>
                    {b.type === 'borrowed' ? '↑ Borrowed' : '↓ Lent'}
                  </span>
                  <span className={`badge ${STATUS_STYLES[b.status]}`}>{b.status}</span>
                </div>
                <p className="font-semibold text-slate-800">{b.person}</p>
                {b.description && <p className="text-xs text-slate-400">{b.description}</p>}
                <div className="text-xs text-slate-400 mt-1">
                  {format(parseISO(b.date), 'dd MMM yyyy')}
                  {b.dueDate && ` · Due: ${format(parseISO(b.dueDate), 'dd MMM yyyy')}`}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <p className="font-bold text-slate-800">{formatCurrencyFull(b.amount)}</p>
                {b.repaidAmount > 0 && b.repaidAmount < b.amount && (
                  <p className="text-xs text-green-600">Repaid: {formatCurrencyFull(b.repaidAmount)}</p>
                )}
                <div className="flex gap-1">
                  {b.status !== 'repaid' && (
                    <>
                      <button onClick={() => markRepaid(b)} className="p-1.5 rounded-lg hover:bg-green-100 text-slate-400 hover:text-green-600" title="Mark repaid">
                        <CheckCircle size={14} />
                      </button>
                      <a
                        href={buildWhatsAppLink(b)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-green-100 text-slate-400 hover:text-green-600"
                        title="Send WhatsApp reminder"
                      >
                        <MessageCircle size={14} />
                      </a>
                    </>
                  )}
                  <button onClick={() => onEdit(b)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>

            {b.amount > 0 && (
              <div className="mt-3">
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-green-500 transition-all"
                    style={{ width: `${Math.min((b.repaidAmount / b.amount) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ))
      )}
      {confirm && (
        <ConfirmDialog
          open={true}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
