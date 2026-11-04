'use client'

import { useState } from 'react'
import { Car, Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { useAppStore } from '@/store/appStore'
import { setUserSettings } from '@/lib/firestore'
import { defaultVehicle, isFuelExpense, vehicleOf } from '@/lib/fuel'
import { addVehicle } from '@/components/transactions/FuelFields'
import type { Vehicle } from '@/types'

export default function VehiclesCard() {
  const { user } = useAuth()
  const { settings, transactions } = useAppStore()
  const vehicles = settings?.vehicles ?? []
  const current = defaultVehicle(settings)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  const fillCount = (id: string) =>
    transactions.filter(tx => isFuelExpense(tx) && vehicleOf(tx, vehicles) === id).length

  async function save(next: Partial<{ vehicles: Vehicle[]; defaultVehicleId: string }>) {
    if (!user) return
    setBusy(true)
    try { await setUserSettings(user.uid, next) }
    catch { toast.error('Failed to save') }
    finally { setBusy(false) }
  }

  async function rename(id: string) {
    if (!draft.trim()) return
    await save({ vehicles: vehicles.map(v => v.id === id ? { ...v, name: draft.trim() } : v) })
    setEditing(null)
  }

  async function remove(v: Vehicle) {
    const n = fillCount(v.id)
    if (n > 0) { toast.error(`${v.name} has ${n} fill-up${n === 1 ? '' : 's'} — rename it instead`); return }
    const rest = vehicles.filter(x => x.id !== v.id)
    await save({ vehicles: rest, ...(current?.id === v.id ? { defaultVehicleId: rest[0]?.id ?? '' } : {}) })
  }

  async function add() {
    if (!user || !newName.trim()) return
    setBusy(true)
    try { await addVehicle(user.uid, settings, newName); setNewName('') }
    catch { toast.error('Could not add the vehicle') }
    finally { setBusy(false) }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Car size={14} style={{ color: 'var(--brand)' }} />
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Vehicles</h2>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '4px 0 0' }}>
          Picked on Fuel expenses for mileage. The one you used last is preselected.
        </p>
      </div>

      {vehicles.map(v => (
        <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {editing === v.id ? (
            <>
              <input className="input" value={draft} autoFocus onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') rename(v.id); if (e.key === 'Escape') setEditing(null) }}
                style={{ flex: 1 }} />
              <button className="btn-ghost" onClick={() => rename(v.id)} disabled={busy} aria-label="Save name"><Check size={14} /></button>
              <button className="btn-ghost" onClick={() => setEditing(null)} aria-label="Cancel"><X size={14} /></button>
            </>
          ) : (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {v.name}
                  {current?.id === v.id && vehicles.length > 1 && <span className="pill good" style={{ fontSize: 10, padding: '1px 7px', marginLeft: 8 }}>default</span>}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>{fillCount(v.id)} fill-ups</div>
              </div>
              <button className="btn-ghost" onClick={() => { setEditing(v.id); setDraft(v.name) }} aria-label={`Rename ${v.name}`}><Pencil size={13} /></button>
              <button className="btn-ghost" onClick={() => remove(v)} disabled={busy} aria-label={`Remove ${v.name}`}><Trash2 size={13} /></button>
            </>
          )}
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" placeholder={vehicles.length ? 'Add another vehicle' : 'e.g. Swift, Activa'} value={newName}
          onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} style={{ flex: 1 }} />
        <button className="btn-secondary" onClick={add} disabled={!newName.trim() || busy}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  )
}
