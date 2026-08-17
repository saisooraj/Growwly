'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Camera, Image as ImageIcon, X, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppStore } from '@/store/appStore'
import AddTransactionModal from '@/components/transactions/AddTransactionModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { resizeForUpload } from '@/lib/ocr/resizeImage'
import { findPossibleDuplicate } from '@/lib/ocr/duplicateCheck'
import type { Transaction } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  initialBlob?: Blob | null
}

type Step = 'choose' | 'ocr' | 'confirm' | 'failed'

interface Prefill {
  amount?: number
  category?: string
  date?: string
  notes?: string
  source: 'scan' | 'share-target'
}

const MAX_IMAGE_BYTES = 12_000_000

export default function BillScannerModal({ open, onClose, initialBlob }: Props) {
  const transactions = useAppStore(s => s.transactions)

  const [step, setStep] = useState<Step>('choose')
  const [prefill, setPrefill] = useState<Prefill | null>(null)
  const [initialTab, setInitialTab] = useState<'expense' | 'income'>('expense')
  const [manualFallback, setManualFallback] = useState(false)
  const [duplicate, setDuplicate] = useState<Transaction | null>(null)
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep('choose')
    setPrefill(null)
    setInitialTab('expense')
    setManualFallback(false)
    setDuplicate(null)
    setDuplicateAcknowledged(false)
  }

  useEffect(() => {
    if (!open) {
      reset()
      return
    }
    if (initialBlob) runOcr(initialBlob, 'share-target')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialBlob])

  async function validateImage(file: File): Promise<boolean> {
    if (!file.type.startsWith('image/')) {
      toast.error("That doesn't look like an image")
      return false
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Image is too large (max 12MB)')
      return false
    }
    try {
      const bitmap = await createImageBitmap(file)
      bitmap.close()
    } catch {
      toast.error("This image looks corrupted — couldn't open it")
      return false
    }
    return true
  }

  async function handleFileSelected(file: File | undefined) {
    if (!file) return
    const ok = await validateImage(file)
    if (!ok) return
    runOcr(file, 'scan')
  }

  async function runOcr(blob: Blob, source: 'scan' | 'share-target') {
    setStep('ocr')
    try {
      const upload = await resizeForUpload(blob)
      const formData = new FormData()
      formData.append('image', upload, 'receipt.jpg')

      const res = await fetch('/api/chat/scan-receipt', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('scan failed')
      const result: { amount: number | null; merchant: string | null; date: string | null; category: string; type: 'expense' | 'income' } = await res.json()

      setPrefill({
        amount: result.amount ?? undefined,
        category: result.category,
        date: result.date ?? undefined,
        notes: result.merchant ?? undefined,
        source,
      })
      setInitialTab(result.type)
      setManualFallback(false)

      setDuplicate(
        result.amount != null && result.date != null
          ? findPossibleDuplicate({ amount: result.amount, category: result.category, date: result.date, merchant: result.merchant }, transactions)
          : null
      )
      setDuplicateAcknowledged(false)
      setStep('confirm')
    } catch {
      setStep('failed')
    }
  }

  function handleEnterManually() {
    setPrefill(null)
    setManualFallback(true)
    setStep('confirm')
  }

  const sheetOpen = open && (step === 'choose' || step === 'ocr' || step === 'failed')
  const showDuplicateGate = step === 'confirm' && !!duplicate && !duplicateAcknowledged && !manualFallback
  const showAddModal = step === 'confirm' && !showDuplicateGate

  return (
    <>
      <Transition appear show={sheetOpen} as={Fragment}>
        <Dialog as="div" style={{ position: 'relative', zIndex: 50 }} onClose={onClose}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
            leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
          >
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
          </Transition.Child>

          <div style={{ position: 'fixed', inset: 0, overflowY: 'auto' }}>
            <div style={{ display: 'flex', minHeight: '100%', alignItems: 'flex-end', justifyContent: 'center' }} className="sm:items-center sm:p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-full sm:translate-y-4 sm:opacity-0"
                enterTo="opacity-100 translate-y-0"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 translate-y-full sm:translate-y-4 sm:opacity-0"
              >
                <Dialog.Panel
                  className="rounded-t-3xl sm:rounded-3xl"
                  style={{
                    width: '100%', maxWidth: 420,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-lg)',
                    overflow: 'hidden',
                    display: 'flex', flexDirection: 'column',
                    maxHeight: '92dvh',
                  }}
                >
                  <div className="sm:hidden" style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4, flexShrink: 0 }}>
                    <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--border-strong)', opacity: 0.6 }} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                    <Dialog.Title style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                      {step === 'ocr' ? 'Reading bill…' : step === 'failed' ? "Couldn't read image" : 'Scan / Upload Bill'}
                    </Dialog.Title>
                    <button
                      onClick={onClose}
                      style={{ padding: 6, borderRadius: 8, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {step === 'choose' && (
                      <>
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="btn-brand"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 16px', fontSize: 14 }}
                        >
                          <Camera size={17} /> Take Photo
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="btn"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 16px', fontSize: 14 }}
                        >
                          <ImageIcon size={17} /> Choose Image
                        </button>
                        <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', margin: 0 }}>
                          Tip: on your phone, you can also share a payment screenshot to Growwly directly from Photos.
                        </p>
                        <input
                          ref={cameraInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          style={{ display: 'none' }}
                          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; handleFileSelected(f) }}
                        />
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; handleFileSelected(f) }}
                        />
                      </>
                    )}

                    {step === 'ocr' && (
                      <div style={{ padding: '12px 0 4px' }}>
                        <ProgressBar indeterminate label="Reading image…" />
                      </div>
                    )}

                    {step === 'failed' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center', padding: '8px 0' }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--bad-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <AlertTriangle size={20} style={{ color: 'var(--bad-ink)' }} />
                        </div>
                        <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: 0 }}>
                          We couldn&rsquo;t read this image. You can try another photo or enter the transaction manually.
                        </p>
                        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                          <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setStep('choose')}>Try Again</button>
                          <button type="button" className="btn-brand" style={{ flex: 1 }} onClick={handleEnterManually}>Enter Manually</button>
                        </div>
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <ConfirmDialog
        open={showDuplicateGate}
        title="Possible duplicate"
        message={duplicate ? `A similar transaction already exists: ₹${duplicate.amount} · ${duplicate.category} on ${duplicate.date}.` : ''}
        confirmLabel="Add Anyway"
        onConfirm={() => setDuplicateAcknowledged(true)}
        onClose={onClose}
      />

      <AddTransactionModal
        open={showAddModal}
        onClose={onClose}
        initialTab={initialTab}
        initialPrefill={prefill}
      />
    </>
  )
}
