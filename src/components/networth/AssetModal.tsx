'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { format, parse } from 'date-fns'
import type { Asset, AssetKind, GoldPurchase, NpsHolding, PpfDeposit } from '@/types'
import { EPF_DEFAULT_RATE, PPF_DEFAULT_RATE, computePpfBalance, npsCorpus } from '@/lib/retirement'
import { legacyGoldPurchases, goldPurchaseTotals, goldCurrentValue } from '@/lib/gold'
import { linkSummary } from '@/lib/holdingLinks'
import { inferCategory, CATEGORY_LABELS } from '@/services/mfCAGR'
import { Chip, Field, Ring, Sheet, SheetActions, SheetTitle, kindColor, rs } from './nwUi'

export const KINDS: { value: AssetKind; label: string }[] = [
  { value: 'mutual_fund', label: 'Mutual Fund'    },
  { value: 'stocks',      label: 'Stock / ETF'    },
  { value: 'gold_grams',  label: 'Gold'            },
  { value: 'epf',         label: 'EPF'            },
  { value: 'ppf',         label: 'PPF'            },
  { value: 'nps',         label: 'NPS'            },
  { value: 'fd_rd',       label: 'FD/RD'           },
  { value: 'post_office', label: 'Post Office'     },
  { value: 'cash',        label: 'Cash & Savings'  },
  { value: 'real_estate', label: 'Real Estate'     },
  { value: 'vehicle',     label: 'Vehicle'         },
  { value: 'other',       label: 'Other'           },
]

// Post Office small savings schemes (PPF at the post office is logged as PPF)
export const POST_OFFICE_SCHEMES = [
  'Recurring Deposit (RD)',
  'Time Deposit (TD)',
  'Monthly Income Scheme (MIS)',
  'National Savings Certificate (NSC)',
  'Kisan Vikas Patra (KVP)',
  'Senior Citizens Savings Scheme (SCSS)',
  'Sukanya Samriddhi Yojana (SSY)',
  'RPLI – Gram Santosh (EA)', // Rural Postal Life Insurance, endowment assurance policy
  'Savings Account',
]

interface MFResult   { schemeCode: string; schemeName: string }
interface StockResult { symbol: string; name: string; exchange: string }
interface NpsScheme  { schemeCode: string; schemeName: string }

const todayISO = () => new Date().toISOString().slice(0, 10)

interface Props {
  item?: Asset
  // A new holding with its type and name filled in (e.g. from linking unlinked savings). Manual
  // kinds start at ₹0, ready to be filled by the linked transactions.
  preset?: { kind: AssetKind; name: string; note?: string }
  onSave: (data: Omit<Asset, 'id' | 'userId' | 'createdAt' | 'updatedAt'>, id?: string) => Promise<void>
  onClose: () => void
}

export default function AssetModal({ item, preset, onSave, onClose }: Props) {
  const [kind, setKind]       = useState<AssetKind>(item?.kind ?? preset?.kind ?? 'mutual_fund')
  const [name, setName]       = useState(item?.name ?? preset?.name ?? '')
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
  const [postOfficeScheme, setPostOfficeScheme] = useState(item?.postOfficeScheme ?? '')
  const [manualValue, setManualValue] = useState(
    !['gold_grams','mutual_fund','stocks','epf','ppf','nps'].includes(item?.kind ?? '') ? (item?.value ? String(item.value) : preset ? '0' : '') : ''
  )

  // EPF
  const [epfBalance, setEpfBalance]         = useState(item?.kind === 'epf' && item?.value ? String(item.value) : '')
  const [epfAsOf, setEpfAsOf]               = useState(item?.balanceAsOf ?? todayISO())
  const [epfContribution, setEpfContribution] = useState(item?.monthlyContribution ? String(item.monthlyContribution) : '')
  const [epfInterest, setEpfInterest]       = useState(item?.kind === 'epf' && item.investedAmount !== undefined && item.value > item.investedAmount ? String(item.value - item.investedAmount) : '')
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

  // MF: today's NAV for the chosen fund, for the "Value today" preview
  const [mfNav, setMfNav] = useState<{ code: string; nav: number; date: string } | null>(null)
  useEffect(() => {
    if (kind !== 'mutual_fund' || !schemeCode) return
    let cancelled = false
    fetch(`/api/market/mf/nav?codes=${encodeURIComponent(schemeCode)}`)
      .then(r => r.json())
      .then(d => {
        const n = d.nav?.[schemeCode]
        if (!cancelled && n?.nav > 0) setMfNav({ code: schemeCode, nav: n.nav, date: n.date ?? '' })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [kind, schemeCode])
  const navDate = (d: string) => { try { return format(parse(d, 'dd-MM-yyyy', new Date()), 'd MMM') } catch { return '' } }

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
          // What was paid in is the balance less the interest it has earned
          ...(parseFloat(epfInterest) > 0 ? { investedAmount: Math.max(0, bal - parseFloat(epfInterest)) } : {}),
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
          ...(kind === 'post_office' && postOfficeScheme ? { postOfficeScheme } : {}),
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
    // 0 is allowed: a holding can start empty and fill up as savings transactions are linked to it
    manualValue.trim() !== '' && parseFloat(manualValue) >= 0
  )

  // A list of search results, picked like radio options
  const results = (rows: { key: string; name: string; sub: string; on: boolean; pick: () => void }[]) => rows.length > 0 && (
    <div role="listbox" style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 248, overflowY: 'auto', overscrollBehavior: 'contain' }}>
      {rows.map(r => (
        <button key={r.key} type="button" role="option" aria-selected={r.on} onClick={r.pick}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${r.on ? 'var(--brand)' : 'transparent'}`, background: r.on ? 'var(--brand-soft)' : 'var(--surface-2)', color: 'inherit', textAlign: 'left', cursor: 'pointer', flex: 'none' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{r.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{r.sub}</div>
          </div>
          <Ring on={r.on} />
        </button>
      ))}
    </div>
  )
  const searchBox = (value: string, onChange: (v: string) => void, placeholder: string, loading: boolean) => (
    <div style={{ position: 'relative' }}>
      <span aria-hidden style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 11, height: 11, borderRadius: '50%', border: '1.8px solid var(--text-3)', pointerEvents: 'none' }} />
      <input className="nw-input" style={{ paddingLeft: 32 }} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} autoFocus={!item} />
      {loading && <Loader2 size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)', animation: 'spin 1s linear infinite' }} />}
    </div>
  )
  // Brand-tinted summary: "Value today · NAV ₹81.33 · 14 Nov      ₹6,84,182"
  const preview = (label: string, sub: string, value?: string) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 14px', borderRadius: 14, background: 'var(--brand-soft)', color: 'var(--brand-ink)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ fontSize: 11.5, opacity: 0.8 }}>{sub}</div>}
      </div>
      {value && <div className="nw-num" style={{ fontSize: 19, fontWeight: 700, whiteSpace: 'nowrap' }}>{value}</div>}
    </div>
  )
  const note = (text: string) => <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0, lineHeight: 1.45 }}>{text}</p>
  const two = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 } as const
  const smallBtn = { flexShrink: 0, width: 48, height: 48, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' } as const
  const addRowBtn = { alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 13px', borderRadius: 999, border: '1.5px dashed var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' } as const
  const mfUnits = parseFloat(units) || 0
  const navNow = mfNav && mfNav.code === schemeCode ? mfNav : null

  return (
    <Sheet onClose={onClose} label={item ? 'Edit holding' : 'Add a holding'}>
      <SheetTitle title={item ? 'Edit holding' : 'Add a holding'} sub="Valued at today's prices once added." onClose={onClose} />
      {preset?.note && <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '-6px 0 0', lineHeight: 1.45 }}>{preset.note}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="nw-label">What kind?</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {KINDS.map(k => (
            <Chip key={k.value} on={kind === k.value} label={k.label} dot={kindColor(k.value)}
              onClick={() => {
                setKind(k.value)
                setName(['epf','ppf','nps'].includes(k.value) ? k.label : '')
                setMfQuery(''); setStockQuery(''); setSchemeCode(''); setTicker('')
              }} />
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Mutual Fund ───────────────────────────────────── */}
        {isMF && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="nw-label">Fund</span>
              {searchBox(mfQuery, v => { setMfQuery(v); setSchemeCode(''); setName(''); searchMF(v) }, 'Search a fund, e.g. parag parikh', mfLoading)}
              {mfOpen && results(mfResults.slice(0, 8).map(r => ({
                key: r.schemeCode, name: r.schemeName, on: r.schemeCode === schemeCode,
                sub: `${CATEGORY_LABELS[inferCategory(r.schemeName)] ?? 'Fund'} · Code ${r.schemeCode}`,
                pick: () => { setSchemeCode(r.schemeCode); setName(r.schemeName) },
              })))}
            </div>
            <div style={two}>
              <Field label="Units">
                <input className="nw-input" type="number" inputMode="decimal" min="0" step="0.001" placeholder="e.g. 1234.567" value={units} onChange={e => setUnits(e.target.value)} />
              </Field>
              <Field label="Amount invested">
                <input className="nw-input" type="number" inputMode="decimal" min="0" placeholder="₹0" value={investedAmount} onChange={e => setInvestedAmount(e.target.value)} />
              </Field>
            </div>
            {schemeCode && preview('Value today', navNow ? `NAV ₹${navNow.nav.toFixed(2)}${navDate(navNow.date) ? ` · ${navDate(navNow.date)}` : ''}` : 'Fetching today’s NAV…',
              navNow && mfUnits > 0 ? rs(navNow.nav * mfUnits) : undefined)}
          </>
        )}

        {/* ── Stocks / ETF ──────────────────────────────────── */}
        {isStock && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="nw-label">Stock or ETF</span>
              {searchBox(stockQuery, v => { setStockQuery(v); setTicker(''); setName(''); searchStock(v) }, 'Reliance, TCS, Nifty 50 ETF…', stockLoading)}
              {stockOpen && results(stockResults.slice(0, 8).map(r => ({
                key: r.symbol, name: r.name, sub: `${r.symbol} · ${r.exchange}`, on: r.symbol === ticker,
                pick: () => { setTicker(r.symbol); setName(r.name) },
              })))}
            </div>
            <div style={two}>
              <Field label="Shares">
                <input className="nw-input" type="number" inputMode="numeric" min="0" step="1" placeholder="e.g. 50" value={quantity} onChange={e => setQuantity(e.target.value)} />
              </Field>
              <Field label="Avg buy price">
                <input className="nw-input" type="number" inputMode="decimal" min="0" step="0.01" placeholder="₹0" value={avgBuyPrice} onChange={e => setAvgBuyPrice(e.target.value)} />
              </Field>
            </div>
            {parseFloat(quantity) > 0 && parseFloat(avgBuyPrice) > 0 && preview('Amount invested', `${quantity} × ₹${parseFloat(avgBuyPrice).toLocaleString('en-IN')}`, rs(parseFloat(quantity) * parseFloat(avgBuyPrice)))}
          </>
        )}

        {/* ── Gold ─────────────────────────────────────────── */}
        {isGold && (
          <>
            <Field label="Label (optional)">
              <input className="nw-input" placeholder="e.g. Gold coins" value={name} onChange={e => setName(e.target.value)} />
            </Field>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="nw-label">Purchases</span>
              {goldPurchases.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 14, background: 'var(--surface-2)' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="nw-input" type="date" max={todayISO()} value={p.date} style={{ background: 'var(--surface)' }}
                      onChange={e => setGoldPurchases(list => list.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
                    {p.transactionId && linkedTag}
                    <button type="button" aria-label="Remove purchase" onClick={() => setGoldPurchases(list => list.filter((_, j) => j !== i))} style={smallBtn}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {([18, 22, 24] as const).map(k => (
                      <button key={k} type="button" aria-pressed={p.karat === k} onClick={() => setGoldPurchases(list => list.map((x, j) => j === i ? { ...x, karat: k } : x))}
                        style={{ flex: 1, height: 34, borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${p.karat === k ? 'var(--brand)' : 'var(--border)'}`, background: p.karat === k ? 'var(--brand-soft)' : 'var(--surface)', color: p.karat === k ? 'var(--brand-ink)' : 'var(--text-2)' }}
                      >{k}K</button>
                    ))}
                  </div>
                  <div style={two}>
                    <input className="nw-input" type="number" inputMode="decimal" min="0" step="0.001" placeholder="Grams" value={p.grams || ''} style={{ background: 'var(--surface)' }} aria-label="Grams"
                      onChange={e => setGoldPurchases(list => list.map((x, j) => j === i ? { ...x, grams: parseFloat(e.target.value) || 0 } : x))} />
                    <input className="nw-input" type="number" inputMode="decimal" min="0" step="0.01" placeholder="₹/gram paid" value={p.pricePerGram || ''} style={{ background: 'var(--surface)' }} aria-label="Price per gram paid"
                      onChange={e => setGoldPurchases(list => list.map((x, j) => j === i ? { ...x, pricePerGram: parseFloat(e.target.value) || 0 } : x))} />
                  </div>
                </div>
              ))}
              <button type="button" style={addRowBtn}
                onClick={() => setGoldPurchases(list => [...list, { id: Math.random().toString(36).slice(2), date: todayISO(), grams: 0, karat: 22, pricePerGram: 0 }])}>
                <Plus size={13} /> Add purchase
              </button>
            </div>
            {goldTotals.totalGrams > 0 && preview(
              goldLiveValue > 0 ? 'Value today' : `${goldTotals.totalGrams.toFixed(2)}g`,
              `${goldTotals.totalGrams.toFixed(2)}g · invested ₹${goldTotals.totalInvested.toLocaleString('en-IN')}`,
              goldLiveValue > 0 ? rs(goldLiveValue) : undefined)}
            {note('Valued live from IBJA rates for each lot’s karat. Buying through a Gold savings transaction adds a purchase here automatically.')}
          </>
        )}

        {/* ── EPF ──────────────────────────────────────────── */}
        {isEPF && (
          <>
            <Field label="Label">
              <input className="nw-input" placeholder="e.g. EPF · Employer" value={name} onChange={e => setName(e.target.value)} />
            </Field>
            <div style={two}>
              <Field label="Balance">
                <input className="nw-input" type="number" inputMode="decimal" min="0" placeholder="From passbook" value={epfBalance} onChange={e => setEpfBalance(e.target.value)} autoFocus={!item} />
              </Field>
              <Field label="Balance as of">
                <input className="nw-input" type="date" max={todayISO()} value={epfAsOf} onChange={e => setEpfAsOf(e.target.value)} />
              </Field>
            </div>
            <div style={two}>
              <Field label="Monthly credit (optional)">
                <input className="nw-input" type="number" inputMode="decimal" min="0" placeholder="Employee + employer" value={epfContribution} onChange={e => setEpfContribution(e.target.value)} />
              </Field>
              <Field label="Rate % p.a.">
                <input className="nw-input" type="number" inputMode="decimal" min="0" step="0.05" value={epfRate} onChange={e => setEpfRate(e.target.value)} />
              </Field>
            </div>
            <Field label="Interest so far (optional)">
              <input className="nw-input" type="number" inputMode="decimal" min="0" placeholder="Total interest in your passbook" value={epfInterest} onChange={e => setEpfInterest(e.target.value)} />
            </Field>
            {parseFloat(epfBalance) > 0 && parseFloat(epfInterest) > 0 && preview('Balance',
              `Contributed ₹${Math.max(0, parseFloat(epfBalance) - parseFloat(epfInterest)).toLocaleString('en-IN')} + interest ₹${parseFloat(epfInterest).toLocaleString('en-IN')}`,
              rs(parseFloat(epfBalance) || 0))}
            {note('EPFO has no public API. The balance is estimated forward from this snapshot using the rate and monthly credit — refresh it from your passbook now and then.')}
          </>
        )}

        {/* ── PPF ──────────────────────────────────────────── */}
        {isPPF && (
          <>
            <Field label="Label">
              <input className="nw-input" placeholder="e.g. PPF · SBI" value={name} onChange={e => setName(e.target.value)} />
            </Field>
            <div style={two}>
              <Field label="Opened (optional)">
                <input className="nw-input" type="date" max={todayISO()} value={ppfStart} onChange={e => setPpfStart(e.target.value)} />
              </Field>
              <Field label="Rate % p.a.">
                <input className="nw-input" type="number" inputMode="decimal" min="0" step="0.05" value={ppfRate} onChange={e => setPpfRate(e.target.value)} />
              </Field>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="nw-label">Deposits</span>
              {ppfDeposits.map((d, i) => (
                <div key={i} style={{ display: 'flex', gap: 8 }}>
                  <input className="nw-input" type="date" max={todayISO()} value={d.date} aria-label="Deposit date"
                    onChange={e => setPpfDeposits(list => list.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
                  <input className="nw-input" type="number" inputMode="decimal" min="0" placeholder="₹0" value={d.amount || ''} aria-label="Deposit amount"
                    onChange={e => setPpfDeposits(list => list.map((x, j) => j === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x))} />
                  {d.transactionId && linkedTag}
                  <button type="button" aria-label="Remove deposit" onClick={() => setPpfDeposits(list => list.length > 1 ? list.filter((_, j) => j !== i) : list)} style={smallBtn}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button type="button" style={addRowBtn} onClick={() => setPpfDeposits(list => [...list, { date: todayISO(), amount: 0 }])}>
                <Plus size={13} /> Add deposit
              </button>
            </div>
            <Field label="Interest credited so far (optional)">
              <input className="nw-input" type="number" inputMode="decimal" min="0" placeholder="Total interest in your passbook" value={ppfInterest} onChange={e => setPpfInterest(e.target.value)} />
            </Field>
            {ppfPreview.totalDeposited > 0 && preview('Value today',
              `Invested ₹${ppfPreview.totalDeposited.toLocaleString('en-IN')} + interest ₹${ppfPreview.interestEarned.toLocaleString('en-IN')}`,
              rs(ppfPreview.balance))}
            {note('No PPF API exists, but the maths is fixed: interest on the lowest balance between the 5th and month-end, credited every 31 March.')}
          </>
        )}

        {/* ── NPS ──────────────────────────────────────────── */}
        {isNPS && (
          <>
            <Field label="Label">
              <input className="nw-input" placeholder="e.g. NPS Tier I" value={name} onChange={e => setName(e.target.value)} />
            </Field>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="nw-label">Add scheme</span>
              {searchBox(npsQuery, setNpsQuery, npsAllSchemes.length ? 'HDFC Pension Scheme E — Tier I…' : 'Loading schemes…', false)}
              {results(npsMatches.map(s => ({ key: s.schemeCode, name: s.schemeName, sub: s.schemeCode, on: false, pick: () => addNpsHolding(s) })))}
            </div>
            {npsHoldings.map(h => (
              <div key={h.schemeCode} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.schemeName}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                    {npsNavByCode[h.schemeCode] ? `NAV ₹${npsNavByCode[h.schemeCode].toFixed(4)}` : h.schemeCode}
                  </div>
                </div>
                <input className="nw-input" style={{ width: 110, flexShrink: 0 }} type="number" inputMode="decimal" min="0" step="0.0001" placeholder="Units" aria-label="Units"
                  value={h.units || ''} onChange={e => setNpsUnits(h.schemeCode, parseFloat(e.target.value) || 0)} />
                <button type="button" aria-label="Remove scheme" onClick={() => removeNpsHolding(h.schemeCode)} style={smallBtn}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {npsHoldings.some(h => h.units > 0)
              ? preview('Value today', 'Live corpus from daily NAVs', rs(npsLiveCorpus))
              : (
                <Field label="Or enter corpus manually">
                  <input className="nw-input" type="number" inputMode="decimal" min="0" placeholder="From your CRA statement" value={npsCorpusManual} onChange={e => setNpsCorpusManual(e.target.value)} />
                </Field>
              )}
            <Field label="Total contributed (optional)">
              <input className="nw-input" type="number" inputMode="decimal" min="0" placeholder="For gain tracking" value={investedAmount} onChange={e => setInvestedAmount(e.target.value)} />
            </Field>
            {note('Unit counts come from your CRA statement (login-only). Once entered, the corpus is valued live from daily NAVs.')}
          </>
        )}

        {/* ── Manual (cash, FD, real estate, vehicle, other, legacy EPF/PPF) ── */}
        {isManual && (
          <>
            <Field label="Name">
              <input className="nw-input" placeholder={`e.g. ${
                kind === 'epf_ppf' ? 'EPF, PPF, NPS' :
                kind === 'fd_rd' ? 'HDFC FD' :
                kind === 'post_office' ? 'NSC' :
                kind === 'cash' ? 'ICICI Savings' :
                kind === 'real_estate' ? 'Flat · Pune' :
                kind === 'vehicle' ? 'Honda City' : 'Anything else'
              }`} value={name} onChange={e => setName(e.target.value)} autoFocus={!item} required />
            </Field>
            {kind === 'post_office' && (
              <Field label="Scheme">
                <select className="nw-input" value={postOfficeScheme} onChange={e => setPostOfficeScheme(e.target.value)}>
                  <option value="">Choose a scheme (optional)</option>
                  {POST_OFFICE_SCHEMES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            )}
            <div style={two}>
              <Field label="Current value">
                <input className="nw-input" type="number" inputMode="decimal" min="0" placeholder="₹0" value={manualValue} onChange={e => setManualValue(e.target.value)} required />
              </Field>
              <Field label="Invested (optional)">
                <input className="nw-input" type="number" inputMode="decimal" min="0" placeholder="₹0" value={investedAmount} onChange={e => setInvestedAmount(e.target.value)} />
              </Field>
            </div>
            {note('Add what you paid to see returns for this holding.')}
          </>
        )}

        {links && links.count > 0 && note(
          `${links.unit === 'g' ? `${links.linked}g` : `₹${links.linked.toLocaleString('en-IN')}`} of this comes from ${links.count} linked transaction${links.count === 1 ? '' : 's'}; ${links.unit === 'g' ? `${links.historical}g` : `₹${links.historical.toLocaleString('en-IN')}`} is historical.`,
        )}

        <SheetActions onCancel={onClose} primary={saving ? 'Saving…' : item ? 'Save changes' : 'Add holding'} submit disabled={saving || !canSubmit} />
      </form>
    </Sheet>
  )
}
