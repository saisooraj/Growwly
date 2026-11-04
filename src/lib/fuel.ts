import type { Transaction, UserSettings, Vehicle } from '@/types'

// ── Fuel log & mileage ───────────────────────────────────────────────────────
// Every Fuel expense is a fill-up. Mileage uses the full-to-full method: between two full
// tanks with odometer readings, the km driven ÷ the litres put in after the first one
// (top-ups included, the closing fill included). Fills in between don't need a reading.
// A Fuel expense with no litres, or one marked "missed a fill-up before this", means fuel
// went in that we can't count, so the interval restarts rather than show a wrong number.

export const FUEL_CATEGORY = 'Fuel'

export const isFuelExpense = (tx: Pick<Transaction, 'type' | 'category'>) =>
  tx.type === 'expense' && tx.category === FUEL_CATEGORY

/** What the pump showed, to the paisa. */
export const pumpTotal = (litres: number, pricePerLitre: number) =>
  Math.round(litres * pricePerLitre * 100) / 100

// ── Pump maths: paid = litres × price − discount ────────────────────────────
// Any two of litres / ₹ per litre / paid give the third. `auto` is the one we filled; it keeps
// following the others until the user types over it. A value the user typed is never replaced.

export const FUEL_CALC = ['litres', 'price', 'amount'] as const
export type FuelCalc = typeof FUEL_CALC[number]
export type FuelNumbers = Record<FuelCalc | 'discount', string>

const round2 = (n: number) => Math.round(n * 100) / 100

export function solveFuel(
  changed: FuelCalc | 'discount', prev: FuelNumbers, next: FuelNumbers, auto: FuelCalc | null,
): { vals: FuelNumbers; auto: FuelCalc | null } {
  const keep = auto === changed ? null : auto
  // A discount comes off what was paid, unless we'd calculated litres or price from it
  const target = changed === 'discount' ? (keep ?? 'amount') : (keep ?? FUEL_CALC.find(f => f !== changed && !next[f]))
  if (!target) return { vals: next, auto: keep }
  const litres = parseFloat(next.litres) || 0
  const price = parseFloat(next.price) || 0
  const paid = parseFloat(next.amount) || 0
  const discount = parseFloat(next.discount) || 0
  const v = target === 'amount'
    ? litres > 0 && price > 0 ? round2(pumpTotal(litres, price) - discount)
      : changed === 'discount' && paid > 0 ? round2(paid - (discount - (parseFloat(prev.discount) || 0)))
      : 0
    : target === 'litres' ? (paid > 0 && price > 0 ? round2((paid + discount) / price) : 0)
    : (paid > 0 && litres > 0 ? round2((paid + discount) / litres) : 0)
  if (!(v > 0)) return { vals: next, auto: keep }
  return { vals: { ...next, [target]: String(v) }, auto: target }
}

/** The vehicle a fill-up belongs to. Fill-ups logged before any vehicle existed go to the first one. */
export function vehicleOf(tx: Transaction, vehicles: Vehicle[]): string | undefined {
  if (tx.vehicleId && vehicles.some(v => v.id === tx.vehicleId)) return tx.vehicleId
  return tx.vehicleId ? undefined : vehicles[0]?.id
}

/** The vehicle to preselect on a new fill-up. */
export function defaultVehicle(settings: UserSettings | null | undefined): Vehicle | undefined {
  const vehicles = settings?.vehicles ?? []
  return vehicles.find(v => v.id === settings?.defaultVehicleId) ?? vehicles[0]
}

export interface FuelFill {
  tx: Transaction
  litres: number           // 0 when not entered
  pricePerLitre: number
  pumpTotal: number        // litres × price; 0 when either is missing
  paid: number
  saved: number            // the discount knocked off the pump total
  km?: number              // set on a full fill that closes a full-to-full interval
  kmPerLitre?: number
}

export interface FuelLog {
  fills: FuelFill[]        // oldest first
  trackedKm: number        // km covered by closed intervals
  trackedLitres: number
  trackedPaid: number
  avgKmPerLitre: number | null
  costPerKm: number | null
  lastOdometer: { km: number; date: string } | null
}

function byFillOrder(a: Transaction, b: Transaction) {
  return a.date.localeCompare(b.date)
    || (a.odometerKm && b.odometerKm ? a.odometerKm - b.odometerKm : 0)
    || a.createdAt.localeCompare(b.createdAt)
}

export function buildFuelLog(transactions: Transaction[], vehicleId: string | undefined, vehicles: Vehicle[]): FuelLog {
  const entries = transactions
    .filter(tx => isFuelExpense(tx) && (vehicles.length === 0 || vehicleOf(tx, vehicles) === vehicleId))
    .sort(byFillOrder)

  const fills: FuelFill[] = []
  let anchorKm: number | null = null
  let litresSince = 0
  let paidSince = 0
  let trackedKm = 0, trackedLitres = 0, trackedPaid = 0
  let lastOdometer: FuelLog['lastOdometer'] = null

  for (const tx of entries) {
    const litres = tx.fuelLitres || 0
    const price = tx.fuelPricePerLitre || 0
    const pump = litres > 0 && price > 0 ? pumpTotal(litres, price) : 0
    // Fill-ups saved before the discount field existed: the gap to the pump, ignoring paise of rounding
    const diff = pump > 0 ? round2(pump - tx.amount) : 0
    const saved = tx.fuelDiscount !== undefined ? tx.fuelDiscount : diff >= 1 ? diff : 0
    const fill: FuelFill = { tx, litres, pricePerLitre: price, pumpTotal: pump, paid: tx.amount, saved }
    fills.push(fill)
    if (tx.odometerKm) lastOdometer = { km: tx.odometerKm, date: tx.date }

    if (litres <= 0 || tx.fuelMissedBefore) { anchorKm = null; litresSince = 0; paidSince = 0 }
    if (litres <= 0) continue

    if (anchorKm !== null) { litresSince += litres; paidSince += tx.amount }

    if (!tx.fuelPartial && tx.odometerKm) {
      if (anchorKm !== null && tx.odometerKm > anchorKm && litresSince > 0) {
        fill.km = tx.odometerKm - anchorKm
        fill.kmPerLitre = fill.km / litresSince
        trackedKm += fill.km
        trackedLitres += litresSince
        trackedPaid += paidSince
      }
      anchorKm = tx.odometerKm
      litresSince = 0
      paidSince = 0
    }
  }

  return {
    fills,
    trackedKm,
    trackedLitres,
    trackedPaid,
    avgKmPerLitre: trackedLitres > 0 ? trackedKm / trackedLitres : null,
    costPerKm: trackedKm > 0 ? trackedPaid / trackedKm : null,
    lastOdometer,
  }
}

// Mileage per fill-up for the transaction list — computed once per transactions snapshot.
const mileageCache = new WeakMap<Transaction[], Map<string, number>>()

export function mileageFor(transactions: Transaction[], settings: UserSettings | null | undefined, txId: string): number | undefined {
  let map = mileageCache.get(transactions)
  if (!map) {
    map = new Map()
    const vehicles = settings?.vehicles ?? []
    const ids = vehicles.length ? vehicles.map(v => v.id) : [undefined]
    for (const id of ids) {
      for (const f of buildFuelLog(transactions, id, vehicles).fills) {
        if (f.kmPerLitre) map.set(f.tx.id, f.kmPerLitre)
      }
    }
    mileageCache.set(transactions, map)
  }
  return map.get(txId)
}
