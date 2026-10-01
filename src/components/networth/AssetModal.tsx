'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Search, Loader2, Plus, Trash2 } from 'lucide-react'
import type { Asset, AssetKind, GoldPurchase, NpsHolding, PpfDeposit } from '@/types'
import { EPF_DEFAULT_RATE, PPF_DEFAULT_RATE, computePpfBalance, npsCorpus } from '@/lib/retirement'
import { legacyGoldPurchases, goldPurchaseTotals, goldCurrentValue } from '@/lib/gold'
import { linkSummary } from '@/lib/holdingLinks'

const KINDS: { value: AssetKind; label: string }[] = [
  { value: 'mutual_fund', label: 'Mutual Fund'    },
  { value: 'stocks',      label: 'Stocks / ETF'   },
  { value: 'gold_grams',  label: 'Gold'            },
  { value: 'epf',         label: 'EPF'            },
  { value: 'ppf',         label: 'PPF'            },
  { value: 'nps',         label: 'NPS'            },
  { value: 'fd_rd',       label: 'FD / RD'         },
  { value: 'cash',        label: 'Cash & Savings'  },
  { value: 'real_estate', label: 'Real Estate'     },
  { value: 'vehicle',     label: 'Vehicle'         },
  { value: 'other',       label: 'Other'           },
]

interface MFResult   { schemeCode: string; schemeName: string }
interface StockResult { symbol: string; name: string; exchange: string }
interface NpsScheme  { schemeCode: string; schemeName: string }

const todayISO = () => new Date().toISOString().slice(0, 10)

interface Props {
  item?: Asset
  onSave: (data: Omit<Asset, 'id' | 'userId' | 'createdAt' | 'updatedAt'>, id?: string) => Promise<void>
  onClose: () => void
}

export default function AssetModal({ item, onSave, onClose }: Props) {
  const [kind, setKind]       = useState<AssetKind>(item?.kind ?? 'mutual_fund')
  const [name, setName]       = useState(item?.name ?? '')
  const [saving, setSaving]   = useState(false)

  // Gold — one row per purchase lot (grams can vary in karat across lots)
  const [goldPurchases, setGoldPurchases] = useState<GoldPurchase[]>(
    item?.kind === 'gold_grams' && item ? legacyGoldPurchases(item) : []
  )
  const [goldPrices, setGoldPrices] = useState<{ price18k: number; price22k: number; price24k: number } | null>(null)

  // MF
  const [schemeCode, setSchemeCode]   = useState(item?.schemeCode ?? '')
  const [units, setUnits]             = useState(item?.units ? String(item.units) : '')

  // Stocks
  const [ticker, setTicker]           = useState(item?.ticker ?? '')
  const [quantity, setQuantity]       = useState(item?.quantity ? String(item.quantity) : '')
  const [avgBuyPrice, setAvgBuyPrice] = useState(item?.avgBuyPrice ? String(item.avgBuyPrice) : '')

  // Manual (cash, FD, real estate, vehicle, other, epf_ppf legacy)
  const [manualValue, setManualValue] = useState(
    !['gold_grams','mutual_fund','stocks','epf','ppf','nps'].includes(item?.kind ?? '') ? (item?.value ? String(item.value) : '') : ''
  )

  // EPF
  const [epfBalance, setEpfBalance]         = useState(item?.kind === 'epf' && item?.value ? String(item.value) : '')
  const [epfAsOf, setEpfAsOf]               = useState(item?.balanceAsOf ?? todayISO())
  const [epfContribution, setEpfContribution] = useState(item?.monthlyContribution ? String(item.monthlyContribution) : '')
  const [epfRate, setEpfRate]               = useState(String(item?.kind === 'epf' && item?.annualRate ? item.annualRate : EPF_DEFAULT_RATE))

  // PPF
  const [ppfStart, setPpfStart]             = useState(item?.ppfStartDate ?? '')
  const [ppfRate, setPpfRate]               = useState(String(item?.kind === 'ppf' && item?.annualRate ? item.annualRate : PPF_DEFAULT_RATE))
  // What was paid in, kept apart from interest the passbook has already credited
  const savedDeposits = item?.ppfDeposits?.filter(d => !d.interest) ?? []
  const savedInterest = item?.ppfDeposits?.filter(d => d.interest) ?? []
  const [ppfDeposits, setPpfDeposits]       = useState<PpfDeposit[]>(savedDeposits.length ? savedDeposits : [{ date: todayISO(), amount: 0 }])
  const [ppfInterest, setPpfInterest]       = useState(savedInterest.length ? String(savedInterest.reduce((s, d) => s + d.amount, 0)) : '')

  // NPS
  const [npsHoldings, setNpsHoldings]       = useState<NpsHolding[]>(item?.npsHoldings ?? [])
  const [npsCorpusManual, setNpsCorpusManual] = useState(item?.kind === 'nps' && !item?.npsHoldings?.length && item?.value ? String(item.value) : '')
  const [npsAllSchemes, setNpsAllSchemes]   = useState<NpsScheme[]>([])
  const [npsQuery, setNpsQuery]             = useState('')
  const [npsNavByCode, setNpsNavByCode]     = useState<Record<string, number>>({})

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

  // Gold: live IBJA rates, for the current-value preview
  useEffect(() => {
    if (kind !== 'gold_grams' || goldPrices) return
    fetch('/api/market/gold')
      .then(r => r.json())
      .then(d => {
        if (d.price22kPerGram) {
          setGoldPrices({
            price22k: d.price22kPerGram,
            price24k: parseFloat((d.price22kPerGram * 24 / 22).toFixed(2)),
            price18k: parseFloat((d.price22kPerGram * 18 / 22).toFixed(2)),
          })
        }
      })
      .catch(() => {})
  }, [kind, goldPrices])

  const goldTotals = goldPurchaseTotals(goldPurchases)
  const links = item ? linkSummary(item) : null
  const linkedTag = <span style={{ flexShrink: 0, alignSelf: 'center', fontSize: 10.5, fontWeight: 600, color: 'var(--brand-ink)', background: 'var(--brand-soft)', borderRadius: 999, padding: '2px 8px' }}>linked</span>
  const goldLiveValue = goldPrices ? goldCurrentValue(goldPurchases, goldPrices) : 0

  // NPS: load the scheme list once, then live NAVs for whatever is held / listed.
  useEffect(() => {
    if (kind !== 'nps' || npsAllSchemes.length) return
    fetch('/api/market/nps?action=schemes')
      .then(r => r.json())
      .then(d => setNpsAllSchemes(d.results ?? []))
      .catch(() => {})
  }, [kind, npsAllSchemes.length])

  useEffect(() => {
    if (kind !== 'nps') return
    const codes = npsHoldings.map(h => h.schemeCode)
    if (!codes.length) return
    fetch(`/api/market/nps?codes=${encodeURIComponent(codes.join(','))}`)
      .then(r => r.json())
      .then(d => {
        const map: Record<string, number> = {}
        for (const [code, v] of Object.entries(d.nav ?? {})) {
          const nav = (v as { nav?: number }).nav
          if (typeof nav === 'number' && nav > 0) map[code] = nav
        }
        setNpsNavByCode(map)
      })
      .catch(() => {})
  }, [kind, npsHoldings])

  const npsMatches = npsQuery.trim().length < 2 ? [] : npsAllSchemes
    .filter(s => s.schemeName.toLowerCase().includes(npsQuery.trim().toLowerCase()))
    .filter(s => !npsHoldings.some(h => h.schemeCode === s.schemeCode))
    .slice(0, 8)

  function addNpsHolding(s: NpsScheme) {
    setNpsHoldings(h => [...h, { schemeCode: s.schemeCode, schemeName: s.schemeName, units: 0 }])
    setNpsQuery('')
  }
  function setNpsUnits(code: string, units: number) {
    setNpsHoldings(h => h.map(x => x.schemeCode === code ? { ...x, units } : x))
  }
  function removeNpsHolding(code: string) {
    setNpsHoldings(h => h.filter(x => x.schemeCode !== code))
  }

  const npsLiveCorpus = npsCorpus(npsHoldings, npsNavByCode)
  // Keeps its original date so re-saving doesn't restart the interest it earns
  const ppfInterestEntry: PpfDeposit[] = parseFloat(ppfInterest) > 0
    ? [{ date: savedInterest[0]?.date ?? todayISO(), amount: parseFloat(ppfInterest), interest: true }]
    : []
  const ppfPreview = computePpfBalance({
    startDate: ppfStart || undefined,
    deposits: [...ppfDeposits, ...ppfInterestEntry],
    rateOverride: parseFloat(ppfRate) || undefined,
  })

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
        const validPurchases = goldPurchases.filter(p => p.grams > 0)
        const { totalGrams, totalInvested } = goldPurchaseTotals(validPurchases)
        payload = { ...base, value: totalGrams, karat: validPurchases[0]?.karat ?? 22, goldPurchases: validPurchases,
          ...(totalInvested > 0 ? { investedAmount: totalInvested } : {}),
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
      } else if (kind === 'epf') {
        const bal = parseFloat(epfBalance) || 0
        payload = { ...base, value: bal, balanceAsOf: epfAsOf, annualRate: parseFloat(epfRate) || EPF_DEFAULT_RATE,
          ...(parseFloat(epfContribution) > 0 ? { monthlyContribution: parseFloat(epfContribution) } : {}),
          ...(investedAmount ? { investedAmount: parseFloat(investedAmount) } : {}),
        }
      } else if (kind === 'ppf') {
        const deposits = [...ppfDeposits.filter(d => d.amount > 0 && d.date), ...ppfInterestEntry]
        payload = { ...base, value: ppfPreview.balance, ppfDeposits: deposits,
          annualRate: parseFloat(ppfRate) || PPF_DEFAULT_RATE,
          investedAmount: ppfPreview.totalDeposited,
          ...(ppfStart ? { ppfStartDate: ppfStart } : {}),
        }
      } else if (kind === 'nps') {
        const holdings = npsHoldings.filter(h => h.units > 0)
        const value = holdings.length ? Math.round(npsLiveCorpus) : (parseFloat(npsCorpusManual) || 0)
        payload = { ...base, value,
          ...(holdings.length ? { npsHoldings: holdings } : {}),
          ...(investedAmount ? { investedAmount: parseFloat(investedAmount) } : {}),
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
  const isEPF    = kind === 'epf'
  const isPPF    = kind === 'ppf'
  const isNPS    = kind === 'nps'
  const isManual = !isMF && !isStock && !isGold && !isEPF && !isPPF && !isNPS

  const canSubmit = name.trim() && (
    isMF    ? schemeCode && parseFloat(units) > 0 :
    isStock ? ticker && parseFloat(quantity) > 0 :
    isGold  ? goldPurchases.some(p => p.grams > 0) :
    isEPF   ? parseFloat(epfBalance) > 0 && !!epfAsOf :
    isPPF   ? ppfDeposits.some(d => d.amount > 0 && d.date) :
    isNPS   ? npsHoldings.some(h => h.units > 0) || parseFloat(npsCorpusManual) > 0 :
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
              onClick={() => {
                setKind(k.value)
                setName(['epf','ppf','nps'].includes(k.value) ? k.label : '')
                setMfQuery(''); setStockQuery(''); setSchemeCode(''); setTicker('')
              }}
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
                <label className="label">Purchases</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {goldPurchases.map((p, i) => (
                    <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderRadius: 8, background: 'var(--surface-2)' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input className="input" type="date" max={todayISO()} value={p.date}
                          onChange={e => setGoldPurchases(list => list.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
                        {p.transactionId && linkedTag}
                        <button type="button" onClick={() => setGoldPurchases(list => list.filter((_, j) => j !== i))}
                          style={{ flexShrink: 0, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-4)', cursor: 'pointer' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {([18, 22, 24] as const).map(k => (
                          <button key={k} type="button" onClick={() => setGoldPurchases(list => list.map((x, j) => j === i ? { ...x, karat: k } : x))}
                            style={{
                              flex: 1, padding: '6px', borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                              border: `1.5px solid ${p.karat === k ? 'var(--brand)' : 'var(--border)'}`,
                              background: p.karat === k ? 'var(--brand-soft)' : 'var(--surface)',
                              color: p.karat === k ? 'var(--brand-ink)' : 'var(--text-2)',
                            }}
                          >{k}K</button>
                        ))}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <input className="input" type="number" min="0" step="0.001" placeholder="Grams" value={p.grams || ''}
                          onChange={e => setGoldPurchases(list => list.map((x, j) => j === i ? { ...x, grams: parseFloat(e.target.value) || 0 } : x))} />
                        <input className="input" type="number" min="0" step="0.01" placeholder="₹/gram paid" value={p.pricePerGram || ''}
                          onChange={e => setGoldPurchases(list => list.map((x, j) => j === i ? { ...x, pricePerGram: parseFloat(e.target.value) || 0 } : x))} />
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button"
                  onClick={() => setGoldPurchases(list => [...list, { id: Math.random().toString(36).slice(2), date: todayISO(), grams: 0, karat: 22, pricePerGram: 0 }])}
                  style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-3)', fontSize: 12, cursor: 'pointer' }}>
                  <Plus size={12} /> Add purchase
                </button>
              </div>
              {goldTotals.totalGrams > 0 && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--good-soft)', fontSize: 12, color: 'var(--good-ink)' }}>
                  {goldTotals.totalGrams.toFixed(2)}g · invested ₹{goldTotals.totalInvested.toLocaleString('en-IN')}
                  {goldLiveValue > 0 ? ` · now worth ₹${Math.round(goldLiveValue).toLocaleString('en-IN')}` : ''}
                </div>
              )}
              <p style={{ fontSize: 11, color: 'var(--text-4)', margin: 0 }}>Current value calculated live from IBJA rates per lot&apos;s karat — buying via a Gold savings transaction adds a purchase here automatically.</p>
            </>
          )}

          {/* ── EPF ──────────────────────────────────────────── */}
          {isEPF && (
            <>
              <div>
                <label className="label">Label</label>
                <input className="input" placeholder="e.g. EPF (UAN xxxx)" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="label">Balance (₹)</label>
                  <input className="input" type="number" min="0" placeholder="From passbook" value={epfBalance} onChange={e => setEpfBalance(e.target.value)} autoFocus />
                </div>
                <div>
                  <label className="label">Balance as of</label>
                  <input className="input" type="date" max={todayISO()} value={epfAsOf} onChange={e => setEpfAsOf(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="label">Monthly credit (₹, optional)</label>
                  <input className="input" type="number" min="0" placeholder="Employee + employer" value={epfContribution} onChange={e => setEpfContribution(e.target.value)} />
                </div>
                <div>
                  <label className="label">Interest rate (% p.a.)</label>
                  <input className="input" type="number" min="0" step="0.05" value={epfRate} onChange={e => setEpfRate(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Total contributed so far (₹, optional)</label>
                <input className="input" type="number" min="0" placeholder="For gain tracking" value={investedAmount} onChange={e => setInvestedAmount(e.target.value)} />
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-4)', margin: 0 }}>
                EPFO has no public API. The balance is estimated forward from this snapshot using the rate and monthly credit — refresh it from your passbook now and then.
              </p>
            </>
          )}

          {/* ── PPF ──────────────────────────────────────────── */}
          {isPPF && (
            <>
              <div>
                <label className="label">Label</label>
                <input className="input" placeholder="e.g. PPF — SBI" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="label">Account opened (optional)</label>
                  <input className="input" type="date" max={todayISO()} value={ppfStart} onChange={e => setPpfStart(e.target.value)} />
                </div>
                <div>
                  <label className="label">Interest rate (% p.a.)</label>
                  <input className="input" type="number" min="0" step="0.05" value={ppfRate} onChange={e => setPpfRate(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Deposits</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ppfDeposits.map((d, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8 }}>
                      <input className="input" type="date" max={todayISO()} value={d.date}
                        onChange={e => setPpfDeposits(list => list.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
                      <input className="input" type="number" min="0" placeholder="₹ amount" value={d.amount || ''}
                        onChange={e => setPpfDeposits(list => list.map((x, j) => j === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x))} />
                      {d.transactionId && linkedTag}
                      <button type="button" onClick={() => setPpfDeposits(list => list.length > 1 ? list.filter((_, j) => j !== i) : list)}
                        style={{ flexShrink: 0, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-4)', cursor: 'pointer' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setPpfDeposits(list => [...list, { date: todayISO(), amount: 0 }])}
                  style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-3)', fontSize: 12, cursor: 'pointer' }}>
                  <Plus size={12} /> Add deposit
                </button>
              </div>
              <div>
                <label className="label">Interest credited so far (₹, optional)</label>
                <input className="input" type="number" min="0" placeholder="Total interest in your passbook" value={ppfInterest} onChange={e => setPpfInterest(e.target.value)} />
              </div>
              {ppfPreview.totalDeposited > 0 && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--good-soft)', fontSize: 12, color: 'var(--good-ink)' }}>
                  Value ₹{ppfPreview.balance.toLocaleString('en-IN')} = invested ₹{ppfPreview.totalDeposited.toLocaleString('en-IN')} + interest ₹{ppfPreview.interestEarned.toLocaleString('en-IN')}
                </div>
              )}
              <p style={{ fontSize: 11, color: 'var(--text-4)', margin: 0 }}>
                No PPF API exists, but the maths is fixed: interest on the lowest balance between the 5th and month-end, credited every 31 March.
              </p>
            </>
          )}

          {/* ── NPS ──────────────────────────────────────────── */}
          {isNPS && (
            <>
              <div>
                <label className="label">Label</label>
                <input className="input" placeholder="e.g. NPS Tier I (PRAN xxxx)" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div style={{ position: 'relative' }}>
                <label className="label">Add scheme</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)', pointerEvents: 'none' }} />
                  <input className="input" style={{ paddingLeft: 34 }}
                    placeholder={npsAllSchemes.length ? 'HDFC Pension Scheme E — Tier I…' : 'Loading schemes…'}
                    value={npsQuery} onChange={e => setNpsQuery(e.target.value)} />
                </div>
                {npsMatches.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', maxHeight: 220, overflowY: 'auto', marginTop: 4 }}>
                    {npsMatches.map(s => (
                      <button key={s.schemeCode} type="button" onClick={() => addNpsHolding(s)}
                        style={{ display: 'block', width: '100%', padding: '10px 14px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, lineHeight: 1.3 }}>{s.schemeName}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-4)', margin: 0, marginTop: 2 }}>{s.schemeCode}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {npsHoldings.map(h => (
                <div key={h.schemeCode} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.schemeName}</p>
                    <p style={{ fontSize: 10.5, color: 'var(--text-4)', margin: 0 }}>
                      {npsNavByCode[h.schemeCode] ? `NAV ₹${npsNavByCode[h.schemeCode].toFixed(4)}` : h.schemeCode}
                    </p>
                  </div>
                  <input className="input" style={{ width: 110, flexShrink: 0 }} type="number" min="0" step="0.0001" placeholder="units"
                    value={h.units || ''} onChange={e => setNpsUnits(h.schemeCode, parseFloat(e.target.value) || 0)} />
                  <button type="button" onClick={() => removeNpsHolding(h.schemeCode)}
                    style={{ flexShrink: 0, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-4)', cursor: 'pointer' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {npsHoldings.some(h => h.units > 0) ? (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--good-soft)', fontSize: 12, color: 'var(--good-ink)' }}>
                  Live corpus ₹{Math.round(npsLiveCorpus).toLocaleString('en-IN')}
                </div>
              ) : (
                <div>
                  <label className="label">Or enter corpus manually (₹)</label>
                  <input className="input" type="number" min="0" placeholder="From your CRA statement" value={npsCorpusManual} onChange={e => setNpsCorpusManual(e.target.value)} />
                </div>
              )}
              <div>
                <label className="label">Total contributed (₹, optional)</label>
                <input className="input" type="number" min="0" placeholder="For gain tracking" value={investedAmount} onChange={e => setInvestedAmount(e.target.value)} />
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-4)', margin: 0 }}>
                Unit counts come from your CRA statement (login-only). Once entered, the corpus is valued live from daily NAVs.
              </p>
            </>
          )}

          {/* ── Manual (cash, FD, real estate, vehicle, other, legacy EPF/PPF) ── */}
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

          {links && links.count > 0 && (
            <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: 0 }}>
              {links.unit === 'g' ? `${links.linked}g` : `₹${links.linked.toLocaleString('en-IN')}`} of this comes from {links.count} linked transaction{links.count === 1 ? '' : 's'}; {links.unit === 'g' ? `${links.historical}g` : `₹${links.historical.toLocaleString('en-IN')}`} is historical.
            </p>
          )}

          <button type="submit" className="btn-primary btn" disabled={saving || !canSubmit} style={{ marginTop: 4, opacity: !canSubmit ? 0.5 : 1 }}>
            {saving ? 'Saving…' : item ? 'Update' : 'Add'}
          </button>
        </form>
      </div>
    </div>
  )
}
