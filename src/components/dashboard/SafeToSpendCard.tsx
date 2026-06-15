'use client'

import { useState, useMemo } from 'react'
import { Pencil, Plus, Trash2, CheckCircle2 } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { buildMonthlySummary, formatCurrencyFull } from '@/lib/utils'
import { getCycleRange } from '@/lib/cycle'
import { parseISO, differenceInCalendarDays } from 'date-fns'
import { setUserSettings } from '@/lib/firestore'
import { useAuth } from '@/context/AuthContext'
import { useRefreshData } from '@/hooks/useData'
import toast from 'react-hot-toast'

type DailyItem = { label: string; amount: number }

export default function SafeToSpendCard() {
  const { user } = useAuth()
  const refresh = useRefreshData()
  const { transactions, selectedMonth, settings, borrowings } = useAppStore()

  const [editing, setEditing]     = useState(false)
  const [draftItems, setDraftItems] = useState<DailyItem[]>([])
  const [newLabel, setNewLabel]   = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [saving, setSaving]       = useState(false)

  const { cashNet, daysLeft, dailyNeed, dailyAvailable, buffer, extraPerDay, daysCanCover } = useMemo(() => {
    const summary  = buildMonthlySummary(transactions, selectedMonth, settings, borrowings)
    const today    = new Date()
    const { end }  = getCycleRange(selectedMonth, settings)
    const daysLeft = Math.max(1, differenceInCalendarDays(parseISO(end), today) + 1)
    const cashNet  = Math.max(summary.cashNet, 0)

    const dailyNeed      = settings?.dailyLivingCost ?? 0
    const dailyAvailable = cashNet / daysLeft
    const buffer         = cashNet - dailyNeed * daysLeft
    const extraPerDay    = daysLeft > 0 ? buffer / daysLeft : 0
    const daysCanCover   = dailyNeed > 0 ? Math.floor(cashNet / dailyNeed) : daysLeft

    return { cashNet, daysLeft, dailyNeed, dailyAvailable, buffer, extraPerDay, daysCanCover }
  }, [transactions, selectedMonth, settings, borrowings])

  const isConfigured = (settings?.dailyLivingCost ?? 0) > 0
  const isCovered    = buffer >= 0
  const tone         = !isConfigured ? 'neutral' : isCovered ? (extraPerDay > dailyNeed ? 'good' : 'warn') : 'bad'
  const accent = tone === 'good' ? 'var(--good)' : tone === 'warn' ? 'var(--warn)' : tone === 'bad' ? 'var(--bad)' : 'var(--text-3)'
  const gradientColor = tone === 'good' ? 'oklch(0.95 0.05 152 / .7)' : tone === 'warn' ? 'oklch(0.96 0.06 75 / .7)' : tone === 'bad' ? 'oklch(0.95 0.04 25 / .7)' : 'transparent'

  const insightText = (() => {
    if (!isConfigured) return 'Set your daily baseline to see a smarter view'
    if (!isCovered) {
      const shortPerDay = Math.abs(extraPerDay)
      return `Covers ${Math.min(daysCanCover, daysLeft)} of ${daysLeft} days — cut ${formatCurrencyFull(Math.ceil(shortPerDay))}/day to last the month`
    }
    if (extraPerDay < dailyNeed * 0.2)
      return `Just covered — stick close to your ${formatCurrencyFull(dailyNeed)} daily baseline`
    return `${formatCurrencyFull(Math.floor(extraPerDay))} extra per day after essentials — well positioned`
  })()

  function openEdit() {
    setDraftItems(settings?.dailyLivingItems?.length ? [...settings.dailyLivingItems] : [])
    setNewLabel('')
    setNewAmount('')
    setEditing(true)
  }

  function addItem() {
    const amt = Number(newAmount)
    if (!newLabel.trim() || !amt || amt <= 0) return
    setDraftItems(prev => [...prev, { label: newLabel.trim(), amount: amt }])
    setNewLabel('')
    setNewAmount('')
  }

  function removeItem(i: number) {
    setDraftItems(prev => prev.filter((_, idx) => idx !== i))
  }

  async function save() {
    if (!user) return
    const total = draftItems.reduce((s, i) => s + i.amount, 0)
    if (total <= 0) { toast.error('Add at least one expense item'); return }
    setSaving(true)
    try {
      await setUserSettings(user.uid, { dailyLivingCost: total, dailyLivingItems: draftItems })
      await refresh()
      setEditing(false)
      toast.success('Daily baseline saved')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const draftTotal = draftItems.reduce((s, i) => s + i.amount, 0)

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', overflow: 'hidden' }}>

      {/* Gradient bg */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(120% 80% at 90% 0%, ${gradientColor} 0%, transparent 55%)`,
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="h-eyebrow">Safe to spend / day</span>
        <button
          type="button"
          onClick={editing ? () => setEditing(false) : openEdit}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 2 }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
          title={editing ? 'Cancel' : 'Configure daily baseline'}
        >
          <Pencil size={13} />
        </button>
      </div>

      {/* ── Edit mode ── */}
      {editing ? (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            Break down your typical daily spend. The total becomes your baseline.
          </p>

          {/* Item list */}
          {draftItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {draftItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'var(--surface-2)' }}>
                  <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text)' }}>{item.label}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)' }}>₹{item.amount}</span>
                  <button type="button" onClick={() => removeItem(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', display: 'flex', padding: 2 }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--bad)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-4)')}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add item row */}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              placeholder="e.g. Breakfast"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem())}
              style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 12, color: 'var(--text)', outline: 'none' }}
            />
            <input
              type="number"
              placeholder="₹"
              min="0"
              value={newAmount}
              onChange={e => setNewAmount(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem())}
              style={{ width: 64, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 12, color: 'var(--text)', outline: 'none', textAlign: 'right' }}
            />
            <button type="button" onClick={addItem}
              style={{ padding: '6px 10px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-2)' }}>
              <Plus size={13} />
            </button>
          </div>

          {/* Total + save */}
          {draftTotal > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Daily total: <strong style={{ color: 'var(--text)' }}>₹{draftTotal.toLocaleString('en-IN')}</strong>
              </span>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, opacity: saving ? 0.6 : 1 }}
              >
                <CheckCircle2 size={13} /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>

      ) : !isConfigured ? (
        /* ── Not configured ── */
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div className="display-num" style={{ fontSize: 28, color: 'var(--text-3)', lineHeight: 1 }}>
              {formatCurrencyFull(Math.round(dailyAvailable))}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 4 }}>per day · {daysLeft} days left</div>
          </div>
          <button
            type="button"
            onClick={openEdit}
            style={{ alignSelf: 'flex-start', padding: '5px 12px', borderRadius: 8, background: 'var(--brand-soft)', color: 'var(--brand-ink)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
          >
            + Set your daily baseline →
          </button>
          <p style={{ fontSize: 11, color: 'var(--text-4)', margin: 0 }}>
            Tell us your daily needs (food, fuel, commute) to get smarter advice.
          </p>
        </div>

      ) : (
        /* ── Configured view ── */
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Primary: extra per day or shortfall */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span className="display-num" style={{ fontSize: 32, lineHeight: 1, color: isCovered ? 'var(--text)' : 'var(--bad-ink)' }}>
              {isCovered
                ? `+${formatCurrencyFull(Math.floor(extraPerDay))}`
                : `−${formatCurrencyFull(Math.ceil(Math.abs(extraPerDay)))}`
              }
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {isCovered ? 'extra / day' : 'short / day'}
            </span>
          </div>

          {/* Breakdown: need vs available */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-3)' }}>Daily need</span>
              <span style={{ color: 'var(--text)', fontWeight: 500 }}>{formatCurrencyFull(dailyNeed)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-3)' }}>Available / day</span>
              <span style={{ color: isCovered ? 'var(--good-ink)' : 'var(--bad-ink)', fontWeight: 500 }}>
                {formatCurrencyFull(Math.round(dailyAvailable))}
              </span>
            </div>
            {!isCovered && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-3)' }}>Days covered</span>
                <span style={{ color: 'var(--warn-ink)', fontWeight: 500 }}>{Math.min(daysCanCover, daysLeft)} of {daysLeft}</span>
              </div>
            )}
          </div>

          {/* Daily items chips */}
          {settings?.dailyLivingItems && settings.dailyLivingItems.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {settings.dailyLivingItems.map((item, i) => (
                <span key={i} style={{
                  fontSize: 10.5, padding: '2px 8px', borderRadius: 999,
                  background: 'var(--surface-2)', color: 'var(--text-3)',
                  border: '1px solid var(--border)',
                }}>
                  {item.label} ₹{item.amount}
                </span>
              ))}
            </div>
          )}

          {/* Status pill + insight */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto' }}>
            <span className={`pill ${tone === 'good' ? 'good' : tone === 'warn' ? 'warn' : tone === 'bad' ? 'bad' : ''}`}>
              <span className="pill-dot" />
              {isCovered ? (extraPerDay > dailyNeed * 0.2 ? 'Comfortable' : 'Just covered') : 'Tight'}
            </span>
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, lineHeight: 1.5 }}>
            {insightText}
          </p>
        </div>
      )}
    </div>
  )
}
