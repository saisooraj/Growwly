'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Search, Loader2 } from 'lucide-react'
import type { Asset, AssetKind } from '@/types'

const KINDS: { value: AssetKind; label: string; icon: string }[] = [
  { value: 'mutual_fund', label: 'Mutual Fund',   icon: '📈' },
  { value: 'stocks',      label: 'Stocks / ETF',  icon: '📊' },
  { value: 'gold_grams',  label: 'Gold',           icon: '🪙' },
  { value: 'epf_ppf',    label: 'EPF / PPF / NPS', icon: '🏛️' },
  { value: 'fd_rd',       label: 'FD / RD',        icon: '🏦' },
  { value: 'cash',        label: 'Cash & Savings', icon: '💵' },
  { value: 'real_estate', label: 'Real Estate',    icon: '🏠' },
  { value: 'vehicle',     label: 'Vehicle',        icon: '🚗' },
  { value: 'other',       label: 'Other',          icon: '📦' },
]

interface MFResult   { schemeCode: string; schemeName: string }
interface StockResult { symbol: string; name: string; exchange: string }

interface Props {
  item?: Asset
  onSave: (data: Omit<Asset, 'id' | 'userId' | 'createdAt' | 'updatedAt'>, id?: string) => Promise<void>
  onClose: () => void
}

export default function AssetModal({ item, onSave, onClose }: Props) {
  const [kind, setKind]       = useState<AssetKind>(item?.kind ?? 'mutual_fund')
  const [name, setName]       = useState(item?.name ?? '')
  const [saving, setSaving]   = useState(false)

  // Gold
  const [grams, setGrams]     = useState(item?.value ? String(item.value) : '')
  const [karat, setKarat]     = useState<18|22|24>(item?.karat ?? 22)

  // MF
  const [schemeCode, setSchemeCode]   = useState(item?.schemeCode ?? '')
  const [units, setUnits]             = useState(item?.units ? String(item.units) : '')

  // Stocks
  const [ticker, setTicker]           = useState(item?.ticker ?? '')
  const [quantity, setQuantity]       = useState(item?.quantity ? String(item.quantity) : '')
  const [avgBuyPrice, setAvgBuyPrice] = useState(item?.avgBuyPrice ? String(item.avgBuyPrice) : '')

  // Manual (cash, FD, real estate, vehicle, other, epf_ppf)
  const [manualValue, setManualValue] = useState(
    !['gold_grams','mutual_fund','stocks'].includes(item?.kind ?? '') ? (item?.value ? String(item.value) : '') : ''
  )

  // Common
  const [investedAmount, setInvestedAmount] = useState(item?.investedAmount ? String(item.investedAmount) : '')

  // Search state
  const [mfQuery, setMfQuery]           = useState(item?.name ?? '')
  const [mfResults, setMfResults]       = useState<MFResult[]>([])
  const [mfLoading, setMfLoading]       = useState(false)
  const [mfOpen, setMfOpen]             = useState(false)

  const [stockQuery, setStockQuery]     = useState(item?.name ?? '')
  const [stockResults, setStockResults] = useState<StockResult[]>([])
  const [stockLoading, setStockLoading] = useState(false)
  const [stockOpen, setStockOpen]       = useState(false)

  const mfTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stockTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchMF = useCallback((q: string) => {
    if (mfTimer.current) clearTimeout(mfTimer.current)
    if (q.length < 2) { setMfResults([]); setMfOpen(false); return }
    mfTimer.current = setTimeout(async () => {
      setMfLoading(true)
      try {
        const res = await fetch(`/api/market/mf/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setMfResults(data.results ?? [])
        setMfOpen(true)
      } finally { setMfLoading(false) }
    }, 300)
  }, [])

  const searchStock = useCallback((q: string) => {
    if (stockTimer.current) clearTimeout(stockTimer.current)
    if (q.length < 1) { setStockResults([]); setStockOpen(false); return }
    stockTimer.current = setTimeout(async () => {
      setStockLoading(true)
      try {
        const res = await fetch(`/api/market/stocks/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setStockResults(data.results ?? [])
        setStockOpen(true)
      } finally { setStockLoading(false) }
    }, 300)
  }, [])

  useEffect(() => { if (kind === 'mutual_fund' && mfQuery) searchMF(mfQuery) }, [])
  useEffect(() => { if (kind === 'stocks' && stockQuery) searchStock(stockQuery) }, [])

  function selectMF(r: MFResult) {
    setSchemeCode(r.schemeCode)
    setName(r.schemeName)
    setMfQuery(r.schemeName)
    setMfOpen(false)
  }

  function selectStock(r: StockResult) {
    setTicker(r.symbol)
    setName(r.name)
    setStockQuery(r.name)
    setStockOpen(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const base = { name: name.trim(), kind }
      let payload: Omit<Asset, 'id' | 'userId' | 'createdAt' | 'updatedAt'>

      if (kind === 'gold_grams') {
        payload = { ...base, value: parseFloat(grams) || 0, karat,
          ...(investedAmount ? { investedAmount: parseFloat(investedAmount) } : {}),
        }
      } else if (kind === 'mutual_fund') {
        payload = { ...base, value: parseFloat(investedAmount) || 0, schemeCode,
          units: parseFloat(units) || 0,
          investedAmount: parseFloat(investedAmount) || 0,
        }
      } else if (kind === 'stocks') {
        const qty = parseFloat(quantity) || 0
        const avg = parseFloat(avgBuyPrice) || 0
        payload = { ...base, value: qty * avg, ticker, quantity: qty, avgBuyPrice: avg,
          investedAmount: parseFloat(investedAmount) || qty * avg,
        }
      } else {
        payload = { ...base, value: parseFloat(manualValue) || 0,
          ...(investedAmount ? { investedAmount: parseFloat(investedAmount) } : {}),
        }
      }

      await onSave(payload, item?.id)
    } finally { setSaving(false) }
  }

  const isMF     = kind === 'mutual_fund'
  const isStock  = kind === 'stocks'
  const isGold   = kind === 'gold_grams'
  const isManual = !isMF && !isStock && !isGold

  const canSubmit = name.trim() && (
    isMF    ? schemeCode && parseFloat(units) > 0 :
    isStock ? ticker && parseFloat(quantity) > 0 :
    isGold  ? parseFloat(grams) > 0 :
    parseFloat(manualValue) > 0
  )

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: 24, paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{item ? 'Edit Holding' : 'Add Holding'}</h2>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 8, border: 'none', background: 'var(--surface-2)', cursor: 'pointer', color: 'var(--text-2)', display: 'flex' }}><X size={16} /></button>
        </div>

        {/* Kind selector */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
          {KINDS.map(k => (
            <button
              key={k.value} type="button"
              onClick={() => { setKind(k.value); setName(''); setMfQuery(''); setStockQuery(''); setSchemeCode(''); setTicker('') }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                border: `1.5px solid ${kind === k.value ? 'var(--brand)' : 'var(--border)'}`,
                background: kind === k.value ? 'var(--brand-soft)' : 'var(--surface-2)',
                color: kind === k.value ? 'var(--brand-ink)' : 'var(--text-2)',
                transition: 'all .12s',
              }}
            >
              {k.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Mutual Fund ───────────────────────────────────── */}
          {isMF && (
            <>
              <div style={{ position: 'relative' }}>
                <label className="label">Search Fund</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)', pointerEvents: 'none' }} />
                  <input
                    className="input" style={{ paddingLeft: 34 }}
                    placeholder="Nippon India Small Cap…"
                    value={mfQuery}
                    onChange={e => { setMfQuery(e.target.value); setSchemeCode(''); setName(''); searchMF(e.target.value) }}
                    autoFocus
                  />
                  {mfLoading && <Loader2 size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)', animation: 'spin 1s linear infinite' }} />}
                </div>
                {mfOpen && mfResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', maxHeight: 220, overflowY: 'auto', marginTop: 4 }}>
                    {mfResults.map(r => (
                      <button key={r.schemeCode} type="button" onClick={() => selectMF(r)}
                        style={{ display: 'block', width: '100%', padding: '10px 14px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, lineHeight: 1.3 }}>{r.schemeName}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-4)', margin: 0, marginTop: 2 }}>Code: {r.schemeCode}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {schemeCode && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--good-soft)', fontSize: 12, color: 'var(--good-ink)' }}>
                  Selected · Code {schemeCode}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="label">Units held</label>
                  <input className="input" type="number" min="0" step="0.001" placeholder="e.g. 1234.567" value={units} onChange={e => setUnits(e.target.value)} />
                </div>
                <div>
                  <label className="label">Invested amount (₹)</label>
                  <input className="input" type="number" min="0" placeholder="e.g. 150000" value={investedAmount} onChange={e => setInvestedAmount(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* ── Stocks / ETF ──────────────────────────────────── */}
          {isStock && (
            <>
              <div style={{ position: 'relative' }}>
                <label className="label">Search Stock / ETF</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)', pointerEvents: 'none' }} />
                  <input
                    className="input" style={{ paddingLeft: 34 }}
                    placeholder="Reliance, TCS, Nifty 50 ETF…"
                    value={stockQuery}
                    onChange={e => { setStockQuery(e.target.value); setTicker(''); setName(''); searchStock(e.target.value) }}
                    autoFocus
                  />
                  {stockLoading && <Loader2 size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)', animation: 'spin 1s linear infinite' }} />}
                </div>
                {stockOpen && stockResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', maxHeight: 220, overflowY: 'auto', marginTop: 4 }}>
                    {stockResults.map(r => (
                      <button key={r.symbol} type="button" onClick={() => selectStock(r)}
                        style={{ display: 'block', width: '100%', padding: '10px 14px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>{r.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-4)', margin: 0, marginTop: 2 }}>{r.symbol} · {r.exchange}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {ticker && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--good-soft)', fontSize: 12, color: 'var(--good-ink)' }}>
                  Selected · {ticker}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="label">Quantity (shares)</label>
                  <input className="input" type="number" min="0" step="1" placeholder="e.g. 50" value={quantity} onChange={e => setQuantity(e.target.value)} />
                </div>
                <div>
                  <label className="label">Avg buy price (₹)</label>
                  <input className="input" type="number" min="0" step="0.01" placeholder="e.g. 2450" value={avgBuyPrice} onChange={e => setAvgBuyPrice(e.target.value)} />
                </div>
              </div>
              {parseFloat(quantity) > 0 && parseFloat(avgBuyPrice) > 0 && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--surface-2)', fontSize: 12, color: 'var(--text-3)' }}>
                  Invested: ₹{(parseFloat(quantity) * parseFloat(avgBuyPrice)).toLocaleString('en-IN')}
                </div>
              )}
            </>
          )}

          {/* ── Gold ─────────────────────────────────────────── */}
          {isGold && (
            <>
              <div>
                <label className="label">Label (optional)</label>
                <input className="input" placeholder="e.g. Jewellery, Coins" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label className="label">Karat</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([18, 22, 24] as const).map(k => (
                    <button key={k} type="button" onClick={() => setKarat(k)}
                      style={{
                        flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                        border: `1.5px solid ${karat === k ? 'var(--brand)' : 'var(--border)'}`,
                        background: karat === k ? 'var(--brand-soft)' : 'var(--surface-2)',
                        color: karat === k ? 'var(--brand-ink)' : 'var(--text-2)',
                      }}
                    >{k}K</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="label">Weight (grams)</label>
                  <input className="input" type="number" min="0" step="0.1" placeholder="e.g. 50" value={grams} onChange={e => setGrams(e.target.value)} autoFocus />
                </div>
                <div>
                  <label className="label">Invested amount (₹, optional)</label>
                  <input className="input" type="number" min="0" placeholder="What you paid" value={investedAmount} onChange={e => setInvestedAmount(e.target.value)} />
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-4)', margin: 0 }}>Current value calculated live from IBJA {karat}K price</p>
            </>
          )}

          {/* ── Manual (cash, FD, EPF, real estate, vehicle, other) ── */}
          {isManual && (
            <>
              <div>
                <label className="label">Name / Label</label>
                <input className="input" placeholder={
                  kind === 'epf_ppf' ? 'e.g. EPF, PPF, NPS' :
                  kind === 'fd_rd'   ? 'e.g. SBI FD 2025' :
                  kind === 'cash'    ? 'e.g. HDFC Savings' :
                  'e.g. Flat in Mumbai'
                } value={name} onChange={e => setName(e.target.value)} autoFocus required />
              </div>
              <div>
                <label className="label">Current Value (₹)</label>
                <input className="input" type="number" min="0" placeholder="e.g. 500000" value={manualValue} onChange={e => setManualValue(e.target.value)} required />
              </div>
              {(kind === 'epf_ppf' || kind === 'fd_rd') && (
                <div>
                  <label className="label">Invested / Principal (₹, optional)</label>
                  <input className="input" type="number" min="0" placeholder="Original amount invested" value={investedAmount} onChange={e => setInvestedAmount(e.target.value)} />
                </div>
              )}
            </>
          )}

          <button type="submit" className="btn-primary btn" disabled={saving || !canSubmit} style={{ marginTop: 4, opacity: !canSubmit ? 0.5 : 1 }}>
            {saving ? 'Saving…' : item ? 'Update' : 'Add'}
          </button>
        </form>
      </div>
    </div>
  )
}
