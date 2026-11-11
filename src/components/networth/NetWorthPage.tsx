'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Pencil, Trash2, Home, Car, Landmark, CreditCard, Package, Wallet, Eye, EyeOff, ExternalLink, Plus, TrendingUp, TrendingDown, BarChart2, Coins, Mailbox, Link2 } from 'lucide-react'
import { IconLifebuoy } from '@tabler/icons-react'
import { useAppStore } from '@/store/appStore'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { useRefreshData } from '@/hooks/useData'
import { addAsset, updateAsset, deleteAsset, addLiability, updateLiability, deleteLiability, setEmergencyFund, setUserSettings } from '@/lib/firestore'
import AddTransactionModal from '@/components/transactions/AddTransactionModal'
import { formatCurrency, formatCurrencyFull, buildMonthlySummary, buildSavingsByVehicle, EMERGENCY_FUND_VEHICLE, getLast6Months, getCycleMonth, isSavingsTransfer } from '@/lib/utils'
import { getCycleRange } from '@/lib/cycle'
import { growthSince, lifetimeReturns } from '@/lib/wealthGrowth'
import { linkedTransactionIds, vehicleKinds } from '@/lib/holdingLinks'
import { calcEMI, calcOutstanding, monthsRemaining } from '@/lib/loans'
import { getSavingsVehicleMeta } from '@/lib/categoryIcons'
import { computeValue } from '@/lib/assetValuation'
import { useLivePricesState } from '@/hooks/useLivePrices'
import { usePullToRefresh } from '@/components/layout/PullToRefresh'
import LoadingDrop from '@/components/ui/LoadingDrop'
import type { Asset, AssetKind, Liability, LiabilityKind, Transaction } from '@/types'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import AssetModal from './AssetModal'
import LinkSavingsModal from './LinkSavingsModal'
import LiabilityModal from './LiabilityModal'
import MyAssetsSection from './MyAssetsSection'
import MutualFundProjection from './MutualFundProjection'
import MaskToggle from './MaskToggle'
import Link from 'next/link'
import FireSummaryCard, { fireStripText } from '@/components/fire/FireSummaryCard'
import { useFirePlan } from '@/hooks/useFirePlan'
import WealthTabs from './WealthTabs'
import EmergencyFundTransactions, { useEfTransactions } from './EmergencyFundTransactions'

// ── Asset / Liability metadata ─────────────────────────────────────────────────

const ASSET_META: Record<AssetKind, { label: string; icon: React.ElementType; color: string }> = {
  cash:         { label: 'Cash & Savings',  icon: Wallet,     color: 'var(--good)' },
  fd_rd:        { label: 'FD / RD',         icon: Landmark,   color: 'var(--info)' },
  post_office:  { label: 'Post Office',      icon: Mailbox,    color: 'var(--info)' },
  gold_grams:   { label: 'Gold (grams)',     icon: Coins,      color: '#f59e0b' },
  mutual_fund:  { label: 'Mutual Funds',     icon: TrendingUp, color: 'var(--brand)' },
  stocks:       { label: 'Stocks',           icon: BarChart2,  color: 'var(--brand-deep)' },
  real_estate:  { label: 'Real Estate',      icon: Home,       color: 'var(--warn)' },
  vehicle:      { label: 'Vehicle',          icon: Car,        color: 'var(--text-3)' },
  epf:          { label: 'EPF',              icon: Landmark,   color: 'var(--info)' },
  ppf:          { label: 'PPF',              icon: Landmark,   color: 'var(--info)' },
  nps:          { label: 'NPS',              icon: Landmark,   color: 'var(--info)' },
  epf_ppf:      { label: 'EPF / PPF / NPS', icon: Landmark,   color: 'var(--info)' },
  other:        { label: 'Other Asset',      icon: Package,    color: 'var(--text-3)' },
}

const LIABILITY_META: Record<LiabilityKind, { label: string; icon: React.ElementType; color: string }> = {
  home_loan:     { label: 'Home Loan',       icon: Home,       color: 'var(--bad)' },
  car_loan:      { label: 'Car Loan',        icon: Car,        color: 'var(--bad)' },
  personal_loan: { label: 'Personal Loan',   icon: Wallet,     color: 'var(--bad)' },
  credit_card:   { label: 'Credit Card',     icon: CreditCard, color: 'var(--warn)' },
  other:         { label: 'Other Liability', icon: Package,    color: 'var(--bad)' },
}

const MASK = '₹ •••'
// Gain / loss text on the hero gradient. Fixed light tints (not theme tokens) so they read on
// every accent colour the hero can take.
const HERO_GAIN = 'oklch(0.93 0.14 150)'
const HERO_LOSS = 'oklch(0.88 0.09 25)'

const pctText = (p: number) => `${p >= 0 ? '+' : '−'}${Math.abs(p) < 0.1 ? '<0.1' : Math.abs(p).toFixed(1)}%`

function SectionHeader({ title, onAdd, extra }: { title: string; onAdd: () => void; extra?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{title}</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {extra}
        <button
          onClick={onAdd}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--surface)', color: 'var(--text-2)',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}
        >
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  )
}

// ── Inline SVG sparkline ─────────────────────────────────────────────────────

function Sparkline({ data, width = 280, height = 44, color = 'rgba(255,255,255,.88)', strokeW = 2.5 }: {
  data: number[]; width?: number; height?: number; color?: string; strokeW?: number
}) {
  if (data.length < 2) return null
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    height - ((v - min) / range) * (height - 8) - 4,
  ])
  const d = 'M' + pts.map(p => p.map((n: number) => n.toFixed(1)).join(',')).join(' L')
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible', marginLeft: -4 }}>
      <path d={d} fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round"
        style={{ strokeDasharray: 800, strokeDashoffset: 800, animation: 'gw-spark-draw 1.2s ease forwards' }} />
    </svg>
  )
}

// ── Loading states (shown until holdings are valued at today's prices) ─────────

function HeroLoading() {
  return (
    <div aria-busy style={{ marginBottom: 20, color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 54, marginBottom: 14, marginLeft: -10 }}>
        <LoadingDrop size={60} label="Calculating your net worth" />
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Calculating your net worth</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,.72)' }}>Valuing your holdings at today&apos;s prices</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="gw-skel" style={{ width: 210, maxWidth: '100%', height: 28, borderRadius: 999 }} />
        <span className="gw-skel" style={{ width: 170, maxWidth: '80%', height: 12, marginLeft: 4 }} />
      </div>
    </div>
  )
}

function HoldingsSkeleton() {
  return (
    <div className="card" aria-busy style={{ display: 'flex', flexDirection: 'column', gap: 12, color: 'var(--text)' }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Savings &amp; Investments</h2>
      <span className="gw-skel" style={{ width: 150, height: 22 }} />
      <span className="gw-skel" style={{ height: 6, borderRadius: 999 }} />
      {[0, 1, 2].map(i => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="gw-skel" style={{ width: 32, height: 32, borderRadius: 8, flex: 'none' }} />
          <span className="gw-skel" style={{ flex: 1, height: 12 }} />
          <span className="gw-skel" style={{ width: 72, height: 14, flex: 'none' }} />
        </div>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function NetWorthPage() {
  const { user } = useAuth()
  const { assets, liabilities, emergencyFund, transactions, settings, initialized } = useAppStore()
  const refresh = useRefreshData()
  const router = useRouter()

  const [masked, setMasked] = useState(true)
  // Each card can be revealed on its own; the eye on the net worth card flips them all
  const [cardMasks, setCardMasks] = useState<Record<string, boolean>>({})
  const isMasked = (card: string) => cardMasks[card] ?? masked
  const toggleCard = (card: string) => setCardMasks(m => ({ ...m, [card]: !(m[card] ?? masked) }))
  const [assetModal, setAssetModal] = useState<{ open: boolean; item?: Asset }>({ open: false })
  const [liabilityModal, setLiabilityModal] = useState<{ open: boolean; item?: Liability }>({ open: false })
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const [savingsModalOpen, setSavingsModalOpen] = useState(false)
  const [unitsTx, setUnitsTx] = useState<Transaction | null>(null)
  // Every holding at its live value — the same figures the Savings & Investments card shows
  // Start of the current salary cycle: "this month" for the growth figures below
  const cycleStart = useMemo(() => getCycleRange(getCycleMonth(settings), settings).start, [settings])
  const { prices, loaded: pricesLoaded, refresh: refreshPrices } = useLivePricesState(assets, cycleStart)
  // Holdings and transactions are already live; pulling down fetches fresh market prices
  usePullToRefresh(refreshPrices)

  // Until data and prices are in, holdings would be valued at cost and then jump. Show a loader
  // instead and let the real figures settle in together. Once shown they stay: adding a holding
  // or refreshing updates them in place. Coming back with cached prices skips the loader.
  const valuesReady = initialized && pricesLoaded
  const [revealed, setRevealed] = useState(valuesReady)
  const animateReveal = useRef(!valuesReady).current
  const [loaderShownLongEnough, setLoaderShownLongEnough] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setLoaderShownLongEnough(true), 500) // no blink when prices are quick
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    if (valuesReady && loaderShownLongEnough) setRevealed(true)
  }, [valuesReady, loaderShownLongEnough])
  const revealCls = animateReveal ? 'gw-reveal' : undefined
  const revealAfter = (ms: number) => (animateReveal ? { animationDelay: `${ms}ms` } : {})
  const valuedAssets = useMemo(() => assets.map(a => computeValue(a, prices)), [assets, prices])
  const firePlan = useFirePlan(valuedAssets, prices)
  const fireScenario = settings?.fire?.scenario ?? 'moderate'
  const holdingsValue = useMemo(() => valuedAssets.reduce((s, a) => s + a.currentValue, 0), [valuedAssets])

  // Vehicle prior-balance inline edit
  const [editingVehicle, setEditingVehicle] = useState<string | null>(null)
  const [editingPrior, setEditingPrior]     = useState('')
  const [vehicleSaving, setVehicleSaving]   = useState(false)

  function openVehicleEdit(name: string) {
    const current = settings?.savingsOpeningBalances?.[name] ?? 0
    setEditingPrior(current > 0 ? String(current) : '')
    setEditingVehicle(name)
  }

  async function saveVehiclePrior() {
    if (!user || !editingVehicle) return
    setVehicleSaving(true)
    try {
      const existing = settings?.savingsOpeningBalances ?? {}
      await setUserSettings(user.uid, {
        savingsOpeningBalances: { ...existing, [editingVehicle]: Number(editingPrior) || 0 },
      })
      await refresh()
      setEditingVehicle(null)
      toast.success('Prior balance saved')
    } catch { toast.error('Failed to save') }
    finally { setVehicleSaving(false) }
  }

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

  // EF inline edit state
  const [efEditing, setEfEditing] = useState(false)
  const [efBalance, setEfBalance] = useState('')
  const [efTarget, setEfTarget] = useState('')
  const [efSaving, setEfSaving] = useState(false)

  function openEfEdit() {
    setEfBalance(String(emergencyFund?.currentBalance ?? ''))
    setEfTarget(String(emergencyFund?.targetAmount ?? ''))
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
      toast.success('Emergency Fund updated')
    } catch { toast.error('Failed to save') }
    finally { setEfSaving(false) }
  }

  // Savings vehicles (transaction-derived), excluding Emergency Fund
  const openingBalances = settings?.savingsOpeningBalances ?? {}
  // A savings transaction linked to a holding is already inside that holding's value, so it
  // is left out here — each rupee is counted in exactly one place.
  const linkedIds = useMemo(() => linkedTransactionIds(assets), [assets])
  const savingsVehicles = useMemo(() => {
    const byVehicle = buildSavingsByVehicle(transactions.filter(t => !linkedIds.has(t.id)), openingBalances)
    return Object.entries(byVehicle)
      .filter(([name, v]) => name !== EMERGENCY_FUND_VEHICLE && v.balance > 0)
      .map(([name, v]) => ({ name, opening: v.opening, contributed: v.contributed, withdrawn: v.withdrawn, balance: v.balance }))
      .sort((a, b) => b.balance - a.balance)
  }, [transactions, openingBalances, linkedIds])

  const savingsTotal = useMemo(() => savingsVehicles.reduce((s, v) => s + v.balance, 0), [savingsVehicles])

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

  // Spark data: monthly net income over last 6 months as a proxy trend
  const sparkData = useMemo(() => {
    return getLast6Months().map(m => {
      const s = buildMonthlySummary(transactions, m, settings)
      return Math.max(0, s.totalIncome - s.totalExpenses)
    })
  }, [transactions, settings])

  // Savings put in this salary cycle, less anything pulled back out: what this cycle added to net worth
  const savedThisCycle = useMemo(() => {
    const s = buildMonthlySummary(transactions, getCycleMonth(settings), settings)
    return s.savingsContributed - s.savingsWithdrawn
  }, [transactions, settings])

  const totalAssets = holdingsValue + (emergencyFund?.currentBalance ?? 0) + savingsTotal

  const totalLiabilities = useMemo(() =>
    liabilities.reduce((s, l) => {
      const outstanding = l.tenureMonths > 0
        ? calcOutstanding(l.principal, l.interestRate, l.tenureMonths, l.startDate)
        : l.principal
      return s + outstanding
    }, 0)
  , [liabilities])

  const netWorth = totalAssets - totalLiabilities

  // What holdings have earned overall, and what this cycle brought in: money added (logged
  // savings plus EPF's own monthly credit) and what holdings earned on top of it.
  const lifetime = useMemo(() => lifetimeReturns(valuedAssets), [valuedAssets])
  const growth = useMemo(() => growthSince(valuedAssets, prices, cycleStart), [valuedAssets, prices, cycleStart])
  const addedThisCycle = savedThisCycle + growth.added
  const returnsThisCycle = growth.ready ? Math.round(growth.returns) : 0
  const grewThisCycle = addedThisCycle + returnsThisCycle
  const showGrowthSplit = lifetime.invested > 0 || growth.added !== 0
  // As a share of net worth before this cycle (hidden when that base isn't positive)
  const netWorthBefore = netWorth - grewThisCycle
  const grewPct = netWorthBefore > 0 && grewThisCycle !== 0 ? (grewThisCycle / netWorthBefore) * 100 : null
  const nwColor = netWorth >= 0 ? 'var(--good-ink)' : 'var(--bad-ink)'

  function fmt(v: number, prefix = '') {
    return masked ? MASK : `${prefix}${formatCurrencyFull(Math.round(v))}`
  }
  const fmtFor = (card: string) => (v: number, prefix = '') => isMasked(card) ? MASK : `${prefix}${formatCurrencyFull(v)}`
  const fmtEf = fmtFor('ef'), fmtSav = fmtFor('savings'), fmtLiab = fmtFor('liabilities')

  async function handleDeleteAsset(id: string) {
    setConfirm({
      message: 'Delete this asset?',
      onConfirm: async () => { await deleteAsset(id); await refresh(); toast.success('Deleted') },
    })
  }

  async function handleDeleteLiability(id: string) {
    setConfirm({
      message: 'Delete this liability?',
      onConfirm: async () => { await deleteLiability(id); await refresh(); toast.success('Deleted') },
    })
  }

  async function handleSaveAsset(data: Omit<Asset, 'id' | 'userId' | 'createdAt' | 'updatedAt'>, id?: string) {
    if (!user) return
    if (id) await updateAsset(id, data); else await addAsset(user.uid, data)
    await refresh(); setAssetModal({ open: false }); toast.success(id ? 'Updated' : 'Asset added')
  }

  async function handleSaveLiability(data: Omit<Liability, 'id' | 'userId' | 'createdAt' | 'updatedAt'>, id?: string) {
    if (!user) return
    if (id) await updateLiability(id, data); else await addLiability(user.uid, data)
    await refresh(); setLiabilityModal({ open: false }); toast.success(id ? 'Updated' : 'Liability added')
  }

  return (
    <div className="anim-page" style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)' }}>
      <WealthTabs active="networth" />

      {/* Net Worth Hero */}
      <div style={{
        borderRadius: 'var(--radius-xl)',
        padding: '28px 24px',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(155deg, var(--brand-deep) 0%, var(--brand) 55%, var(--brand-2) 100%)',
        boxShadow: '0 16px 40px -16px var(--brand)',
      }}>
        {/* Glow orb */}
        <div style={{
          position: 'absolute', top: -60, right: -40, width: 200, height: 200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,.22), transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.72)', letterSpacing: '.1em', textTransform: 'uppercase', margin: 0 }}>
              Net Worth
            </p>
            <button
              onClick={() => { setMasked(v => !v); setCardMasks({}) }}
              style={{
                width: 32, height: 32, borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'rgba(255,255,255,.2)', backdropFilter: 'blur(6px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              }}
            >
              {masked ? <Eye size={15} /> : <EyeOff size={15} />}
            </button>
          </div>

          {!revealed ? <HeroLoading /> : (<>
          {/* Net worth, with what's been invested and earned so far beside it (below on narrow screens) */}
          <div className={revealCls} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: 10, marginBottom: 14 }}>
            <p style={{
              fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', margin: 0,
              color: '#fff', lineHeight: 1,
            }}>
              {masked ? '₹ •••••' : `${netWorth >= 0 ? '' : '−'}${formatCurrencyFull(Math.round(Math.abs(netWorth)))}`}
            </p>

            {lifetime.invested > 0 && (
              <div
                title="Across holdings with a purchase price: the money you put in, and what it has earned so far"
                style={{
                  padding: '6px 10px', borderRadius: 12, lineHeight: 1.3,
                  background: 'rgba(0,0,0,.16)', backdropFilter: 'blur(6px)',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.78)', whiteSpace: 'nowrap' }}>
                  {masked ? MASK : formatCurrency(lifetime.invested)} invested
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                  fontSize: 12, fontWeight: 700, color: lifetime.returns >= 0 ? HERO_GAIN : HERO_LOSS,
                }}>
                  {lifetime.returns >= 0 ? <TrendingUp size={12} strokeWidth={2.5} /> : <TrendingDown size={12} strokeWidth={2.5} />}
                  {masked ? MASK : `${lifetime.returns >= 0 ? '+' : ''}${formatCurrency(lifetime.returns)}`} returns
                  {!masked && lifetime.pct !== null && <span style={{ fontWeight: 600, opacity: 0.85 }}>· {pctText(lifetime.pct)}</span>}
                </div>
              </div>
            )}
          </div>

          {/* This cycle: money added plus what holdings earned, as one change in net worth */}
          <div className={revealCls} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, marginBottom: 20, ...revealAfter(70) }}>
            <span
              title="How much your net worth grew this month: money you added plus returns on your holdings"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 999,
                background: '#fff', boxShadow: '0 4px 14px -6px rgba(0,0,0,.35)',
                fontSize: 12.5, fontWeight: 700,
                // Fixed colours (not theme tokens) so they read on the white pill in every theme
                color: grewThisCycle > 0 ? 'oklch(0.52 0.15 152)' : grewThisCycle < 0 ? 'oklch(0.55 0.19 25)' : 'oklch(0.5 0 0)',
              }}
            >
              {grewThisCycle >= 0 ? <TrendingUp size={14} strokeWidth={2.5} /> : <TrendingDown size={14} strokeWidth={2.5} />}
              {masked ? MASK : `${grewThisCycle > 0 ? '+' : grewThisCycle < 0 ? '−' : ''}${formatCurrencyFull(Math.round(Math.abs(grewThisCycle)))}`} this month
              {!masked && grewPct !== null && (
                <span style={{ paddingLeft: 7, marginLeft: 1, borderLeft: '1px solid color-mix(in oklch, currentColor 30%, transparent)' }}>
                  {pctText(grewPct)}
                </span>
              )}
            </span>

            {showGrowthSplit && (
              <p style={{ margin: 0, paddingLeft: 4, fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.8)', lineHeight: 1.4 }}>
                {addedThisCycle >= 0 ? 'Added' : 'Withdrawn'}{' '}
                <b style={{ color: '#fff', fontWeight: 700 }}>{masked ? MASK : formatCurrencyFull(Math.round(Math.abs(addedThisCycle)))}</b>
                <span aria-hidden style={{ margin: '0 7px', opacity: 0.6 }}>·</span>
                Returns{' '}
                {growth.ready ? (
                  <b style={{ color: returnsThisCycle >= 0 ? HERO_GAIN : HERO_LOSS, fontWeight: 700 }}>
                    {masked ? MASK : `${returnsThisCycle > 0 ? '+' : returnsThisCycle < 0 ? '−' : ''}${formatCurrencyFull(Math.abs(returnsThisCycle))}`}
                  </b>
                ) : (
                  <span style={{ opacity: 0.7 }}>updating…</span>
                )}
              </p>
            )}
          </div>
          </>)}

          {/* Sparkline */}
          {sparkData.some(v => v > 0) && (
            <div style={{ marginBottom: 16, marginLeft: -4 }}>
              <Sparkline data={sparkData} width={320} height={44} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: 'rgba(255,255,255,.18)', borderRadius: 14, padding: '14px 16px', backdropFilter: 'blur(6px)' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,.72)', fontWeight: 600, margin: '0 0 6px' }}>Total Assets</p>
              {revealed
                ? <p className={revealCls} style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em', ...revealAfter(110) }}>{fmt(totalAssets)}</p>
                : <span className="gw-skel" style={{ width: 96, height: 20, color: '#fff' }} />}
            </div>
            <div style={{ background: 'rgba(255,255,255,.18)', borderRadius: 14, padding: '14px 16px', backdropFilter: 'blur(6px)' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,.72)', fontWeight: 600, margin: '0 0 6px' }}>Liabilities</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>{fmt(totalLiabilities)}</p>
            </div>
          </div>

          {/* One-line FIRE answer; opens the planner */}
          <Link href="/networth/fire" className="pressable" style={{
            display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, minHeight: 52, padding: '12px 14px', borderRadius: 18,
            background: 'rgba(255,255,255,.16)', color: '#fff', textDecoration: 'none', backdropFilter: 'blur(6px)',
          }}>
            <span style={{ font: "600 10px/1 'Geist Mono', monospace", letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.9, flex: 'none' }}>FIRE plan</span>
            {revealed
              ? <span className={revealCls} style={{ flex: 1, fontSize: 14.5, fontWeight: 600, minWidth: 0, ...revealAfter(150) }}>{fireStripText(firePlan, fireScenario)}</span>
              : <span style={{ flex: 1, minWidth: 0 }}><span className="gw-skel" style={{ width: '70%', height: 14 }} /></span>}
            <span aria-hidden style={{ fontSize: 18 }}>→</span>
          </Link>
        </div>
      </div>

      {/* Savings & Investments (the holdings) */}
      {!revealed ? <HoldingsSkeleton /> : (
      <div className={revealCls} style={revealAfter(120)}>
      <MyAssetsSection
        assets={valuedAssets}
        masked={isMasked('holdings')}
        onToggleMask={() => toggleCard('holdings')}
        onAdd={() => setAssetModal({ open: true })}
        onLog={() => setSavingsModalOpen(true)}
        onEdit={a => setAssetModal({ open: true, item: a })}
        onDelete={handleDeleteAsset}
        onAddUnits={id => {
          const tx = transactions.find(t => t.id === id)
          if (tx) setUnitsTx(tx)
          else toast.error('Couldn’t find that transaction')
        }}
      />
      </div>
      )}

      {/* Mutual fund wealth projection (renders only when MF holdings exist) */}
      <MutualFundProjection assets={assets} masked={isMasked('projection')} onToggleMask={() => toggleCard('projection')} />

      {/* Emergency Fund */}
      <div id="emergency-fund" ref={efCardRef} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, scrollMarginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--warn-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconLifebuoy size={15} style={{ color: 'var(--warn-ink)' }} stroke={1.5} />
            </div>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Emergency Fund</h2>
              {emergencyFund && (
                <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>
                  Target {fmtEf(emergencyFund.targetAmount)} · 6 mo runway
                </p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <MaskToggle masked={isMasked('ef')} onToggle={() => toggleCard('ef')} />
            <button
              onClick={openEfEdit}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
            >
              {emergencyFund ? <Pencil size={12} /> : <Plus size={12} />}
              {emergencyFund ? 'Edit' : 'Set up'}
            </button>
          </div>
        </div>

        {efEditing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>Current Balance (₹)</label>
              <input className="input" type="number" inputMode="decimal" value={efBalance} onChange={e => setEfBalance(e.target.value)} autoFocus />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>Target Amount (₹)</label>
              <input className="input" type="number" inputMode="decimal" value={efTarget} onChange={e => setEfTarget(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveEf} disabled={efSaving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 13 }}>
                {efSaving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEfEditing(false)} style={{ flex: 1, justifyContent: 'center', padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {emergencyFund && !efEditing && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <div className="display-num" style={{ fontSize: 26, color: 'var(--text)' }}>
                {fmtEf(emergencyFund.currentBalance)}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--warn-ink)' }}>
                  {Math.round(Math.min((emergencyFund.currentBalance / (emergencyFund.targetAmount || 1)) * 100, 100))}%
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>funded</div>
              </div>
            </div>
            <div style={{ height: 5, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 999,
                width: `${Math.min((emergencyFund.currentBalance / (emergencyFund.targetAmount || 1)) * 100, 100)}%`,
                background: 'var(--warn)',
                transition: 'width .4s cubic-bezier(.4,0,.2,1)',
              }} />
            </div>
            <EmergencyFundTransactions
              transactions={efTransactions}
              open={efTxOpen}
              onToggle={() => setEfTxOpen(v => !v)}
              masked={isMasked('ef')}
            />
          </>
        )}

        {!emergencyFund && !efEditing && (
          <p style={{ fontSize: 13, color: 'var(--text-4)', textAlign: 'center', padding: '12px 0' }}>
            Set up your emergency fund to track your financial safety net.
          </p>
        )}
      </div>

      {/* Unlinked savings — savings transactions not yet tied to a holding. Hidden when there are none. */}
      {savingsVehicles.length > 0 && (
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Unlinked savings</h2>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--good-ink)' }}>{fmtSav(savingsTotal)}</span>
          </div>
          <MaskToggle masked={isMasked('savings')} onToggle={() => toggleCard('savings')} />
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '0 0 10px' }}>
          Counted in net worth, but not tied to a holding yet. Tap <Link2 size={11} style={{ verticalAlign: '-1px' }} /> to move it into one of your holdings.
        </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {savingsVehicles.map(v => {
              const meta = getSavingsVehicleMeta(v.name)
              const isEditing = editingVehicle === v.name
              return (
                <div key={v.name} style={{ borderRadius: 10, background: 'var(--surface-2)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: meta.color + '20' }}>
                      <meta.Icon size={15} color={meta.color} stroke={1.5} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>
                        {v.opening > 0
                          ? `${fmtSav(v.opening)} prior + ${fmtSav(v.contributed)} unlinked`
                          : 'Not linked to a holding'}
                      </p>
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--good-ink)', whiteSpace: 'nowrap' }}>{fmtSav(v.balance)}</p>
                    <button onClick={() => setLinkFlow({ vehicle: v.name })} style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-ink)', flexShrink: 0 }} title="Link to a holding" aria-label={`Link ${v.name} to a holding`}>
                      <Link2 size={14} />
                    </button>
                    <button onClick={() => openVehicleEdit(v.name)} style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-4)', flexShrink: 0 }} title="Set prior balance">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => router.push(`/transactions?type=savings&vehicle=${encodeURIComponent(v.name)}`)} style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-4)', flexShrink: 0 }} title="View transactions">
                      <ExternalLink size={13} />
                    </button>
                  </div>
                  {isEditing && (
                    <div style={{ padding: '0 12px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>Prior balance (₹) — what you had before tracking</label>
                        <input
                          className="input" style={{ fontSize: 13 }} type="number" inputMode="decimal" min="0"
                          placeholder="e.g. 250000"
                          value={editingPrior}
                          onChange={e => setEditingPrior(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 6, paddingTop: 18, flexShrink: 0 }}>
                        <button onClick={saveVehiclePrior} disabled={vehicleSaving} className="btn-primary" style={{ padding: '8px 14px', fontSize: 13 }}>
                          {vehicleSaving ? 'Saving…' : 'Save'}
                        </button>
                        <button onClick={() => setEditingVehicle(null)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
      </div>
      )}

      {/* Liabilities */}
      <div className="card">
        <SectionHeader title="Liabilities & Loans" onAdd={() => setLiabilityModal({ open: true })}
          extra={<MaskToggle masked={isMasked('liabilities')} onToggle={() => toggleCard('liabilities')} />} />
        {liabilities.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-4)', textAlign: 'center', padding: '24px 0' }}>No liabilities. Great shape!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {liabilities.map(l => {
              const meta = LIABILITY_META[l.kind]
              const Icon = meta.icon
              const emi = l.emiAmount ?? calcEMI(l.principal, l.interestRate, l.tenureMonths)
              const outstanding = l.tenureMonths > 0
                ? calcOutstanding(l.principal, l.interestRate, l.tenureMonths, l.startDate)
                : l.principal
              const remaining = l.tenureMonths > 0 ? monthsRemaining(l.tenureMonths, l.startDate) : null
              const paidPct = l.tenureMonths > 0 ? Math.max(0, Math.min(100, 100 - (outstanding / l.principal) * 100)) : 0
              return (
                <div key={l.id} style={{ borderRadius: 10, background: 'var(--surface-2)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bad-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={15} style={{ color: meta.color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0 }}>{l.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>
                        {meta.label}
                        {l.interestRate > 0 ? ` · ${l.interestRate}% p.a.` : ''}
                        {remaining !== null ? ` · ${remaining} EMIs left` : ''}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--bad-ink)', margin: 0 }}>{fmtLiab(Math.round(outstanding))}</p>
                      {emi > 0 && <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>EMI {fmtLiab(Math.round(emi))}/mo</p>}
                    </div>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button onClick={() => setLiabilityModal({ open: true, item: l })} style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-4)' }}><Pencil size={13} /></button>
                      <button onClick={() => handleDeleteLiability(l.id)} style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-4)' }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                  {l.tenureMonths > 0 && (
                    <div style={{ padding: '0 12px 10px' }}>
                      <div style={{ height: 3, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${paidPct}%`, background: 'var(--good)', borderRadius: 999 }} />
                      </div>
                      <p style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 4 }}>{paidPct.toFixed(0)}% paid off</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>


      {/* Financial independence summary; the full planner is at /networth/fire */}
      <FireSummaryCard plan={firePlan} scenario={fireScenario} targetRetirementAge={settings?.fire?.targetRetirementAge} targetYears={settings?.fire?.targetYears}
        masked={isMasked('fi')} onToggleMask={() => toggleCard('fi')} />

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
      {confirm && (
        <ConfirmDialog open message={confirm.message} onConfirm={confirm.onConfirm} onClose={() => setConfirm(null)} />
      )}
    </div>
  )
}
