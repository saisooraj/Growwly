'use client'

import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { useAppStore } from '@/store/appStore'
import { setUserSettings } from '@/lib/firestore'
import { defaultVehicle, isFuelExpense, pumpTotal, vehicleOf, type FuelCalc } from '@/lib/fuel'
import { formatCurrencyFull } from '@/lib/utils'
import type { Transaction, UserSettings, Vehicle } from '@/types'

export interface FuelDraft {
  vehicleId: string
  litres: string
  price: string
  discount: string     // ₹ knocked off the pump total at payment
  odometer: string
  partial: boolean
  missedBefore: boolean
  newVehicle: string   // typed but not added yet — added on save
}

export function fuelDraftFrom(tx: Transaction | null | undefined, settings: UserSettings | null | undefined): FuelDraft {
  return {
    vehicleId: tx ? (vehicleOf(tx, settings?.vehicles ?? []) ?? '') : (defaultVehicle(settings)?.id ?? ''),
    litres: tx?.fuelLitres ? String(tx.fuelLitres) : '',
    price: tx?.fuelPricePerLitre ? String(tx.fuelPricePerLitre) : '',
    discount: tx?.fuelDiscount ? String(tx.fuelDiscount) : '',
    odometer: tx?.odometerKm ? String(tx.odometerKm) : '',
    partial: tx?.fuelPartial ?? false,
    missedBefore: tx?.fuelMissedBefore ?? false,
    newVehicle: '',
  }
}

/** The transaction fields for a fill-up. Empty numbers are saved as 0 so an edit can clear them. */
export function fuelPayload(d: FuelDraft): Partial<Transaction> {
  return {
    ...(d.vehicleId ? { vehicleId: d.vehicleId } : {}),
    fuelLitres: parseFloat(d.litres) || 0,
    fuelPricePerLitre: parseFloat(d.price) || 0,
    fuelDiscount: parseFloat(d.discount) || 0,
    odometerKm: parseFloat(d.odometer) || 0,
    fuelPartial: d.partial,
    fuelMissedBefore: d.missedBefore,
  }
}

/** Adds a vehicle and makes it the default. Returns its id. */
export async function addVehicle(uid: string, settings: UserSettings | null | undefined, name: string): Promise<string> {
  const vehicle: Vehicle = { id: Math.random().toString(36).slice(2, 10), name: name.trim(), createdAt: new Date().toISOString() }
  await setUserSettings(uid, { vehicles: [...(settings?.vehicles ?? []), vehicle], defaultVehicleId: vehicle.id })
  return vehicle.id
}

interface Props {
  value: FuelDraft
  onChange: (patch: Partial<FuelDraft>) => void
  auto: FuelCalc | null   // the field we calculated
  paid: number
  date: string
  editId?: string
}

export default function FuelFields({ value, onChange, auto, paid, date, editId }: Props) {
  const { user } = useAuth()
  const { transactions, settings } = useAppStore()
  const vehicles = settings?.vehicles ?? []
  const [adding, setAdding] = useState(false)
  const [savingVehicle, setSavingVehicle] = useState(false)
  const [discountOpen, setDiscountOpen] = useState(() => !!value.discount)

  const litres = parseFloat(value.litres) || 0
  const price = parseFloat(value.price) || 0
  const discount = parseFloat(value.discount) || 0
  const pump = litres > 0 && price > 0 ? pumpTotal(litres, price) : 0
  // What the numbers say should have been paid, against what was entered
  const gap = Math.round((pump - discount - paid) * 100) / 100

  // The Shell-app style offer tends to repeat — offer last time's discount in one tap
  const lastDiscount = useMemo(() => {
    let best: Transaction | null = null
    for (const tx of transactions) {
      if (tx.id === editId || !isFuelExpense(tx) || !tx.fuelDiscount) continue
      if (!best || tx.date > best.date) best = tx
    }
    return best?.fuelDiscount ?? 0
  }, [transactions, editId])
  const showDiscount = discountOpen || !!value.discount

  // The latest reading on or before this fill's date, for the same vehicle
  const lastReading = useMemo(() => {
    let best: Transaction | null = null
    for (const tx of transactions) {
      if (tx.id === editId || !isFuelExpense(tx) || !tx.odometerKm || tx.date > date) continue
      if (vehicles.length && vehicleOf(tx, vehicles) !== value.vehicleId) continue
      if (!best || tx.date > best.date || (tx.date === best.date && tx.odometerKm > (best.odometerKm ?? 0))) best = tx
    }
    return best
  }, [transactions, editId, date, vehicles, value.vehicleId])
  const odometer = parseFloat(value.odometer) || 0
  const odometerBehind = !!lastReading && odometer > 0 && odometer <= (lastReading.odometerKm ?? 0)

  async function saveVehicle() {
    if (!user || !value.newVehicle.trim()) return
    setSavingVehicle(true)
    try {
      const id = await addVehicle(user.uid, settings, value.newVehicle)
      onChange({ vehicleId: id, newVehicle: '' })
      setAdding(false)
    } catch {
      toast.error('Could not add the vehicle')
    } finally {
      setSavingVehicle(false)
    }
  }

  const showAddInput = adding || vehicles.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 12, background: 'var(--surface-2)' }}>
      {/* Vehicle */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label className="label" style={{ margin: 0 }}>Vehicle</label>
        {vehicles.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {vehicles.map(v => {
              const on = v.id === value.vehicleId
              return (
                <button key={v.id} type="button" onClick={() => onChange({ vehicleId: v.id })}
                  style={{
                    padding: '6px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                    border: `1.5px solid ${on ? 'var(--brand)' : 'var(--border)'}`,
                    background: on ? 'var(--brand-soft)' : 'var(--surface)',
                    color: on ? 'var(--brand-ink)' : 'var(--text-2)',
                  }}
                >{v.name}</button>
              )
            })}
            {!adding && (
              <button type="button" onClick={() => setAdding(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '6px 10px', borderRadius: 999, fontSize: 12.5, cursor: 'pointer',
                  border: '1.5px dashed var(--border)', background: 'transparent', color: 'var(--text-3)',
                }}
              ><Plus size={12} /> Add</button>
            )}
          </div>
        )}
        {showAddInput && (
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="input" type="text" placeholder="e.g. Swift, Activa" value={value.newVehicle}
              onChange={e => onChange({ newVehicle: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveVehicle() } }}
              style={{ flex: 1 }} />
            <button type="button" onClick={saveVehicle} disabled={!value.newVehicle.trim() || savingVehicle}
              style={{
                padding: '0 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
                background: value.newVehicle.trim() ? 'var(--brand)' : 'var(--surface-3)',
                color: value.newVehicle.trim() ? '#fff' : 'var(--text-3)',
              }}
            >{savingVehicle ? 'Adding…' : 'Add'}</button>
          </div>
        )}
      </div>

      {/* Pump reading */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label className="label">Litres{auto === 'litres' && <Calculated />}</label>
          <input className="input" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00"
            value={value.litres} onChange={e => onChange({ litres: e.target.value })} />
        </div>
        <div>
          <label className="label">₹ per litre{auto === 'price' && <Calculated />}</label>
          <input className="input" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00"
            value={value.price} onChange={e => onChange({ price: e.target.value })} />
        </div>
      </div>

      {/* Discount — tucked away; most fills have none */}
      {showDiscount ? (
        <div>
          <label className="label">Discount (₹){' '}<span style={{ fontWeight: 400, color: 'var(--text-4)' }}>taken off what you paid</span></label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="input" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0"
              value={value.discount} onChange={e => onChange({ discount: e.target.value })} style={{ flex: 1 }} autoFocus={discountOpen && !value.discount} />
            <button type="button" aria-label="Remove discount" onClick={() => { onChange({ discount: '' }); setDiscountOpen(false) }}
              style={{ padding: '0 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-3)', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button type="button" onClick={() => setDiscountOpen(true)} style={linkChip}>
            <Plus size={12} /> Discount
          </button>
          {lastDiscount > 0 && (
            <button type="button" onClick={() => onChange({ discount: String(lastDiscount) })} style={linkChip}>
              {formatCurrencyFull(lastDiscount)} off, like last time
            </button>
          )}
        </div>
      )}

      {pump > 0 && paid > 0 && (
        Math.abs(gap) < 1 ? (
          <p style={{ fontSize: 11.5, margin: 0, color: 'var(--text-3)' }}>
            {discount > 0
              ? <>Pump {formatCurrencyFull(pump)} − {formatCurrencyFull(discount)} = <strong>{formatCurrencyFull(paid)}</strong> paid</>
              : <>Pump total {formatCurrencyFull(pump)}</>}
            {(auto === 'litres' || auto === 'price') && ` · ${auto === 'litres' ? 'litres' : 'price'} worked out from the amount`}
          </p>
        ) : gap >= 1 && discount === 0 ? (
          <p style={{ fontSize: 11.5, margin: 0, color: 'var(--text-3)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <span>{formatCurrencyFull(gap)} less than the pump total {formatCurrencyFull(pump)}</span>
            <button type="button" onClick={() => onChange({ discount: String(gap) })}
              style={{ ...linkChip, padding: '2px 9px', color: 'var(--good-ink)', borderColor: 'color-mix(in oklch, var(--good) 35%, transparent)' }}>
              Add as discount
            </button>
          </p>
        ) : (
          <p style={{ fontSize: 11.5, margin: 0, color: 'var(--warn-ink)' }}>
            Pump {formatCurrencyFull(pump)}{discount > 0 ? ` − ${formatCurrencyFull(discount)}` : ''} = {formatCurrencyFull(Math.round((pump - discount) * 100) / 100)}, but the amount is {formatCurrencyFull(paid)}. Check the numbers
          </p>
        )
      )}

      {/* Odometer */}
      <div>
        <label className="label">Odometer (km){' '}<span style={{ fontWeight: 400, color: 'var(--text-4)' }}>for mileage</span></label>
        <input className="input" type="number" inputMode="numeric" min="0" step="1"
          placeholder={lastReading ? `Last: ${lastReading.odometerKm!.toLocaleString('en-IN')}` : 'Reading on the dashboard'}
          value={value.odometer} onChange={e => onChange({ odometer: e.target.value })} />
        <p style={{ fontSize: 11, margin: '4px 0 0', color: odometerBehind ? 'var(--warn-ink)' : 'var(--text-4)' }}>
          {odometerBehind
            ? `Lower than ${lastReading!.odometerKm!.toLocaleString('en-IN')} km on ${format(parseISO(lastReading!.date), 'd MMM')}`
            : lastReading
              ? `${lastReading.odometerKm!.toLocaleString('en-IN')} km on ${format(parseISO(lastReading.date), 'd MMM')}${odometer > (lastReading.odometerKm ?? 0) ? ` · ${(odometer - lastReading.odometerKm!).toLocaleString('en-IN')} km since` : ''}`
              : 'Mileage shows from your second full tank with a reading'}
        </p>
      </div>

      {/* Rare cases */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Check checked={value.partial} onChange={v => onChange({ partial: v })} label="Didn't fill to full" />
        <Check checked={value.missedBefore} onChange={v => onChange({ missedBefore: v })} label="Missed logging a fill-up before this" />
      </div>
    </div>
  )
}

const linkChip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
  border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-3)',
}

function Calculated() {
  return <span style={{ fontWeight: 400, color: 'var(--brand-ink)', marginLeft: 6 }}>calculated</span>
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-3)', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ accentColor: 'var(--brand)' }} />
      {label}
    </label>
  )
}
