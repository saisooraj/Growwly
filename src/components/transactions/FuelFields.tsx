'use client'

import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { useAppStore } from '@/store/appStore'
import { setUserSettings } from '@/lib/firestore'
import { defaultVehicle, isFuelExpense, pumpTotal, vehicleOf, type FuelCalc } from '@/lib/fuel'
import { formatCurrencyFull } from '@/lib/utils'
import type { Transaction, UserSettings, Vehicle } from '@/types'
import { MONO, Sym, chip, darkBtn, field, subLabelStyle, textInput } from './TxnSheetParts'

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
  const kmSince = lastReading && odometer > (lastReading.odometerKm ?? 0) ? odometer - lastReading.odometerKm! : 0

  return (
    <div data-card="fuel" style={{ marginTop: 14, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Sym name="local_gas_station" style={{ color: 'var(--t2)' }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>Fill-up</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--t3)', whiteSpace: 'nowrap' }}>any 2 fill the 3rd</span>
      </div>

      {/* Vehicle */}
      {vehicles.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {vehicles.map(v => (
            <button key={v.id} type="button" onClick={() => onChange({ vehicleId: v.id })} style={chip(v.id === value.vehicleId)}>
              <Sym name={TWO_WHEELER.test(v.name) ? 'two_wheeler' : 'directions_car'} size={17} />{v.name}
            </button>
          ))}
          {!adding && (
            <button type="button" onClick={() => setAdding(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 40, padding: '0 12px', borderRadius: 999, border: '1px dashed var(--line2)', background: 'transparent', color: 'var(--t2)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none' }}
            >+ Add</button>
          )}
        </div>
      )}
      {showAddInput && (
        <div style={{ display: 'flex', gap: 6 }}>
          <input type="text" placeholder="e.g. Swift, Activa" value={value.newVehicle} maxLength={40}
            onChange={e => onChange({ newVehicle: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveVehicle() } }}
            style={textInput} />
          <button type="button" onClick={saveVehicle} disabled={!value.newVehicle.trim() || savingVehicle}
            style={{ ...darkBtn, ...(value.newVehicle.trim() ? {} : { background: 'var(--sunk2)', color: 'var(--t3)' }) }}
          >{savingVehicle ? 'Adding…' : 'Add'}</button>
        </div>
      )}

      {/* Pump reading */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', ...subLabelStyle }}>Litres{auto === 'litres' && <Calculated />}</span>
          <input inputMode="decimal" placeholder="0.00" value={value.litres} onChange={e => onChange({ litres: decimal(e.target.value) })}
            style={field(auto === 'litres' ? calcStyle : undefined)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', ...subLabelStyle }}>₹ per litre{auto === 'price' && <Calculated />}</span>
          <input inputMode="decimal" placeholder="0.00" value={value.price} onChange={e => onChange({ price: decimal(e.target.value) })}
            style={field(auto === 'price' ? calcStyle : undefined)} />
        </label>
      </div>

      {/* Discount */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={subLabelStyle}>Discount (₹) <span style={{ color: 'var(--t3)', fontWeight: 500 }}>· taken off what you paid</span></span>
        <div style={{ display: 'flex', gap: 6 }}>
          <input inputMode="decimal" placeholder="0" value={value.discount} onChange={e => onChange({ discount: decimal(e.target.value) })}
            style={field({ flex: 1, width: 'auto' })} />
          {lastDiscount > 0 && (
            <button type="button" onClick={() => onChange({ discount: String(lastDiscount) })}
              style={{ height: 44, padding: '0 12px', borderRadius: 12, border: 0, background: 'var(--sunk)', color: 'var(--t1)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >↺ Last: {formatCurrencyFull(lastDiscount)}</button>
          )}
        </div>
        {pump > 0 && paid > 0 && (
          Math.abs(gap) < 1 ? (
            <span style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--t2)' }}>
              {discount > 0
                ? `Pump ${formatCurrencyFull(pump)} − ${formatCurrencyFull(discount)} = ${formatCurrencyFull(paid)} paid`
                : `Pump total ${formatCurrencyFull(pump)}`}
            </span>
          ) : gap >= 1 && discount === 0 ? (
            <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--t2)' }}>
              <span>{formatCurrencyFull(gap)} less than the pump total {formatCurrencyFull(pump)}</span>
              <button type="button" onClick={() => onChange({ discount: String(gap) })}
                style={{ height: 30, padding: '0 10px', borderRadius: 999, border: 0, background: 'var(--good-soft)', color: 'var(--good-ink)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
              >Add as discount</button>
            </span>
          ) : (
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--warn-ink)', lineHeight: 1.4 }}>
              Pump {formatCurrencyFull(pump)}{discount > 0 ? ` − ${formatCurrencyFull(discount)}` : ''} = {formatCurrencyFull(Math.round((pump - discount) * 100) / 100)}, but the amount is {formatCurrencyFull(paid)}. Check the numbers
            </span>
          )
        )}
      </div>

      {/* Odometer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={subLabelStyle}>Odometer (km) <span style={{ color: 'var(--t3)', fontWeight: 500 }}>· for mileage</span></span>
        <input inputMode="numeric" value={value.odometer} onChange={e => onChange({ odometer: e.target.value.replace(/[^0-9]/g, '') })}
          placeholder={lastReading ? `Last: ${lastReading.odometerKm!.toLocaleString('en-IN')}` : 'Reading on the dashboard'}
          style={field(odometerBehind ? { borderColor: 'var(--bad)' } : undefined)} />
        {odometerBehind ? (
          <span style={{ fontSize: 12.5, color: 'var(--bad-ink)', fontWeight: 600 }}>
            Behind your last reading ({lastReading!.odometerKm!.toLocaleString('en-IN')} km on {format(parseISO(lastReading!.date), 'd MMM')}) — check the number
          </span>
        ) : kmSince > 0 ? (
          <span style={{ fontSize: 12.5, color: 'var(--good-ink)', fontWeight: 600 }}>
            {litres > 0 && !value.partial && !value.missedBefore
              ? `≈ ${(kmSince / litres).toFixed(1)} km/l since your last reading`
              : `${kmSince.toLocaleString('en-IN')} km since your last reading`}
          </span>
        ) : !lastReading ? (
          <span style={{ fontSize: 12.5, color: 'var(--t3)' }}>Mileage shows from your second full tank with a reading</span>
        ) : null}
      </div>

      {/* Rare cases */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Check checked={value.partial} onChange={v => onChange({ partial: v })} label="Didn't fill to full" />
        <Check checked={value.missedBefore} onChange={v => onChange({ missedBefore: v })} label="Missed logging a fill-up before this" />
      </div>
    </div>
  )
}

// Scooters and bikes get the two-wheeler glyph; everything else is a car
const TWO_WHEELER = /activa|scoot|bike|splendor|pulsar|jupiter|ntorq|bullet|enfield|classic|duke|apache|shine|access|dio|fascino|ather|ola s1|chetak/i

const calcStyle: React.CSSProperties = { background: 'var(--brand-soft)', color: 'var(--brand-ink)', borderColor: 'transparent' }

const decimal = (v: string) => v.replace(/[^0-9.]/g, '')

function Calculated() {
  return <span style={{ color: 'var(--brand-ink)', fontWeight: 700 }}>calculated</span>
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={() => onChange(!checked)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, border: 0, background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
      <span style={{ width: 22, height: 22, borderRadius: 7, border: checked ? 0 : '2px solid var(--line2)', background: checked ? 'var(--brand)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        {checked && <Sym name="check" size={16} />}
      </span>
      <span style={{ fontSize: 13.5, color: 'var(--t1)', fontWeight: 500 }}>{label}</span>
    </button>
  )
}
