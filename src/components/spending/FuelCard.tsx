'use client'

import { memo, useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Fuel } from 'lucide-react'
import { formatCurrencyFull } from '@/lib/utils'
import { buildFuelLog, defaultVehicle, isFuelExpense } from '@/lib/fuel'
import type { Transaction, UserSettings } from '@/types'

const MASK = '₹ ••••'
const RECENT = 5

interface Props {
  transactions: Transaction[]
  settings: UserSettings | null
  cycleStart: string
  cycleEnd: string
  masked: boolean
}

const litresText = (l: number) => `${l.toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`

function FuelCard({ transactions, settings, cycleStart, cycleEnd, masked }: Props) {
  const vehicles = useMemo(() => settings?.vehicles ?? [], [settings])
  const [vehicleId, setVehicleId] = useState<string | undefined>(() => defaultVehicle(settings)?.id)
  useEffect(() => {
    if (!vehicleId || !vehicles.some(v => v.id === vehicleId)) setVehicleId(defaultVehicle(settings)?.id)
  }, [vehicles, vehicleId, settings])

  const hasFills = useMemo(() => transactions.some(tx => isFuelExpense(tx) && !!tx.fuelLitres), [transactions])
  const log = useMemo(() => buildFuelLog(transactions, vehicleId, vehicles), [transactions, vehicleId, vehicles])

  const withLitres = log.fills.filter(f => f.litres > 0)
  const priced = withLitres.filter(f => f.pricePerLitre > 0)
  const latest = priced[priced.length - 1]
  const before = priced[priced.length - 2]
  const priceDelta = latest && before ? latest.pricePerLitre - before.pricePerLitre : 0

  const thisCycle = log.fills.filter(f => f.tx.date >= cycleStart && f.tx.date <= cycleEnd)
  const cycleLitres = thisCycle.reduce((s, f) => s + f.litres, 0)
  const cyclePaid = thisCycle.reduce((s, f) => s + f.paid, 0)
  const saved = log.fills.reduce((s, f) => s + f.saved, 0)
  const savedCount = log.fills.filter(f => f.saved > 0).length

  const recent = withLitres.slice(-RECENT).reverse()

  if (!hasFills) return null

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Fuel size={14} style={{ color: 'var(--text-3)' }} />
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', margin: 0 }}>Fuel &amp; mileage</h3>
        </div>
        {vehicles.length > 1 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {vehicles.map(v => (
              <button key={v.id} onClick={() => setVehicleId(v.id)} className="pressable"
                style={{
                  padding: '4px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, border: 'none',
                  background: vehicleId === v.id ? 'var(--text)' : 'var(--surface-2)',
                  color: vehicleId === v.id ? 'var(--bg)' : 'var(--text-2)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >{v.name}</button>
            ))}
          </div>
        )}
      </div>

      <div className="fuel-tiles">
        <Tile label="Mileage"
          value={log.avgKmPerLitre ? `${log.avgKmPerLitre.toFixed(1)} km/l` : '—'}
          note={log.avgKmPerLitre ? `over ${Math.round(log.trackedKm).toLocaleString('en-IN')} km` : 'after 2 full tanks with odometer'} />
        <Tile label="Cost per km"
          value={log.costPerKm ? `₹${log.costPerKm.toFixed(2)}` : '—'}
          note={log.costPerKm ? 'what you paid' : 'needs mileage'} />
        <Tile label="Price per litre"
          value={latest ? `₹${latest.pricePerLitre.toLocaleString('en-IN')}` : '—'}
          note={latest
            ? priceDelta ? `${priceDelta > 0 ? '+' : '−'}₹${Math.abs(priceDelta).toFixed(2)} vs last fill` : `on ${format(parseISO(latest.tx.date), 'd MMM')}`
            : 'not entered yet'}
          tone={priceDelta > 0 ? 'warn' : priceDelta < 0 ? 'good' : undefined} />
        <Tile label="This month"
          value={cycleLitres > 0 ? litresText(cycleLitres) : '—'}
          note={thisCycle.length ? `${masked ? MASK : formatCurrencyFull(cyclePaid)} · ${thisCycle.length} fill${thisCycle.length === 1 ? '' : 's'}` : 'no fills'} />
      </div>

      {saved >= 1 && (
        <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
          Discounts saved you{' '}
          <span style={{ fontWeight: 700, color: 'var(--good-ink)' }}>{masked ? MASK : formatCurrencyFull(Math.round(saved))}</span>
          {' '}on the pump total across {savedCount} fill{savedCount === 1 ? '' : 's'}
        </div>
      )}

      {recent.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="h-eyebrow" style={{ marginBottom: 4 }}>Recent fills</div>
          {recent.map(f => (
            <div key={f.tx.id} className="fuel-row">
              <span style={{ color: 'var(--text-3)' }}>{format(parseISO(f.tx.date), 'd MMM')}</span>
              <span className="num">{litresText(f.litres)}{f.pricePerLitre ? <span style={{ color: 'var(--text-4)' }}> · ₹{f.pricePerLitre}/L</span> : null}</span>
              <span className="num" style={{ textAlign: 'right' }}>{masked ? MASK : formatCurrencyFull(f.paid)}</span>
              <span className="num" style={{ textAlign: 'right', fontWeight: 600, color: f.kmPerLitre ? 'var(--good-ink)' : 'var(--text-4)' }}>
                {f.kmPerLitre ? `${f.kmPerLitre.toFixed(1)} km/l` : f.tx.fuelPartial ? 'top-up' : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Tile({ label, value, note, tone }: { label: string; value: string; note: string; tone?: 'good' | 'warn' }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--surface-2)', minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{label}</div>
      <div className="num" style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      <div style={{ fontSize: 10.5, marginTop: 2, color: tone ? `var(--${tone}-ink)` : 'var(--text-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note}</div>
    </div>
  )
}

export default memo(FuelCard)
