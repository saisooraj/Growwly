'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Pencil, Trash2, TrendingUp, Home, Car, Landmark, CreditCard, Coins, BarChart2, Package, Wallet, Eye, EyeOff } from 'lucide-react'
import { IconLifebuoy } from '@tabler/icons-react'
import { useAppStore } from '@/store/appStore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import { addAsset, updateAsset, deleteAsset, addLiability, updateLiability, deleteLiability } from '@/lib/firestore'
import { formatCurrencyFull, buildMonthlySummary } from '@/lib/utils'
import type { Asset, AssetKind, Liability, LiabilityKind } from '@/types'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import AssetModal from './AssetModal'
import LiabilityModal from './LiabilityModal'

// ── EMI / Loan calculations ────────────────────────────────────────────────────

function calcEMI(principal: number, annualRate: number, tenureMonths: number): number {
  if (annualRate === 0 || tenureMonths === 0) return tenureMonths > 0 ? principal / tenureMonths : 0
  const r = annualRate / 12 / 100
  return principal * r * Math.pow(1 + r, tenureMonths) / (Math.pow(1 + r, tenureMonths) - 1)
}

function calcOutstanding(principal: number, annualRate: number, tenureMonths: number, startDate: string): number {
  if (tenureMonths === 0) return principal
  const start = new Date(startDate)
  const now = new Date()
  const monthsPaid = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()))
  if (monthsPaid >= tenureMonths) return 0
  if (annualRate === 0) return principal - (principal / tenureMonths) * monthsPaid
  const r = annualRate / 12 / 100
  const emi = calcEMI(principal, annualRate, tenureMonths)
  return principal * Math.pow(1 + r, monthsPaid) - emi * (Math.pow(1 + r, monthsPaid) - 1) / r
}

function monthsRemaining(tenureMonths: number, startDate: string): number {
  const start = new Date(startDate)
  const now = new Date()
  const paid = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()))
  return Math.max(0, tenureMonths - paid)
}

// ── Asset / Liability metadata ─────────────────────────────────────────────────

const ASSET_META: Record<AssetKind, { label: string; icon: React.ElementType; color: string }> = {
  cash:         { label: 'Cash & Savings',  icon: Wallet,     color: 'var(--good)' },
  fd_rd:        { label: 'FD / RD',         icon: Landmark,   color: 'var(--info)' },
  gold_grams:   { label: 'Gold (grams)',     icon: Coins,      color: '#f59e0b' },
  mutual_fund:  { label: 'Mutual Funds',     icon: TrendingUp, color: 'var(--brand)' },
  stocks:       { label: 'Stocks',           icon: BarChart2,  color: 'var(--brand-deep)' },
  real_estate:  { label: 'Real Estate',      icon: Home,       color: 'var(--warn)' },
  vehicle:      { label: 'Vehicle',          icon: Car,        color: 'var(--text-3)' },
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

function SectionHeader({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{title}</h2>
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
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function NetWorthPage() {
  const { user } = useAuth()
  const { assets, liabilities, emergencyFund } = useAppStore()
  const refresh = useRefreshData()

  const [masked, setMasked] = useState(true)
  const [goldPrice, setGoldPrice] = useState<number | null>(null)
  const [assetModal, setAssetModal] = useState<{ open: boolean; item?: Asset }>({ open: false })
  const [liabilityModal, setLiabilityModal] = useState<{ open: boolean; item?: Liability }>({ open: false })
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null)

  useEffect(() => {
    fetch('/api/market/gold')
      .then(r => r.json())
      .then(d => { if (d.price22kPerGram) setGoldPrice(d.price22kPerGram) })
      .catch(() => {})
  }, [])

  function assetValue(a: Asset): number {
    if (a.kind === 'gold_grams') return goldPrice ? a.value * goldPrice : 0
    return a.value
  }

  const totalAssets = useMemo(() => {
    let total = assets.reduce((s, a) => s + assetValue(a), 0)
    if (emergencyFund?.currentBalance) total += emergencyFund.currentBalance
    return total
  }, [assets, goldPrice, emergencyFund])

  const totalLiabilities = useMemo(() =>
    liabilities.reduce((s, l) => {
      const outstanding = l.tenureMonths > 0
        ? calcOutstanding(l.principal, l.interestRate, l.tenureMonths, l.startDate)
        : l.principal
      return s + outstanding
    }, 0)
  , [liabilities])

  const netWorth = totalAssets - totalLiabilities
  const nwColor = netWorth >= 0 ? 'var(--good-ink)' : 'var(--bad-ink)'

  function fmt(v: number, prefix = '') {
    return masked ? MASK : `${prefix}${formatCurrencyFull(v)}`
  }

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
    <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)' }}>

      {/* Net Worth Hero */}
      <div className="card" style={{ textAlign: 'center', padding: '28px 24px', position: 'relative' }}>
        <button
          onClick={() => setMasked(v => !v)}
          style={{ position: 'absolute', top: 16, right: 16, padding: 6, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}
        >
          {masked ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          Net Worth
        </p>
        <p style={{ fontSize: 36, fontWeight: 700, color: masked ? 'var(--text-3)' : nwColor, letterSpacing: '-0.02em', marginBottom: 16 }}>
          {masked ? MASK : `${netWorth >= 0 ? '' : '−'}${formatCurrencyFull(Math.abs(netWorth))}`}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: 'var(--good-soft)', borderRadius: 10, padding: '12px 16px' }}>
            <p style={{ fontSize: 11, color: 'var(--good-ink)', fontWeight: 500, marginBottom: 4 }}>Total Assets</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--good-ink)' }}>{fmt(totalAssets)}</p>
          </div>
          <div style={{ background: 'var(--bad-soft)', borderRadius: 10, padding: '12px 16px' }}>
            <p style={{ fontSize: 11, color: 'var(--bad-ink)', fontWeight: 500, marginBottom: 4 }}>Total Liabilities</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--bad-ink)' }}>{fmt(totalLiabilities)}</p>
          </div>
        </div>
      </div>

      {/* Assets */}
      <div className="card">
        <SectionHeader title="Assets" onAdd={() => setAssetModal({ open: true })} />

        {emergencyFund?.currentBalance ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)', marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--good-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconLifebuoy size={16} style={{ color: 'var(--good-ink)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Emergency Fund</p>
              <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>Auto-linked from EF tracker</p>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--good-ink)' }}>{fmt(emergencyFund.currentBalance)}</p>
          </div>
        ) : null}

        {assets.length === 0 && !emergencyFund?.currentBalance ? (
          <p style={{ fontSize: 13, color: 'var(--text-4)', textAlign: 'center', padding: '24px 0' }}>No assets yet. Add your first one.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {assets.map(a => {
              const meta = ASSET_META[a.kind]
              const Icon = meta.icon
              const val = assetValue(a)
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={15} style={{ color: meta.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>
                      {meta.label}{a.kind === 'gold_grams' ? ` · ${a.value}g${goldPrice ? ` @ ₹${goldPrice.toLocaleString('en-IN')}/g` : ''}` : ''}
                    </p>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--good-ink)', whiteSpace: 'nowrap' }}>
                    {masked ? MASK : a.kind === 'gold_grams' && !goldPrice ? `${a.value}g` : formatCurrencyFull(val)}
                  </p>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button onClick={() => setAssetModal({ open: true, item: a })} style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-4)' }}><Pencil size={13} /></button>
                    <button onClick={() => handleDeleteAsset(a.id)} style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-4)' }}><Trash2 size={13} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Liabilities */}
      <div className="card">
        <SectionHeader title="Liabilities & Loans" onAdd={() => setLiabilityModal({ open: true })} />
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
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--bad-ink)', margin: 0 }}>{fmt(Math.round(outstanding))}</p>
                      {emi > 0 && <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>EMI {fmt(Math.round(emi))}/mo</p>}
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

      {/* FI Calculator */}
      <FICalculator masked={masked} />

      {assetModal.open && (
        <AssetModal item={assetModal.item} onSave={handleSaveAsset} onClose={() => setAssetModal({ open: false })} />
      )}
      {liabilityModal.open && (
        <LiabilityModal item={liabilityModal.item} onSave={handleSaveLiability} onClose={() => setLiabilityModal({ open: false })} />
      )}
      {confirm && (
        <ConfirmDialog open message={confirm.message} onConfirm={confirm.onConfirm} onClose={() => setConfirm(null)} />
      )}
    </div>
  )
}

// ── FI Calculator ──────────────────────────────────────────────────────────────

function FICalculator({ masked }: { masked: boolean }) {
  const { transactions, selectedMonth, settings } = useAppStore()

  const { monthlyExpenses, monthlySavings, fiCorpus, yearsToFI, savingsRate } = useMemo(() => {
    const summary = buildMonthlySummary(transactions, selectedMonth, settings)
    const monthlyExpenses = summary.totalExpenses
    const monthlySavings = Math.max(0, summary.net)
    const annualExpenses = monthlyExpenses * 12
    const fiCorpus = annualExpenses * 25
    const savingsRate = summary.totalIncome > 0 ? (summary.net / summary.totalIncome) * 100 : 0

    let yearsToFI: number | null = null
    if (monthlySavings > 0 && fiCorpus > 0) {
      const r = 0.12 / 12
      const n = Math.log(1 + fiCorpus * r / monthlySavings) / Math.log(1 + r)
      yearsToFI = n / 12
    }

    return { monthlyExpenses, monthlySavings, fiCorpus, yearsToFI, savingsRate }
  }, [transactions, selectedMonth, settings])

  const fmt = (v: number) => masked ? '₹ •••' : formatCurrencyFull(v)

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>Financial Independence Calculator</h2>
        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>Based on 4% withdrawal rule · 12% assumed investment return</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px' }}>
          <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 4px' }}>FI Corpus Needed</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{fmt(fiCorpus)}</p>
          <p style={{ fontSize: 10, color: 'var(--text-4)', margin: '2px 0 0' }}>25× annual expenses</p>
        </div>
        <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px' }}>
          <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 4px' }}>Monthly Savings</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: monthlySavings > 0 ? 'var(--good-ink)' : 'var(--bad-ink)', margin: 0 }}>{fmt(monthlySavings)}</p>
          <p style={{ fontSize: 10, color: 'var(--text-4)', margin: '2px 0 0' }}>{savingsRate.toFixed(1)}% of income</p>
        </div>
      </div>

      <div style={{ background: yearsToFI && yearsToFI < 20 ? 'var(--good-soft)' : 'var(--surface-2)', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
        {yearsToFI !== null && monthlySavings > 0 ? (
          <>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Estimated time to FI</p>
            <p style={{ fontSize: 32, fontWeight: 700, color: yearsToFI < 20 ? 'var(--good-ink)' : 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
              {yearsToFI < 1 ? 'Under 1 year!' : `${yearsToFI.toFixed(1)} years`}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>At current savings rate of {savingsRate.toFixed(1)}%</p>
          </>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
            {monthlySavings <= 0 ? 'Start saving to see your FI timeline' : 'Add transactions for this month to calculate'}
          </p>
        )}
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-4)', lineHeight: 1.5, margin: 0 }}>
        <strong style={{ color: 'var(--text-3)' }}>How this works:</strong> The 4% rule says you can withdraw 4% of your portfolio annually in retirement. So you need 25× your yearly expenses saved. The timeline assumes you invest your monthly savings at 12% p.a. compounded monthly.
      </p>
    </div>
  )
}
