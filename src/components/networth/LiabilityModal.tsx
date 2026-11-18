'use client'

import { useState, useMemo } from 'react'
import type { Liability, LiabilityKind } from '@/types'
import { Chip, Field, Sheet, SheetActions, SheetTitle, rs } from './nwUi'

const KINDS: { value: LiabilityKind; label: string }[] = [
  { value: 'home_loan',     label: 'Home Loan' },
  { value: 'car_loan',      label: 'Car Loan' },
  { value: 'personal_loan', label: 'Personal Loan' },
  { value: 'credit_card',   label: 'Credit Card' },
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
  const months = parseInt(tenure) || 0

  const emi = useMemo(() => {
    const p = parseFloat(principal) || 0
    const r = parseFloat(rate) || 0
    if (p > 0 && months > 0) return calcEMI(p, r, months)
    return 0
  }, [principal, rate, months])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !principal) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(), kind,
        principal: parseFloat(principal),
        interestRate: parseFloat(rate) || 0,
        tenureMonths: isCreditCard ? 0 : months,
        startDate,
        emiAmount: emi > 0 ? Math.round(emi) : undefined,
      }, item?.id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet onClose={onClose} label={item ? 'Edit liability' : 'Add a liability'}>
      <SheetTitle title={item ? 'Edit liability' : 'Add a liability'} onClose={onClose} />
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="nw-label">Type</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {KINDS.map(k => <Chip key={k.value} on={kind === k.value} label={k.label} onClick={() => setKind(k.value)} />)}
          </div>
        </div>
        <Field label="Name / Lender">
          <input className="nw-input" value={name} onChange={e => setName(e.target.value)} placeholder={isCreditCard ? 'e.g. HDFC Credit Card' : 'e.g. SBI Home Loan'} required />
        </Field>
        <Field label={isCreditCard ? 'Outstanding balance' : 'Loan amount'}>
          <input className="nw-input" type="number" inputMode="decimal" min="0" value={principal} onChange={e => setPrincipal(e.target.value)} placeholder="₹0" required autoFocus={!item} />
        </Field>
        {!isCreditCard && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            <Field label="Rate % p.a.">
              <input className="nw-input" type="number" inputMode="decimal" min="0" step="0.01" value={rate} onChange={e => setRate(e.target.value)} placeholder="8.5" />
            </Field>
            <Field label="Months">
              <input className="nw-input" type="number" inputMode="numeric" min="1" value={tenure} onChange={e => setTenure(e.target.value)} placeholder="240" />
            </Field>
            <Field label="Started">
              <input className="nw-input" type="month" value={startDate.slice(0, 7)} style={{ padding: '0 8px' }}
                // Keeps the saved day when the month is unchanged
                onChange={e => e.target.value && setStartDate(e.target.value === startDate.slice(0, 7) ? startDate : `${e.target.value}-01`)} />
            </Field>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 14px', borderRadius: 14, background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.4 }}>
            {isCreditCard ? 'Cards are tracked as a balance. Update it after you pay the bill.'
              : months > 0 ? `Estimated EMI for ${months} months` : 'Add the rate and months to see the EMI'}
          </div>
          {!isCreditCard && emi > 0 && <div className="nw-num" style={{ fontSize: 18, fontWeight: 700, whiteSpace: 'nowrap' }}>{rs(emi)}/mo</div>}
        </div>
        <SheetActions onCancel={onClose} primary={saving ? 'Saving…' : item ? 'Save changes' : 'Add liability'} submit disabled={saving || !name.trim() || !principal} />
      </form>
    </Sheet>
  )
}
