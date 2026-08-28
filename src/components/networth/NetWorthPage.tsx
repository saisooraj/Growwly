'use client'

import { useState, useEffect, useMemo } from 'react'
import { Pencil, Trash2, Home, Car, Landmark, CreditCard, Package, Wallet, Eye, EyeOff, ExternalLink, Plus, TrendingUp, BarChart2, Coins } from 'lucide-react'
import { IconLifebuoy } from '@tabler/icons-react'
import { useAppStore } from '@/store/appStore'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { useRefreshData } from '@/hooks/useData'
import { addAsset, updateAsset, deleteAsset, addLiability, updateLiability, deleteLiability, setEmergencyFund, setUserSettings } from '@/lib/firestore'
import AddTransactionModal from '@/components/transactions/AddTransactionModal'
import { formatCurrencyFull, buildMonthlySummary, buildSavingsByVehicle, EMERGENCY_FUND_VEHICLE, getLast6Months } from '@/lib/utils'
import { getSavingsVehicleMeta } from '@/lib/categoryIcons'
import type { Asset, AssetKind, Liability, LiabilityKind } from '@/types'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import AssetModal from './AssetModal'
import LiabilityModal from './LiabilityModal'
import MyAssetsSection from './MyAssetsSection'

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

// ── Main component ─────────────────────────────────────────────────────────────

export default function NetWorthPage() {
  const { user } = useAuth()
  const { assets, liabilities, emergencyFund, transactions, settings } = useAppStore()
  const refresh = useRefreshData()
  const router = useRouter()

  const [masked, setMasked] = useState(true)
  const [assetModal, setAssetModal] = useState<{ open: boolean; item?: Asset }>({ open: false })
  const [liabilityModal, setLiabilityModal] = useState<{ open: boolean; item?: Liability }>({ open: false })
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const [savingsModalOpen, setSavingsModalOpen] = useState(false)

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

  const savingsVehicles = useMemo(() => {
    const byVehicle = buildSavingsByVehicle(transactions, openingBalances)
    return Object.entries(byVehicle)
      .filter(([name, v]) => name !== EMERGENCY_FUND_VEHICLE && v.balance > 0)
      .map(([name, v]) => ({ name, opening: v.opening, contributed: v.contributed, withdrawn: v.withdrawn, balance: v.balance }))
      .sort((a, b) => b.balance - a.balance)
  }, [transactions, openingBalances])

  const savingsTotal = useMemo(() => savingsVehicles.reduce((s, v) => s + v.balance, 0), [savingsVehicles])

  // Spark data: monthly net income over last 6 months as a proxy trend
  const sparkData = useMemo(() => {
    return getLast6Months().map(m => {
      const s = buildMonthlySummary(transactions, m, settings)
      return Math.max(0, s.totalIncome - s.totalExpenses)
    })
  }, [transactions, settings])

  // For net worth total we use invested/value as best estimate (MyAssetsSection shows live values)
  const totalAssets = useMemo(() => {
    const assetsTotal = assets.reduce((s, a) => s + a.value, 0)
    const ef = emergencyFund?.currentBalance ?? 0
    return assetsTotal + ef + savingsTotal
  }, [assets, emergencyFund, savingsTotal])

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
    <div className="anim-page" style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)' }}>

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
              onClick={() => setMasked(v => !v)}
              style={{
                width: 32, height: 32, borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'rgba(255,255,255,.2)', backdropFilter: 'blur(6px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              }}
            >
              {masked ? <Eye size={15} /> : <EyeOff size={15} />}
            </button>
          </div>

          <p style={{
            fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 6px',
            color: '#fff', lineHeight: 1,
          }}>
            {masked ? '₹ •••••' : `${netWorth >= 0 ? '' : '−'}${formatCurrencyFull(Math.abs(netWorth))}`}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 12px', borderRadius: 999,
              background: 'rgba(255,255,255,.22)', color: '#fff',
              fontSize: 12.5, fontWeight: 700,
            }}>
              {netWorth >= 0 ? '↑' : '↓'} {formatCurrencyFull(Math.abs(netWorth - totalLiabilities))} assets
            </span>
          </div>

          {/* Sparkline */}
          {sparkData.some(v => v > 0) && (
            <div style={{ marginBottom: 16, marginLeft: -4 }}>
              <Sparkline data={sparkData} width={320} height={44} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: 'rgba(255,255,255,.18)', borderRadius: 14, padding: '14px 16px', backdropFilter: 'blur(6px)' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,.72)', fontWeight: 600, margin: '0 0 6px' }}>Total Assets</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>{fmt(totalAssets)}</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,.18)', borderRadius: 14, padding: '14px 16px', backdropFilter: 'blur(6px)' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,.72)', fontWeight: 600, margin: '0 0 6px' }}>Liabilities</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>{fmt(totalLiabilities)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* My Holdings */}
      <MyAssetsSection
        assets={assets}
        masked={masked}
        onAdd={() => setAssetModal({ open: true })}
        onEdit={a => setAssetModal({ open: true, item: a })}
        onDelete={handleDeleteAsset}
      />

      {/* Emergency Fund */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--warn-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconLifebuoy size={15} style={{ color: 'var(--warn-ink)' }} stroke={1.5} />
            </div>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Emergency Fund</h2>
              {emergencyFund && (
                <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>
                  Target {fmt(emergencyFund.targetAmount)} · 6 mo runway
                </p>
              )}
            </div>
          </div>
          <button
            onClick={openEfEdit}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
          >
            {emergencyFund ? <Pencil size={12} /> : <Plus size={12} />}
            {emergencyFund ? 'Edit' : 'Set up'}
          </button>
        </div>

        {efEditing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>Current Balance (₹)</label>
              <input className="input" type="number" value={efBalance} onChange={e => setEfBalance(e.target.value)} autoFocus />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>Target Amount (₹)</label>
              <input className="input" type="number" value={efTarget} onChange={e => setEfTarget(e.target.value)} />
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
                {fmt(emergencyFund.currentBalance)}
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
          </>
        )}

        {!emergencyFund && !efEditing && (
          <p style={{ fontSize: 13, color: 'var(--text-4)', textAlign: 'center', padding: '12px 0' }}>
            Set up your emergency fund to track your financial safety net.
          </p>
        )}
      </div>

      {/* Savings & Investments (derived from savings transactions) */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Savings & Investments</h2>
            {savingsVehicles.length > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--good-ink)' }}>{fmt(savingsTotal)}</span>}
          </div>
          <button
            onClick={() => setSavingsModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
          >
            <Plus size={13} /> Log
          </button>
        </div>
        {savingsVehicles.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-4)', textAlign: 'center', padding: '24px 0' }}>No savings logged yet. Tap Log to add one.</p>
        ) : (
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
                          ? `${fmt(v.opening)} prior + ${fmt(v.contributed)} added`
                          : 'Net contributions'}
                      </p>
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--good-ink)', whiteSpace: 'nowrap' }}>{fmt(v.balance)}</p>
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
                          className="input" style={{ fontSize: 13 }} type="number" min="0"
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
      <AddTransactionModal open={savingsModalOpen} onClose={() => { setSavingsModalOpen(false); refresh() }} />
      {confirm && (
        <ConfirmDialog open message={confirm.message} onConfirm={confirm.onConfirm} onClose={() => setConfirm(null)} />
      )}
    </div>
  )
}

// ── FI Calculator ──────────────────────────────────────────────────────────────

function FICalculator({ masked }: { masked: boolean }) {
  const { transactions, selectedMonth, settings, assets, liabilities } = useAppStore()

  const { monthlySavings, fiCorpus, currentNetWorth, yearsToFI, savingsRate, progressPct } = useMemo(() => {
    const summary = buildMonthlySummary(transactions, selectedMonth, settings)
    const monthlySavings  = Math.max(0, summary.savingsContributed - summary.savingsWithdrawn)
    const fiCorpus        = summary.totalExpenses * 12 * 25
    const savingsRate     = summary.totalIncome > 0 ? (monthlySavings / summary.totalIncome) * 100 : 0

    const totalAssets      = assets.reduce((s, a) => s + a.value, 0)
    const totalLiabilities = liabilities.reduce((s, l) => {
      const outstanding = l.tenureMonths > 0
        ? calcOutstanding(l.principal, l.interestRate, l.tenureMonths, l.startDate)
        : l.principal
      return s + outstanding
    }, 0)
    const currentNetWorth  = Math.max(0, totalAssets - totalLiabilities)
    const progressPct      = fiCorpus > 0 ? Math.min(100, (currentNetWorth / fiCorpus) * 100) : 0

    let yearsToFI: number | null = null
    if (fiCorpus > 0) {
      if (currentNetWorth >= fiCorpus) {
        yearsToFI = 0
      } else if (monthlySavings > 0) {
        const r   = 0.12 / 12
        const pmt = monthlySavings
        const pv  = currentNetWorth
        const fv  = fiCorpus
        // FV = PV*(1+r)^n + PMT*((1+r)^n - 1)/r  =>  n = ln((fv + pmt/r)/(pv + pmt/r)) / ln(1+r)
        const n = Math.log((fv + pmt / r) / (pv + pmt / r)) / Math.log(1 + r)
        yearsToFI = n / 12
      }
    }

    return { monthlySavings, fiCorpus, currentNetWorth, yearsToFI, savingsRate, progressPct }
  }, [transactions, selectedMonth, settings, assets, liabilities])

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
          <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 4px' }}>Monthly Contribution</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: monthlySavings > 0 ? 'var(--good-ink)' : 'var(--bad-ink)', margin: 0 }}>{fmt(monthlySavings)}</p>
          <p style={{ fontSize: 10, color: 'var(--text-4)', margin: '2px 0 0' }}>{savingsRate.toFixed(1)}% of income</p>
        </div>
      </div>

      {/* Net worth progress bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)' }}>
          <span>Net worth <strong style={{ color: 'var(--text)' }}>{fmt(currentNetWorth)}</strong></span>
          <span style={{ fontWeight: 700, color: progressPct >= 100 ? 'var(--good-ink)' : 'var(--brand-ink)' }}>{progressPct.toFixed(1)}% to FI</span>
        </div>
        <div style={{ height: 7, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: progressPct >= 100 ? 'var(--good)' : 'var(--brand)', borderRadius: 999, transition: 'width .6s ease' }} />
        </div>
      </div>

      <div style={{ background: yearsToFI === 0 ? 'var(--good-soft)' : yearsToFI && yearsToFI < 20 ? 'var(--good-soft)' : 'var(--surface-2)', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
        {yearsToFI === 0 ? (
          <>
            <p style={{ fontSize: 11, color: 'var(--good-ink)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Financial Independence</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--good-ink)', margin: '0 0 4px' }}>You&apos;re there!</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>Net worth exceeds your FI corpus</p>
          </>
        ) : yearsToFI !== null ? (
          <>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Estimated time to FI</p>
            <p style={{ fontSize: 32, fontWeight: 700, color: yearsToFI < 20 ? 'var(--good-ink)' : 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
              {yearsToFI < 1 ? 'Under 1 year!' : `${yearsToFI.toFixed(1)} years`}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>Net worth + {fmt(monthlySavings)}/mo at 12% p.a.</p>
          </>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
            {monthlySavings <= 0 ? 'Start saving to see your FI timeline' : 'Add transactions for this month to calculate'}
          </p>
        )}
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-4)', lineHeight: 1.5, margin: 0 }}>
        <strong style={{ color: 'var(--text-3)' }}>How this works:</strong> The 4% rule says you need 25× your annual expenses. Your current net worth is your starting point — the timeline shows how long to grow it to the FI corpus at 12% p.a. compounded monthly.
      </p>
    </div>
  )
}
