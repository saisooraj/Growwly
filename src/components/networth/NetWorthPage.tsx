'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { useAppStore } from '@/store/appStore'
import { usePrivacy } from '@/store/privacyStore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import { addAsset, updateAsset, deleteAsset, addLiability, updateLiability, deleteLiability, setEmergencyFund, setUserSettings } from '@/lib/firestore'
import AddTransactionModal from '@/components/transactions/AddTransactionModal'
import { buildMonthlySummary, buildSavingsByVehicle, EMERGENCY_FUND_VEHICLE, getCycleMonth, isSavingsTransfer } from '@/lib/utils'
import { getCycleRange } from '@/lib/cycle'
import { growthSince, lifetimeReturns } from '@/lib/wealthGrowth'
import { linkedTransactionIds, vehicleKinds } from '@/lib/holdingLinks'
import { calcEMI, calcOutstanding, monthsRemaining } from '@/lib/loans'
import { computeValue, type AssetWithValue } from '@/lib/assetValuation'
import { useLivePricesState } from '@/hooks/useLivePrices'
import { usePullToRefresh } from '@/components/layout/PullToRefresh'
import { useFirePlan } from '@/hooks/useFirePlan'
import FireSummaryCard from '@/components/fire/FireSummaryCard'
import type { Asset, AssetKind, Liability, LiabilityKind, Transaction } from '@/types'
import AssetModal from './AssetModal'
import LinkSavingsModal from './LinkSavingsModal'
import LiabilityModal from './LiabilityModal'
import MyAssetsSection, { holdingName } from './MyAssetsSection'
import MutualFundProjection from './MutualFundProjection'
import WealthTabs from './WealthTabs'
import EmergencyFundTransactions, { useEfTransactions } from './EmergencyFundTransactions'
import EfPaybackBanner from '@/components/emergency/EfPayback'
import { DeleteSheet, HoldingSheet, LiabilitySheet, UnlinkedSheet, type LiabilityView } from './NetWorthSheets'
import { CARD, EYEBROW, PILL_BTN, PrivacySwitch, Tap, ZoneHead, maskWith, monogram, pc, rs } from './nwUi'

// ── Liability metadata ────────────────────────────────────────────────────────

const LIABILITY_META: Record<LiabilityKind, { label: string; mono: string }> = {
  home_loan:     { label: 'Home Loan',     mono: 'HL' },
  car_loan:      { label: 'Car Loan',      mono: 'CL' },
  personal_loan: { label: 'Personal Loan', mono: 'PL' },
  credit_card:   { label: 'Credit Card',   mono: 'CC' },
  other:         { label: 'Other',         mono: 'LN' },
}

// Gain / loss on the hero gradient. Fixed light tints (not theme tokens) so they read on
// every accent colour the hero can take.
const HERO_GAIN = 'oklch(0.93 0.14 150)'
const HERO_LOSS = 'oklch(0.88 0.09 25)'
const GLASS = { background: 'rgba(255,255,255,.13)', border: '1px solid rgba(255,255,255,.2)' }
const LIVE_KINDS: AssetKind[] = ['mutual_fund', 'stocks', 'gold_grams', 'nps']

type SheetState =
  | { type: 'holding'; id: string }
  | { type: 'unlinked'; name: string }
  | { type: 'liability'; id: string }
  | { type: 'deleteAsset'; id: string }
  | { type: 'deleteLiability'; id: string }
  | null

// ── Hero loading (shown until holdings are valued at today's prices) ───────────

function HeroLoading() {
  return (
    <div aria-busy style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div aria-hidden style={{ width: 34, height: 34, position: 'relative', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,.6)', animation: 'nw-ripple 1.2s ease-out infinite' }} />
          <div style={{ width: 16, height: 16, background: '#fff', borderRadius: '50% 0 50% 50%', transform: 'rotate(-45deg)', animation: 'nw-drop 1.2s cubic-bezier(.5,0,.5,1) infinite' }} />
        </div>
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 700 }}>Calculating your net worth</div>
          <div style={{ fontSize: 12.5, opacity: 0.82, marginTop: 2 }}>Valuing your holdings at today&apos;s prices</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {([['62%', 44], ['46%', 30], ['80%', 12], ['100%', 62]] as const).map(([w, h], i) => (
          <div key={i} style={{
            width: w, height: h, borderRadius: i === 3 ? 16 : 10,
            background: 'linear-gradient(90deg, rgba(255,255,255,.12) 20%, rgba(255,255,255,.3) 50%, rgba(255,255,255,.12) 80%)',
            backgroundSize: '200% 100%', animation: 'nw-shim 1.5s linear infinite', animationDelay: `${i * 0.12}s`,
          }} />
        ))}
      </div>
    </div>
  )
}

function HoldingsSkeleton() {
  return (
    <div aria-busy style={{ ...CARD, order: 3, padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={EYEBROW}>SAVINGS &amp; INVESTMENTS</div>
      <span className="nw-skel" style={{ width: 170, height: 28 }} />
      <span className="nw-skel" style={{ height: 46 }} />
      {[0, 1, 2].map(i => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="nw-skel" style={{ width: 10, height: 28, borderRadius: 4, flex: 'none' }} />
          <span className="nw-skel" style={{ flex: 1, height: 14 }} />
          <span className="nw-skel" style={{ width: 80, height: 14, flex: 'none' }} />
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NetWorthPage() {
  const { user } = useAuth()
  const { assets, liabilities, emergencyFund, transactions, settings, initialized } = useAppStore()
  const refresh = useRefreshData()
  const router = useRouter()

  // One page-level privacy switch, shared with the Overview; tapping the hero figure flips it too
  const masked = usePrivacy(s => s.masked)
  const toggleMask = usePrivacy(s => s.toggle)
  const hydratePrivacy = usePrivacy(s => s.hydrate)
  useEffect(() => { hydratePrivacy() }, [hydratePrivacy])
  const M = maskWith(masked)

  const [sheet, setSheet] = useState<SheetState>(null)
  const [assetModal, setAssetModal] = useState<{ open: boolean; item?: Asset }>({ open: false })
  const [liabilityModal, setLiabilityModal] = useState<{ open: boolean; item?: Liability }>({ open: false })
  const [savingsModalOpen, setSavingsModalOpen] = useState(false)
  const [unitsTx, setUnitsTx] = useState<Transaction | null>(null)
  const [openKind, setOpenKind] = useState<AssetKind | null>(null)
  const [attnOpen, setAttnOpen] = useState(true)

  // Start of the current salary cycle: "this cycle" for the growth figures below
  const cycleStart = useMemo(() => getCycleRange(getCycleMonth(settings), settings).start, [settings])
  const hasCycle = !!settings?.salaryCycleRule && settings.salaryCycleRule !== 'none'
  const { prices, loaded: pricesLoaded, refresh: refreshPrices } = useLivePricesState(assets, cycleStart)
  const [pricesAt, setPricesAt] = useState<Date | null>(null)
  useEffect(() => { if (pricesLoaded) setPricesAt(new Date()) }, [prices, pricesLoaded])

  // Until data and prices are in, holdings would be valued at cost and then jump. Show a loader
  // instead and let the real figures settle in together. Coming back with cached prices skips it.
  const valuesReady = initialized && pricesLoaded
  const [settled, setSettled] = useState(valuesReady)
  const [loaderShownLongEnough, setLoaderShownLongEnough] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setLoaderShownLongEnough(true), 500) // no blink when prices are quick
    return () => clearTimeout(t)
  }, [])
  useEffect(() => { if (valuesReady && loaderShownLongEnough) setSettled(true) }, [valuesReady, loaderShownLongEnough])

  // "↻ Prices" and pull-to-refresh fetch fresh market prices and replay the hero's reveal
  const [refreshing, setRefreshing] = useState(false)
  const reloadPrices = useCallback(async () => {
    setRefreshing(true)
    const t0 = Date.now()
    try { await refreshPrices() } finally {
      setTimeout(() => setRefreshing(false), Math.max(0, 600 - (Date.now() - t0)))
    }
  }, [refreshPrices])
  usePullToRefresh(reloadPrices)

  const heroLoading = !settled || refreshing
  // Reveal: figure → lifetime chip → cycle pill → split → tiles, 80ms apart
  const [revealed, setRevealed] = useState(!heroLoading)
  useEffect(() => {
    if (heroLoading) { setRevealed(false); return }
    let inner = 0
    const outer = requestAnimationFrame(() => { inner = requestAnimationFrame(() => setRevealed(true)) })
    return () => { cancelAnimationFrame(outer); cancelAnimationFrame(inner) }
  }, [heroLoading])
  const rv = (delay: number, rise = false) => ({
    opacity: revealed ? 1 : 0,
    transform: rise ? (revealed ? 'none' : 'translateY(8px)') : undefined,
    transition: `opacity .5s ease ${delay}s${rise ? `, transform .6s cubic-bezier(.2,.7,.2,1) ${delay}s` : ''}`,
  })

  const valuedAssets = useMemo(() => assets.map(a => computeValue(a, prices)), [assets, prices])
  const firePlan = useFirePlan(valuedAssets, prices)
  const fireScenario = settings?.fire?.scenario ?? 'moderate'
  const holdingsValue = useMemo(() => valuedAssets.reduce((s, a) => s + a.currentValue, 0), [valuedAssets])
  const avgSpend = Math.max(0, firePlan.data.monthlyExpenses.auto)

  // EF transactions — expanded and scrolled to when arriving from the home card (#emergency-fund)
  const efTransactions = useEfTransactions(transactions)
  const [efTxOpen, setEfTxOpen] = useState(false)
  const efCardRef = useRef<HTMLDivElement>(null)
  const efScrolled = useRef(false)
  useEffect(() => {
    if (efScrolled.current || !emergencyFund || window.location.hash !== '#emergency-fund') return
    efScrolled.current = true
    setEfTxOpen(true)
    requestAnimationFrame(() => efCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [emergencyFund])

  // EF inline edit
  const [efEditing, setEfEditing] = useState(false)
  const [efBalance, setEfBalance] = useState('')
  const [efTarget, setEfTarget] = useState('')
  const [efSaving, setEfSaving] = useState(false)

  function openEfEdit() {
    setEfBalance(emergencyFund?.currentBalance ? String(emergencyFund.currentBalance) : '')
    setEfTarget(emergencyFund?.targetAmount ? String(emergencyFund.targetAmount) : avgSpend > 0 ? String(Math.round(avgSpend * 6)) : '')
    setEfEditing(true)
  }

  async function saveEf() {
    if (!user) return
    setEfSaving(true)
    try {
      await setEmergencyFund(user.uid, {
        targetAmount:   Number(efTarget)  || emergencyFund?.targetAmount  || 0,
        currentBalance: Number(efBalance) || 0,
        usedAmount:     emergencyFund?.usedAmount ?? 0,
        lastUpdated:    new Date().toISOString(),
      })
      await refresh()
      setEfEditing(false)
      toast.success('Emergency fund updated')
    } catch { toast.error('Failed to save') }
    finally { setEfSaving(false) }
  }

  // Savings vehicles (transaction-derived), excluding Emergency Fund. A savings transaction
  // linked to a holding is already inside that holding's value, so it is left out here —
  // each rupee is counted in exactly one place.
  const openingBalances = settings?.savingsOpeningBalances ?? {}
  const linkedIds = useMemo(() => linkedTransactionIds(assets), [assets])
  const savingsVehicles = useMemo(() => {
    const byVehicle = buildSavingsByVehicle(transactions.filter(t => !linkedIds.has(t.id)), openingBalances)
    return Object.entries(byVehicle)
      .filter(([name, v]) => name !== EMERGENCY_FUND_VEHICLE && v.balance > 0)
      .map(([name, v]) => ({ name, mono: monogram(name), opening: v.opening, balance: v.balance }))
      .sort((a, b) => b.balance - a.balance)
  }, [transactions, openingBalances, linkedIds])
  const savingsTotal = useMemo(() => savingsVehicles.reduce((s, v) => s + v.balance, 0), [savingsVehicles])
  const awaiting = valuedAssets.filter(a => a.pendingTransactionIds.length > 0)
  const awaitingTotal = awaiting.reduce((s, a) => s + Math.abs(a.pendingAmount), 0)
  const attnCount = savingsVehicles.length + awaiting.length

  // Linking a whole Unlinked savings row to a holding, optionally creating the holding first
  const [linkFlow, setLinkFlow] = useState<{ vehicle: string; holdingId?: string } | null>(null)
  const [creatingFor, setCreatingFor] = useState<string | null>(null)
  // Same vehicle naming as buildSavingsByVehicle, so the rows and their transactions agree
  const unlinkedFor = (vehicle: string) => transactions.filter(t =>
    isSavingsTransfer(t) && !linkedIds.has(t.id) &&
    (t.savingsVehicle || (t.transferKind === 'ef_withdrawal' ? EMERGENCY_FUND_VEHICLE : 'Other Savings')) === vehicle)
  const presetFor = (vehicle: string) => {
    const kind = vehicleKinds(vehicle)[0] ?? 'other'
    const rupeeBalance = ['post_office', 'fd_rd', 'cash', 'other'].includes(kind)
    return {
      kind, name: vehicle,
      note: rupeeBalance
        ? `Starts at ₹0. Your unlinked ${vehicle} savings move into it next.`
        : `Once it's added, your unlinked ${vehicle} savings move into it.`,
    }
  }

  // Savings put in this salary cycle, less anything pulled back out: what this cycle added to net worth
  const savedThisCycle = useMemo(() => {
    const s = buildMonthlySummary(transactions, getCycleMonth(settings), settings)
    return s.savingsContributed - s.savingsWithdrawn
  }, [transactions, settings])

  const totalAssets = holdingsValue + (emergencyFund?.currentBalance ?? 0) + savingsTotal

  const liabilityViews: LiabilityView[] = useMemo(() => liabilities.map(l => {
    const meta = LIABILITY_META[l.kind] ?? LIABILITY_META.other
    const outstanding = l.tenureMonths > 0 ? calcOutstanding(l.principal, l.interestRate, l.tenureMonths, l.startDate) : l.principal
    const remaining = l.tenureMonths > 0 ? monthsRemaining(l.tenureMonths, l.startDate) : null
    const card = l.kind === 'credit_card' || !(l.tenureMonths > 0)
    return {
      item: l, mono: meta.mono, label: meta.label, outstanding: Math.round(outstanding), remaining,
      emi: Math.round(l.emiAmount ?? (l.tenureMonths > 0 ? calcEMI(l.principal, l.interestRate, l.tenureMonths) : 0)),
      paidPct: card ? null : Math.max(0, Math.min(100, 100 - (outstanding / l.principal) * 100)),
      meta: card && l.kind === 'credit_card' ? 'Credit Card · balance only'
        : `${meta.label}${l.interestRate > 0 ? ` · ${l.interestRate}% p.a.` : ''}${remaining !== null ? ` · ${remaining} EMIs left` : ''}`,
    }
  }), [liabilities])
  const totalLiabilities = liabilityViews.reduce((s, l) => s + l.outstanding, 0)
  const netWorth = totalAssets - totalLiabilities
  const isNew = assets.length === 0 && liabilities.length === 0 && !emergencyFund && savingsVehicles.length === 0

  // What holdings have earned overall, and what this cycle brought in: money added (logged
  // savings plus EPF's own monthly credit) and what holdings earned on top of it.
  const lifetime = useMemo(() => lifetimeReturns(valuedAssets), [valuedAssets])
  const growth = useMemo(() => growthSince(valuedAssets, prices, cycleStart), [valuedAssets, prices, cycleStart])
  const added = savedThisCycle + growth.added
  const returns = growth.ready ? Math.round(growth.returns) : 0
  const grew = Math.round(added + returns)
  // As a share of net worth before this cycle (hidden when that base isn't positive)
  const before = netWorth - grew
  const grewPct = before > 0 && grew !== 0 ? (grew / before) * 100 : null
  const ratio = totalLiabilities ? totalAssets / totalLiabilities : 0
  const ownText = !totalLiabilities ? (isNew ? 'Nothing added yet' : 'Nothing owed. Everything here is yours.')
    : ratio >= 1 ? `You own ₹${ratio.toFixed(2)} for every ₹1 you owe` : 'You owe more than you own right now'
  const hasLive = assets.some(a => LIVE_KINDS.includes(a.kind))

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function handleSaveAsset(data: Omit<Asset, 'id' | 'userId' | 'createdAt' | 'updatedAt'>, id?: string) {
    if (!user) return
    if (id) await updateAsset(id, data); else await addAsset(user.uid, data)
    await refresh(); setAssetModal({ open: false }); toast.success(id ? 'Updated' : 'Holding added')
  }

  async function handleSaveLiability(data: Omit<Liability, 'id' | 'userId' | 'createdAt' | 'updatedAt'>, id?: string) {
    if (!user) return
    if (id) await updateLiability(id, data); else await addLiability(user.uid, data)
    await refresh(); setLiabilityModal({ open: false }); toast.success(id ? 'Updated' : 'Liability added')
  }

  async function savePrior(vehicle: string, amount: number) {
    if (!user) return
    try {
      await setUserSettings(user.uid, { savingsOpeningBalances: { ...openingBalances, [vehicle]: amount } })
      await refresh()
      toast.success('Prior balance saved')
    } catch { toast.error('Failed to save') }
  }

  function addUnits(a: AssetWithValue) {
    const tx = transactions.find(t => t.id === a.pendingTransactionIds[0])
    if (tx) { setSheet(null); setUnitsTx(tx) }
    else toast.error('Couldn’t find that transaction')
  }

  // A holding's transactions: filtered to its savings vehicle when they all share one
  function viewHoldingTransactions(a: Asset) {
    const ids = linkedTransactionIds([a])
    const vehicles = new Set(transactions.filter(t => ids.has(t.id)).map(t => t.savingsVehicle).filter(Boolean))
    const v = vehicles.size === 1 ? Array.from(vehicles)[0] : null
    router.push(v ? `/transactions?type=savings&vehicle=${encodeURIComponent(v)}` : '/transactions?type=savings')
  }

  const sheetAsset = sheet && (sheet.type === 'holding' || sheet.type === 'deleteAsset') ? valuedAssets.find(a => a.id === sheet.id) : undefined
  const sheetLiab = sheet && (sheet.type === 'liability' || sheet.type === 'deleteLiability') ? liabilityViews.find(l => l.item.id === sheet.id) : undefined
  const sheetVehicle = sheet?.type === 'unlinked' ? savingsVehicles.find(v => v.name === sheet.name) : undefined

  // ── Render ───────────────────────────────────────────────────────────────────

  const ef = emergencyFund
  const efPct = ef ? (ef.currentBalance / (ef.targetAmount || 1)) * 100 : 0
  const runway = ef && avgSpend > 0 ? ef.currentBalance / avgSpend : null
  const cycleColor = grew > 0 ? 'oklch(0.45 0.13 150)' : grew < 0 ? 'oklch(0.5 0.17 27)' : '#62646a'
  const hasSplit = added !== 0 || returns !== 0

  return (
    <div className="nw-scope nw-page anim-page">
      {/* Header: title, price refresh (desktop), privacy switch, tabs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h1 className="nw-title" style={{ margin: 0, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.4 }}>Wealth</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={reloadPrices} disabled={refreshing} className="nw-desk"
              style={{ alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              ↻ {refreshing ? 'Updating…' : pricesAt ? `Prices ${format(pricesAt, 'HH:mm')}` : 'Prices'}
            </button>
            <PrivacySwitch />
          </div>
        </div>
        <WealthTabs active="networth" />
      </div>

      {/* Net worth hero */}
      <div className="nw-hero" style={{
        position: 'relative', overflow: 'hidden', borderRadius: 26, color: '#fff', boxShadow: 'var(--hero-shadow)',
        background: 'radial-gradient(90% 70% at 100% 0%, rgba(255,255,255,.26), rgba(255,255,255,0) 55%), linear-gradient(155deg, var(--brand-deep), var(--brand) 55%, var(--brand-2))',
      }}>
        {heroLoading ? <HeroLoading /> : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '22px 36px' }}>
            <div style={{ flex: '1 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span className="nw-mono" style={{ fontSize: 10.5, letterSpacing: '.14em', opacity: 0.82 }}>NET WORTH</span>
                {hasLive && pricesAt && (
                  <span className="nw-mono" style={{ fontSize: 10, letterSpacing: '.08em', padding: '4px 8px', borderRadius: 999, background: 'rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: HERO_GAIN }} />LIVE PRICES · {format(pricesAt, 'HH:mm')}
                  </span>
                )}
              </div>
              <button
                type="button" onClick={toggleMask} aria-label={masked ? 'Show amounts' : 'Hide amounts'} className="nw-hero-num nw-num"
                style={{ border: 'none', background: 'none', padding: 0, margin: 0, textAlign: 'left', alignSelf: 'flex-start', cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 4, fontWeight: 700, letterSpacing: '-.035em', lineHeight: 1, color: netWorth < 0 && !masked ? 'oklch(0.9 0.08 25)' : '#fff', ...rv(0, true) }}
              >
                <span style={{ fontWeight: 500, opacity: 0.85 }}>{netWorth < 0 ? '−' : ''}₹</span>
                <span>{masked ? '••••••' : Math.round(Math.abs(netWorth)).toLocaleString('en-IN')}</span>
              </button>
              {isNew && <div style={{ fontSize: 14, lineHeight: 1.45, opacity: 0.9, maxWidth: 320 }}>Add what you own and what you owe. We&apos;ll value it at today&apos;s prices.</div>}
              {lifetime.invested > 0 && (
                <div style={{ alignSelf: 'flex-start', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 10px', padding: '7px 12px', borderRadius: 12, ...GLASS, fontSize: 12.5, ...rv(0.08) }}
                  title="Across holdings with a purchase price: the money you put in, and what it has earned so far">
                  <span style={{ opacity: 0.85, whiteSpace: 'nowrap' }}>{M(rs(lifetime.invested))} invested</span>
                  <span style={{ fontWeight: 600, color: lifetime.returns >= 0 ? HERO_GAIN : HERO_LOSS, whiteSpace: 'nowrap' }}>
                    {M(rs(lifetime.returns, true))} returns{lifetime.pct !== null ? ` · ${pc(lifetime.pct)}` : ''}
                  </span>
                </div>
              )}
              {!isNew && (<>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px', ...rv(0.16, true) }}>
                  <div title="How much your net worth grew: money you added plus returns on your holdings"
                    style={{ display: 'flex', alignItems: 'center', height: 34, borderRadius: 999, background: '#fff', color: '#17181b', fontSize: 13.5, fontWeight: 700, boxShadow: '0 6px 18px -8px rgba(0,0,0,.35)', overflow: 'hidden' }}>
                    <span className="nw-num" style={{ padding: '0 12px 0 14px', color: cycleColor }}>{grew === 0 ? 'No change' : M(rs(grew, true))} {hasCycle ? 'this cycle' : 'this month'}</span>
                    {grewPct !== null && <>
                      <span style={{ height: 18, width: 1, background: '#e2e1db' }} />
                      <span className="nw-num" style={{ padding: '0 14px 0 12px', color: cycleColor }}>{pc(grewPct)}</span>
                    </>}
                  </div>
                  <span style={{ fontSize: 12, opacity: 0.78, whiteSpace: 'nowrap' }}>{hasCycle ? 'Since payday · ' : 'Since '}{format(parseISO(cycleStart), 'd MMM')}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...rv(0.24) }}>
                  {hasSplit ? (<>
                    <div style={{ display: 'flex', gap: 3, height: 8 }}>
                      <div style={{ flex: `${Math.abs(added)} 1 0px`, borderRadius: 4, background: 'rgba(255,255,255,.92)' }} />
                      <div style={{ flex: `${Math.abs(returns)} 1 0px`, borderRadius: 4, background: returns >= 0 ? HERO_GAIN : HERO_LOSS }} />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 12.5 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(255,255,255,.92)' }} />{added >= 0 ? 'Added' : 'Withdrawn'} {M(rs(Math.abs(added)))}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: returns >= 0 ? HERO_GAIN : HERO_LOSS }} />{growth.ready ? `Returns ${M(rs(returns, true))}` : 'Returns updating…'}</span>
                    </div>
                  </>) : (<>
                    <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,.16)' }} />
                    <div style={{ fontSize: 12.5, opacity: 0.8 }}>No money in or market movement yet this {hasCycle ? 'cycle' : 'month'}.</div>
                  </>)}
                </div>
              </>)}
            </div>

            <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'flex-end', ...rv(0.32) }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
                {([['TOTAL ASSETS', totalAssets], ['LIABILITIES', totalLiabilities]] as const).map(([k, v]) => (
                  <div key={k} style={{ padding: '12px 14px', borderRadius: 16, ...GLASS }}>
                    <div className="nw-mono" style={{ fontSize: 9.5, letterSpacing: '.12em', opacity: 0.8 }}>{k}</div>
                    <div className="nw-num" style={{ fontSize: 18, fontWeight: 700, marginTop: 6, letterSpacing: '-.01em' }}>{M(rs(v))}</div>
                  </div>
                ))}
              </div>
              {totalLiabilities > 0 && (
                <div style={{ display: 'flex', gap: 3, height: 6 }}>
                  <div style={{ flex: `${totalAssets} 1 0px`, borderRadius: 3, background: 'rgba(255,255,255,.85)' }} />
                  <div style={{ flex: `${totalLiabilities} 1 0px`, borderRadius: 3, background: HERO_LOSS }} />
                </div>
              )}
              <div style={{ fontSize: 12.5, opacity: 0.88 }}>{ownText}</div>
              {/* Needs monthly net worth snapshots; honest about it until there are two */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.18)' }}>
                <span className="nw-mono" style={{ fontSize: 9.5, letterSpacing: '.12em', opacity: 0.75 }}>TREND</span>
                <div style={{ flex: 1, position: 'relative', height: 10, display: 'flex', alignItems: 'center' }}>
                  <div style={{ flex: 1, borderTop: '1.5px dashed rgba(255,255,255,.35)' }} />
                  <span style={{ position: 'absolute', right: 0, width: 9, height: 9, borderRadius: '50%', background: '#fff', boxShadow: '0 0 0 4px rgba(255,255,255,.2)' }} />
                </div>
                <span style={{ fontSize: 11.5, opacity: 0.82 }}>Builds from next payday</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="nw-main">
        {/* Left on desktop: what I own, where it's heading */}
        <div className="nw-col nw-col-l">
          <ZoneHead title="What I own" right={M(rs(totalAssets))} order={1} />

          {/* Unlinked savings and holdings awaiting units: counted, but not fully set up */}
          {attnCount > 0 && (
            <div style={{ order: 2, background: 'var(--warn-soft)', borderRadius: 20, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button type="button" onClick={() => setAttnOpen(o => !o)} aria-expanded={attnOpen}
                style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: 0, border: 'none', background: 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                <span className="nw-mono" style={{ minWidth: 26, height: 26, borderRadius: 13, background: 'var(--warn)', color: '#1d1a10', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{attnCount}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>Needs a quick look</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{M(rs(savingsTotal + awaitingTotal))} counted, not fully set up</div>
                </div>
                <span aria-hidden style={{ fontSize: 20, color: 'var(--text-3)', transform: `rotate(${attnOpen ? 90 : 0}deg)`, transition: 'transform .25s' }}>›</span>
              </button>
              {attnOpen && (<>
                {savingsVehicles.length > 0 && (
                  <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.45, padding: '0 2px' }}>Counted in net worth, but not tied to a holding yet. Link them so they sit in the right place.</div>
                )}
                {savingsVehicles.map(v => (
                  <Tap key={v.name} onClick={() => setSheet({ type: 'unlinked', name: v.name })} label={v.name}
                    style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 10px 10px 12px', borderRadius: 14, background: 'var(--surface)' }}>
                    <span className="nw-mono" style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>{v.mono}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{M(rs(v.opening))} prior + {M(rs(v.balance - v.opening))} unlinked</div>
                    </div>
                    <span className="nw-num" style={{ fontSize: 13.5, fontWeight: 600 }}>{M(rs(v.balance))}</span>
                    <button type="button" onClick={e => { e.stopPropagation(); setLinkFlow({ vehicle: v.name }) }} aria-label={`Link ${v.name} to a holding`}
                      style={{ height: 32, padding: '0 12px', borderRadius: 999, border: 'none', background: 'var(--text)', color: 'var(--bg)', fontSize: 12, fontWeight: 700, cursor: 'pointer', flex: 'none' }}>Link</button>
                  </Tap>
                ))}
                {awaiting.map(a => (
                  <Tap key={a.id} onClick={() => setSheet({ type: 'holding', id: a.id })} label={holdingName(a)}
                    style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 10px 10px 12px', borderRadius: 14, background: 'var(--surface)' }}>
                    <span className="nw-mono" style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, background: 'var(--warn)', opacity: 0.9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#1d1a10' }}>{monogram(holdingName(a))}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{holdingName(a).split(' – ')[0]}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{M(rs(Math.abs(a.pendingAmount)))} awaiting units · counted at cost</div>
                    </div>
                    <button type="button" onClick={e => { e.stopPropagation(); addUnits(a) }}
                      style={{ height: 32, padding: '0 12px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none' }}>Add units</button>
                  </Tap>
                ))}
              </>)}
            </div>
          )}

          {!settled ? <HoldingsSkeleton /> : (
            <div style={{ order: 3 }}>
              <MyAssetsSection
                assets={valuedAssets} masked={masked} lifetime={lifetime} updating={refreshing}
                openKind={openKind} onOpenKind={setOpenKind}
                onAdd={() => setAssetModal({ open: true })}
                onLog={() => setSavingsModalOpen(true)}
                onOpen={a => setSheet({ type: 'holding', id: a.id })}
                onAddUnits={addUnits}
              />
            </div>
          )}

          <ZoneHead title="Where it's heading" order={8} />
          <div style={{ order: 9 }}>
            {/* Renders only when there are mutual fund holdings */}
            <MutualFundProjection assets={assets} masked={masked} />
          </div>
        </div>

        {/* Right on desktop: safety net, what I owe, independence */}
        <div className="nw-col nw-col-r">
          <ZoneHead title="Safety net" order={4} deskOnly />

          <div id="emergency-fund" ref={efCardRef} style={{ ...CARD, order: 5, padding: 18, display: 'flex', flexDirection: 'column', gap: 14, scrollMarginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span aria-hidden style={{ width: 36, height: 36, flex: 'none', borderRadius: '50%', border: '6px solid', borderColor: ef ? 'var(--warn) var(--warn-soft) var(--warn) var(--warn-soft)' : 'var(--surface-3) var(--surface-2) var(--surface-3) var(--surface-2)', transform: 'rotate(45deg)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Emergency fund</h3>
                {ef && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Target {M(rs(ef.targetAmount))}{runway != null ? ` · ${runway.toFixed(1)} mo runway` : ''}</div>}
              </div>
              {ef && <button onClick={openEfEdit} style={{ ...PILL_BTN, height: 32, fontSize: 12 }}>Edit</button>}
            </div>

            {efEditing ? (
              <form onSubmit={e => { e.preventDefault(); saveEf() }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                    <span className="nw-label">Current balance</span>
                    <input className="nw-input" type="number" inputMode="decimal" min="0" placeholder="₹0" value={efBalance} onChange={e => setEfBalance(e.target.value)} autoFocus />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                    <span className="nw-label">Target</span>
                    <input className="nw-input" type="number" inputMode="decimal" min="0" placeholder="₹0" value={efTarget} onChange={e => setEfTarget(e.target.value)} />
                  </label>
                </div>
                {avgSpend > 0 && Number(efTarget) > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{rs(Number(efTarget))} covers {(Number(efTarget) / avgSpend).toFixed(1)} months of your average spending.</div>
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setEfEditing(false)} style={{ height: 36, padding: '0 16px', borderRadius: 999, border: 'none', background: 'transparent', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={efSaving} style={{ height: 36, padding: '0 18px', borderRadius: 999, border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{efSaving ? 'Saving…' : 'Save'}</button>
                </div>
              </form>
            ) : ef ? (<>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <span className="nw-num" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.03em' }}>{M(rs(ef.currentBalance), false)}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-3)', marginLeft: 6 }}>of {M(rs(ef.targetAmount))}</span>
                </div>
                <span style={{ padding: '4px 9px', borderRadius: 999, background: 'var(--warn-soft)', color: 'var(--warn-ink)', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{Math.round(efPct)}% funded</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-3)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, efPct)}%`, borderRadius: 4, background: 'var(--warn)', transition: 'width .4s cubic-bezier(.4,0,.2,1)' }} />
              </div>
              {runway != null && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '11px 12px', borderRadius: 14, background: 'var(--surface-2)' }}>
                  <span className="nw-num" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em' }}>{runway.toFixed(1)}</span>
                  <div style={{ fontSize: 12, lineHeight: 1.35, color: 'var(--text-2)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>months of spending covered</div>
                    <div>Avg spend {M(rs(avgSpend))}/mo · {ef.currentBalance >= ef.targetAmount ? 'target reached' : `${M(rs(ef.targetAmount - ef.currentBalance))} to target`}</div>
                  </div>
                </div>
              )}
              <div className="ov empty:hidden"><EfPaybackBanner compact /></div>
              <EmergencyFundTransactions transactions={efTransactions} open={efTxOpen} onToggle={() => setEfTxOpen(v => !v)} masked={masked} />
            </>) : (<>
              <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.45 }}>Set up your emergency fund to track your financial safety net.</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '10px 12px', borderRadius: 12, background: 'var(--surface-2)' }}>
                {avgSpend > 0 ? `Tip: 6 months of your spending is about ${M(rs(Math.round(avgSpend * 6)))}.` : 'A common goal is 3–6 months of your spending.'}
              </div>
              <button onClick={openEfEdit} style={{ alignSelf: 'flex-start', height: 38, padding: '0 16px', borderRadius: 999, border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Set up</button>
            </>)}
          </div>

          <ZoneHead title="What I owe" right={M(rs(totalLiabilities))} order={6} />

          <div style={{ ...CARD, order: 7, padding: '18px 18px 8px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingBottom: 12 }}>
              <div>
                <div style={EYEBROW}>LIABILITIES &amp; LOANS</div>
                <div className="nw-num" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.03em', marginTop: 6, color: totalLiabilities ? 'var(--bad-ink)' : 'var(--text)' }}>{M(rs(totalLiabilities))}</div>
              </div>
              <button onClick={() => setLiabilityModal({ open: true })} style={{ ...PILL_BTN, padding: '0 14px', fontWeight: 700 }}>+ Add</button>
            </div>
            {liabilityViews.length === 0 ? (
              <div style={{ borderTop: '1px solid var(--border)', padding: '16px 0 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span aria-hidden style={{ width: 36, height: 36, flex: 'none', borderRadius: '50%', background: 'var(--good-soft)', color: 'var(--good-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>✓</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>No liabilities. Great shape!</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Add a loan or card if you take one on.</div>
                </div>
              </div>
            ) : liabilityViews.map(l => (
              <Tap key={l.item.id} onClick={() => setSheet({ type: 'liability', id: l.item.id })} label={l.item.name}
                style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '13px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span className="nw-mono" style={{ width: 36, height: 36, flex: 'none', borderRadius: 11, background: 'var(--bad-soft)', color: 'var(--bad-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700 }}>{l.mono}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{l.item.name}</span>
                      {l.paidPct != null && l.paidPct >= 90 && <span style={{ padding: '2px 7px', borderRadius: 999, background: 'var(--good-soft)', color: 'var(--good-ink)', fontSize: 10.5, fontWeight: 700 }}>Almost done</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>{l.meta}</div>
                  </div>
                  <div style={{ textAlign: 'right', flex: 'none' }}>
                    <div className="nw-num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--bad-ink)' }}>{M(rs(l.outstanding))}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{l.emi > 0 && l.paidPct != null ? `EMI ${M(rs(l.emi))}/mo` : 'Balance only'}</div>
                  </div>
                </div>
                {l.paidPct != null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 48 }}>
                    <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--surface-3)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${l.paidPct}%`, background: 'var(--good)', borderRadius: 3 }} />
                    </div>
                    <span className="nw-mono" style={{ fontSize: 10.5, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{Math.round(l.paidPct)}% paid off</span>
                  </div>
                )}
              </Tap>
            ))}
          </div>

          <ZoneHead title="Independence" order={10} deskOnly />
          <div style={{ order: 11 }}>
            <FireSummaryCard plan={firePlan} scenario={fireScenario} targetRetirementAge={settings?.fire?.targetRetirementAge} targetYears={settings?.fire?.targetYears} masked={masked} />
          </div>

        </div>
      </div>

      {/* ── Sheets ─────────────────────────────────────────────────────────── */}
      {sheet?.type === 'holding' && sheetAsset && (
        <HoldingSheet
          asset={sheetAsset} prices={prices} masked={masked} onClose={() => setSheet(null)}
          onEdit={() => { setSheet(null); setAssetModal({ open: true, item: assets.find(a => a.id === sheetAsset.id) }) }}
          onLog={() => { setSheet(null); setSavingsModalOpen(true) }}
          onView={() => viewHoldingTransactions(sheetAsset)}
          onDelete={() => setSheet({ type: 'deleteAsset', id: sheetAsset.id })}
          onAddUnits={() => addUnits(sheetAsset)}
        />
      )}
      {sheet?.type === 'deleteAsset' && sheetAsset && (
        <DeleteSheet
          title={`Delete ${holdingName(sheetAsset).split(' – ')[0]}?`}
          body={`This removes ${M(rs(sheetAsset.currentValue))} from your net worth. Its transactions stay in Transactions.`}
          onClose={() => setSheet(null)}
          onConfirm={async () => { await deleteAsset(sheetAsset.id); await refresh(); setSheet(null); toast.success('Deleted') }}
        />
      )}
      {sheet?.type === 'liability' && sheetLiab && (
        <LiabilitySheet
          l={sheetLiab} masked={masked} onClose={() => setSheet(null)}
          onEdit={() => { setSheet(null); setLiabilityModal({ open: true, item: sheetLiab.item }) }}
          onDelete={() => setSheet({ type: 'deleteLiability', id: sheetLiab.item.id })}
        />
      )}
      {sheet?.type === 'deleteLiability' && sheetLiab && (
        <DeleteSheet
          title={`Delete ${sheetLiab.item.name}?`}
          body={`This takes ${M(rs(sheetLiab.outstanding))} off what you owe.`}
          onClose={() => setSheet(null)}
          onConfirm={async () => { await deleteLiability(sheetLiab.item.id); await refresh(); setSheet(null); toast.success('Deleted') }}
        />
      )}
      {sheet?.type === 'unlinked' && sheetVehicle && (
        <UnlinkedSheet
          vehicle={sheetVehicle} masked={masked} onClose={() => setSheet(null)}
          onSavePrior={async amount => { await savePrior(sheetVehicle.name, amount); setSheet(null) }}
          onLink={() => { setSheet(null); setLinkFlow({ vehicle: sheetVehicle.name }) }}
        />
      )}

      {assetModal.open && (
        <AssetModal item={assetModal.item} onSave={handleSaveAsset} onClose={() => setAssetModal({ open: false })} />
      )}
      {linkFlow && (
        <LinkSavingsModal
          key={`${linkFlow.vehicle}:${linkFlow.holdingId ?? ''}`}
          vehicle={linkFlow.vehicle}
          transactions={unlinkedFor(linkFlow.vehicle)}
          opening={openingBalances[linkFlow.vehicle] ?? 0}
          openingBalances={openingBalances}
          assets={assets}
          initialHoldingId={linkFlow.holdingId}
          onCreateNew={() => { setCreatingFor(linkFlow.vehicle); setLinkFlow(null) }}
          onClose={() => setLinkFlow(null)}
        />
      )}
      {creatingFor && (
        <AssetModal
          preset={presetFor(creatingFor)}
          onSave={async data => {
            if (!user) return
            const id = await addAsset(user.uid, data)
            toast.success('Holding added')
            setLinkFlow({ vehicle: creatingFor, holdingId: id })
            setCreatingFor(null)
          }}
          // Backing out returns to the link step rather than dropping the whole flow
          onClose={() => { setLinkFlow({ vehicle: creatingFor }); setCreatingFor(null) }}
        />
      )}
      {liabilityModal.open && (
        <LiabilityModal item={liabilityModal.item} onSave={handleSaveLiability} onClose={() => setLiabilityModal({ open: false })} />
      )}
      <AddTransactionModal open={savingsModalOpen} initialTab="savings" onClose={() => { setSavingsModalOpen(false); refresh() }} />
      <AddTransactionModal open={!!unitsTx} editTx={unitsTx} onClose={() => { setUnitsTx(null); refresh() }} />
    </div>
  )
}
