'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { useAppStore } from '@/store/appStore'
import { setUserSettings } from '@/lib/firestore'
import { defaultVehicle, isFuelExpense, vehicleOf } from '@/lib/fuel'
import { addVehicle } from '@/components/transactions/FuelFields'
import type { Vehicle } from '@/types'
import { Sym, MONO, card, CardHead, hint, btnIcon, btnPrimary, useSavedFlash } from './ui'

export default function VehiclesCard() {
  const { user } = useAuth()
  const { settings, transactions } = useAppStore()
  const vehicles = settings?.vehicles ?? []
  const current = defaultVehicle(settings)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [newName, setNewName] = useState('')
  const [blocked, setBlocked] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, flash] = useSavedFlash()

  const fillCount = (id: string) =>
    transactions.filter(tx => isFuelExpense(tx) && vehicleOf(tx, vehicles) === id).length

  async function save(next: Partial<{ vehicles: Vehicle[]; defaultVehicleId: string }>) {
    if (!user) return false
    setBusy(true)
    try { await setUserSettings(user.uid, next); flash('vehicles'); return true }
    catch { toast.error('Failed to save'); return false }
    finally { setBusy(false) }
  }

  async function rename(v: Vehicle) {
    const name = draft.trim()
    if (!name || name === v.name) { setEditing(null); return }
    if (await save({ vehicles: vehicles.map(x => x.id === v.id ? { ...x, name } : x) })) setEditing(null)
  }

  async function remove(v: Vehicle) {
    if (fillCount(v.id) > 0) { setBlocked(v.id); return }
    setBlocked(null)
    const rest = vehicles.filter(x => x.id !== v.id)
    await save({ vehicles: rest, ...(current?.id === v.id ? { defaultVehicleId: rest[0]?.id ?? '' } : {}) })
  }

  async function add() {
    if (!user || !newName.trim()) return
    setBusy(true)
    try { await addVehicle(user.uid, settings, newName); setNewName(''); flash('vehicles') }
    catch { toast.error('Could not add the vehicle') }
    finally { setBusy(false) }
  }

  const canAdd = !!newName.trim() && !busy

  return (
    <div style={card}>
      <CardHead title="Vehicles" saved={saved === 'vehicles'} pad="22px 24px 12px" right={<span style={hint}>For fuel fill-ups and mileage</span>} />

      {vehicles.map(v => {
        const n = fillCount(v.id)
        const renaming = editing === v.id
        return (
          <div key={v.id} style={{ borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 24px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--acc-soft)', color: 'var(--acc-txt)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                <Sym name="local_gas_station" size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {renaming ? (
                  <>
                    <input
                      className="set-field" value={draft} autoFocus aria-label={`New name for ${v.name}`}
                      onChange={e => setDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') rename(v); if (e.key === 'Escape') setEditing(null) }}
                      style={{ height: 36, width: 160, maxWidth: '100%', padding: '0 10px', borderRadius: 10, background: 'var(--sf)', color: 'var(--ink)', fontSize: 15, fontWeight: 500, boxSizing: 'border-box' }}
                    />
                    <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--mut)' }}>Enter to save · Esc to cancel</span>
                  </>
                ) : (
                  <span style={{ fontSize: 15, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{v.name}</span>
                )}
                {current?.id === v.id && vehicles.length > 1 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', borderRadius: 999, background: 'var(--acc-soft)', color: 'var(--acc-txt)', fontSize: 11.5, fontWeight: 500 }}>default</span>
                )}
              </div>
              <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 500, color: 'var(--mut)', whiteSpace: 'nowrap' }}>{n} fill-up{n === 1 ? '' : 's'}</span>
              <button onClick={() => { if (renaming) { rename(v); return } setEditing(v.id); setDraft(v.name); setBlocked(null) }} aria-label={renaming ? 'Save name' : `Rename ${v.name}`} style={btnIcon()}><Sym name={renaming ? 'check' : 'edit'} size={18} /></button>
              <button onClick={() => remove(v)} disabled={busy} aria-label={`Delete ${v.name}`} style={btnIcon()}><Sym name="delete" size={18} /></button>
            </div>
            {blocked === v.id && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '0 24px 14px 78px', padding: '10px 12px', borderRadius: 12, background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: 13, lineHeight: 1.45 }}>
                <Sym name="info" size={17} />{v.name} has {n} fill-up{n === 1 ? '' : 's'}, so it can&apos;t be deleted — rename it instead.
              </div>
            )}
          </div>
        )
      })}

      {vehicles.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8, padding: '28px 24px', borderTop: '1px solid var(--line)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 16, background: 'var(--sf2)', border: '1px dashed var(--line2)', display: 'grid', placeItems: 'center', color: 'var(--mut)' }}>
            <Sym name="local_gas_station" size={24} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>No vehicles yet</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--mut)', maxWidth: 300 }}>Add a bike or car to log fuel fill-ups and see your mileage.</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, padding: '14px 24px', borderTop: '1px solid var(--line)', background: 'var(--sf2)' }}>
        <input
          className="set-field" value={newName} placeholder="e.g. Swift, Activa" aria-label="Vehicle name"
          onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }}
          style={{ flex: 1, minWidth: 0, height: 40, padding: '0 12px', borderRadius: 12, background: 'var(--sf)', color: 'var(--ink)', fontSize: 14, boxSizing: 'border-box' }}
        />
        <button onClick={add} disabled={!canAdd} style={{ ...btnPrimary(canAdd, 40), gap: 6 }}><Sym name="add" size={18} />Add</button>
      </div>
    </div>
  )
}
