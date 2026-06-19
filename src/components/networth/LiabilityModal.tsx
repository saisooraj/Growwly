'use client'

import { useState, useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
import type { Liability, LiabilityKind } from '@/types'
import { formatCurrencyFull } from '@/lib/utils'

const KINDS: { value: LiabilityKind; label: string }[] = [
  { value: 'home_loan',     label: 'Home Loan' },
  { value: 'car_loan',      label: 'Car Loan' },
  { value: 'personal_loan', label: 'Personal Loan' },
  { value: 'credit_card',   label: 'Credit Card Balance' },
  { value: 'other',         label: 'Other' },
]

function calcEMI(p: number, r: number, n: number): number {
  if (r === 0 || n === 0) return n > 0 ? p / n : 0
  const rm = r / 12 / 100
  return p * rm * Math.pow(1 + rm, n) / (Math.pow(1 + rm, n) - 1)
}

interface Props {
  item?: Liability
  onSave: (data: Omit<Liability, 'id' | 'userId' | 'createdAt' | 'updatedAt'>, id?: string) => Promise<void>
  onClose: () => void
}

export default function LiabilityModal({ item, onSave, onClose }: Props) {
  const [name, setName] = useState(item?.name ?? '')
  const [kind, setKind] = useState<LiabilityKind>(item?.kind ?? 'home_loan')
  const [principal, setPrincipal] = useState(item?.principal ? String(item.principal) : '')
  const [rate, setRate] = useState(item?.interestRate ? String(item.interestRate) : '')
  const [tenure, setTenure] = useState(item?.tenureMonths ? String(item.tenureMonths) : '')
  const [startDate, setStartDate] = useState(item?.startDate ?? new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  const isCreditCard = kind === 'credit_card'

  useEffect(() => {
    if (item) {
      setName(item.name); setKind(item.kind)
      setPrincipal(String(item.principal)); setRate(String(item.interestRate))
      setTenure(String(item.tenureMonths)); setStartDate(item.startDate)
    }
  }, [item])

  const emi = useMemo(() => {
    const p = parseFloat(principal) || 0
    const r = parseFloat(rate) || 0
    const n = parseInt(tenure) || 0
    if (p > 0 && n > 0) return calcEMI(p, r, n)
    return 0
  }, [principal, rate, tenure])

  const totalInterest = useMemo(() => {
    const p = parseFloat(principal) || 0
    const n = parseInt(tenure) || 0
    return Math.max(0, emi * n - p)
  }, [emi, principal, tenure])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !principal) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(), kind,
        principal: parseFloat(principal),
        interestRate: parseFloat(rate) || 0,
        tenureMonths: isCreditCard ? 0 : (parseInt(tenure) || 0),
        startDate,
        emiAmount: emi > 0 ? Math.round(emi) : undefined,
      }, item?.id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,.5)', overflowY: 'auto' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: 24, paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{item ? 'Edit Liability' : 'Add Liability / Loan'}</h2>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 8, border: 'none', background: 'var(--surface-2)', cursor: 'pointer', color: 'var(--text-2)', display: 'flex' }}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label">Type</label>
            <select className="input" value={kind} onChange={e => setKind(e.target.value as LiabilityKind)}>
              {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Name / Lender</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. SBI Home Loan" required />
          </div>
          <div>
            <label className="label">{isCreditCard ? 'Outstanding Balance (₹)' : 'Loan Amount (₹)'}</label>
            <input className="input" type="number" min="0" value={principal} onChange={e => setPrincipal(e.target.value)} placeholder="e.g. 2500000" required />
          </div>
          {!isCreditCard && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">Interest Rate (% p.a.)</label>
                  <input className="input" type="number" min="0" step="0.01" value={rate} onChange={e => setRate(e.target.value)} placeholder="e.g. 8.5" />
                </div>
                <div>
                  <label className="label">Tenure (months)</label>
                  <input className="input" type="number" min="1" value={tenure} onChange={e => setTenure(e.target.value)} placeholder="e.g. 240" />
                </div>
              </div>
              <div>
                <label className="label">Loan Start Date</label>
                <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              {emi > 0 && (
                <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--text-4)', margin: '0 0 2px' }}>EMI / month</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{formatCurrencyFull(Math.round(emi))}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--text-4)', margin: '0 0 2px' }}>Total interest</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--bad-ink)', margin: 0 }}>{formatCurrencyFull(Math.round(totalInterest))}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--text-4)', margin: '0 0 2px' }}>Total outflow</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{formatCurrencyFull(Math.round(emi * (parseInt(tenure) || 0)))}</p>
                  </div>
                </div>
              )}
            </>
          )}
          <button type="submit" className="btn-primary btn" disabled={saving} style={{ marginTop: 4 }}>
            {saving ? 'Saving…' : item ? 'Update' : 'Add Liability'}
          </button>
        </form>
      </div>
    </div>
  )
}
