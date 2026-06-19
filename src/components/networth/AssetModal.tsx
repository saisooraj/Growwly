'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { Asset, AssetKind } from '@/types'

const KINDS: { value: AssetKind; label: string; hint: string }[] = [
  { value: 'cash',        label: 'Cash & Savings',  hint: 'Bank balance, savings account' },
  { value: 'fd_rd',       label: 'FD / RD',          hint: 'Fixed or recurring deposits' },
  { value: 'gold_grams',  label: 'Gold',             hint: 'Enter weight in grams — auto-priced' },
  { value: 'mutual_fund', label: 'Mutual Funds',     hint: 'Current portfolio value' },
  { value: 'stocks',      label: 'Stocks',           hint: 'Current market value' },
  { value: 'real_estate', label: 'Real Estate',      hint: 'Estimated current market value' },
  { value: 'vehicle',     label: 'Vehicle',          hint: 'Current resale value' },
  { value: 'other',       label: 'Other',            hint: 'Any other asset' },
]

interface Props {
  item?: Asset
  onSave: (data: Omit<Asset, 'id' | 'userId' | 'createdAt' | 'updatedAt'>, id?: string) => Promise<void>
  onClose: () => void
}

export default function AssetModal({ item, onSave, onClose }: Props) {
  const [name, setName] = useState(item?.name ?? '')
  const [kind, setKind] = useState<AssetKind>(item?.kind ?? 'cash')
  const [value, setValue] = useState(item?.value ? String(item.value) : '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (item) { setName(item.name); setKind(item.kind); setValue(String(item.value)) }
  }, [item])

  const isGold = kind === 'gold_grams'
  const selectedKind = KINDS.find(k => k.value === kind)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !value) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), kind, value: parseFloat(value) }, item?.id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: 24, paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{item ? 'Edit Asset' : 'Add Asset'}</h2>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 8, border: 'none', background: 'var(--surface-2)', cursor: 'pointer', color: 'var(--text-2)', display: 'flex' }}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label">Asset type</label>
            <select className="input" value={kind} onChange={e => setKind(e.target.value as AssetKind)}>
              {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
            {selectedKind && <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>{selectedKind.hint}</p>}
          </div>
          <div>
            <label className="label">Name / Label</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder={isGold ? 'e.g. 22K Gold jewellery' : 'e.g. SBI Savings Account'} required />
          </div>
          <div>
            <label className="label">{isGold ? 'Weight (grams)' : 'Current Value (₹)'}</label>
            <input className="input" type="number" min="0" step={isGold ? '0.1' : '1'} value={value} onChange={e => setValue(e.target.value)} placeholder={isGold ? 'e.g. 50' : 'e.g. 250000'} required />
            {isGold && <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>Value will be calculated using live IBJA gold price</p>}
          </div>
          <button type="submit" className="btn-primary btn" disabled={saving} style={{ marginTop: 4 }}>
            {saving ? 'Saving…' : item ? 'Update' : 'Add Asset'}
          </button>
        </form>
      </div>
    </div>
  )
}
