'use client'

import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, Edit2, Trash2, Calendar, Tag, FileText, Repeat, Folder, ArrowLeftRight, TrendingUp, TrendingDown } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { deleteTransaction } from '@/lib/firestore'
import { useRefreshData } from '@/hooks/useData'
import { formatCurrencyFull, CATEGORY_COLORS, TRANSFER_KINDS } from '@/lib/utils'
import { useAppStore } from '@/store/appStore'
import type { Transaction } from '@/types'
import AddTransactionModal from './AddTransactionModal'
import toast from 'react-hot-toast'

interface Props {
  tx: Transaction | null
  onClose: () => void
}

export default function TransactionDetailModal({ tx, onClose }: Props) {
  const refresh = useRefreshData()
  const { projects } = useAppStore()
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const open = !!tx

  async function handleDelete() {
    if (!tx || !confirm('Delete this transaction?')) return
    setDeleting(true)
    try {
      await deleteTransaction(tx.id)
      await refresh()
      toast.success('Deleted')
      onClose()
    } catch {
      toast.error('Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  function handleEdit() {
    setEditOpen(true)
  }

  if (!tx) return null

  const isTransfer = tx.type === 'transfer'
  const isIncome   = tx.type === 'income'
  const color      = isTransfer ? 'var(--info)' : (CATEGORY_COLORS[tx.category] ?? '#94a3b8')
  const kindInfo   = isTransfer ? TRANSFER_KINDS.find(k => k.id === tx.transferKind) : null
  const project    = tx.projectId ? projects.find(p => p.id === tx.projectId) : null

  const amountColor = isTransfer
    ? (kindInfo?.dir === 'in' ? 'var(--good)' : 'var(--text-2)')
    : isIncome ? 'var(--good-ink)' : 'var(--bad-ink)'

  const prefix = isTransfer
    ? (kindInfo?.dir === 'in' ? '+' : '−')
    : (isIncome ? '+' : '−')

  const typeLabel = isTransfer
    ? (kindInfo?.label ?? 'Transfer')
    : isIncome ? 'Income' : 'Expense'

  const typePillClass = isTransfer ? 'info' : isIncome ? 'good' : 'bad'

  return (
    <>
      <Transition appear show={open} as={Fragment}>
        <Dialog as="div" style={{ position: 'relative', zIndex: 50 }} onClose={onClose}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
            leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
          >
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
          </Transition.Child>

          <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}
               className="sm:items-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200" enterFrom="opacity-0 translate-y-4" enterTo="opacity-100 translate-y-0"
              leave="ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-4"
            >
              <Dialog.Panel style={{
                width: '100%', maxWidth: 420,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-lg)',
                overflow: 'hidden',
              }}>
                {/* Header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: color + '20',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isTransfer
                        ? <ArrowLeftRight size={16} style={{ color }} />
                        : isIncome
                          ? <TrendingUp size={16} style={{ color }} />
                          : <TrendingDown size={16} style={{ color }} />
                      }
                    </div>
                    <div>
                      <Dialog.Title style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>
                        {isTransfer ? (kindInfo?.label ?? 'Transfer') : tx.category}
                      </Dialog.Title>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                        {format(parseISO(tx.date), 'dd MMM yyyy')}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    style={{ padding: 6, borderRadius: 8, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Amount hero */}
                <div style={{
                  padding: '24px 20px 20px',
                  borderBottom: '1px solid var(--border)',
                  textAlign: 'center',
                }}>
                  <div className="display-num" style={{ fontSize: 38, color: amountColor, lineHeight: 1 }}>
                    {prefix}{formatCurrencyFull(tx.amount)}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <span className={`pill ${typePillClass}`}>
                      <span className="pill-dot" />
                      {typeLabel}
                    </span>
                  </div>
                  {isTransfer && kindInfo && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-3)' }}>
                      {kindInfo.sub}
                    </div>
                  )}
                </div>

                {/* Details */}
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                  <Row icon={<Calendar size={14} />} label="Date">
                    {format(parseISO(tx.date), 'EEEE, dd MMMM yyyy')}
                  </Row>

                  {!isTransfer && (
                    <Row icon={<Tag size={14} />} label="Category">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          display: 'inline-block', width: 8, height: 8, borderRadius: 2,
                          background: CATEGORY_COLORS[tx.category] ?? '#94a3b8',
                        }} />
                        {tx.category}
                      </span>
                    </Row>
                  )}

                  {tx.notes && (
                    <Row icon={<FileText size={14} />} label="Notes">
                      {tx.notes}
                    </Row>
                  )}

                  {project && (
                    <Row icon={<Folder size={14} />} label="Project">
                      {project.name}
                    </Row>
                  )}

                  {tx.isRecurring && (
                    <Row icon={<Repeat size={14} />} label="Recurring">
                      Repeats monthly on day {tx.recurringDay}
                    </Row>
                  )}

                </div>

                {/* Actions */}
                <div style={{
                  display: 'flex', gap: 8,
                  padding: '12px 20px 20px',
                }}>
                  <button
                    onClick={handleEdit}
                    className="btn-secondary"
                    style={{ flex: 1, justifyContent: 'center', gap: 8 }}
                  >
                    <Edit2 size={14} /> Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="btn-danger"
                    style={{ flex: 1, justifyContent: 'center', gap: 8 }}
                  >
                    <Trash2 size={14} />
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      <AddTransactionModal
        open={editOpen}
        onClose={() => { setEditOpen(false); onClose() }}
        editTx={tx}
      />
    </>
  )
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
        background: 'var(--surface-2)', color: 'var(--text-3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>
          {label}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
