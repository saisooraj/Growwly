'use client'

export const dynamic = 'force-dynamic'

import { useState, useMemo, useEffect, useRef, useCallback, Suspense, type CSSProperties, type ReactNode } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { format, parseISO, subDays } from 'date-fns'
import { ArrowDown, Calendar, CalendarRange, ChevronLeft, ChevronRight, Download, Hash, ListFilter, PiggyBank, Search, Shapes, SlidersHorizontal, X } from 'lucide-react'
import toast from 'react-hot-toast'
import AppShell from '@/components/layout/AppShell'
import TransactionList, { type DayGroup } from '@/components/transactions/TransactionList'
import TransactionDetailModal, { useIsDesktop, type Notify } from '@/components/transactions/TransactionDetailModal'
import AddTransactionModal from '@/components/transactions/AddTransactionModal'
import BillScannerModal from '@/components/transactions/BillScannerModal'
import {
  CategoryList, DateRangePicker, FilterSheet, Popover, TagChips, TYPE_OPTS, chipStyle, segStyle,
  type CatItem, type Filters, type FilterType, type Preset, type TagItem, type VehicleItem,
} from '@/components/transactions/TxnFilters'
import {
  EmptyFilter, EmptyMonth, EmptySearch, FilterSummary, ListSkeleton, PageToast, SavingsSummary,
  StatusRow, SummaryPhone, type MonthSummary, type Note,
} from '@/components/transactions/TxnParts'
import {
  ChipInner, DesktopHeader, EmptyFilterD, EmptyMonthD, EmptySearchD, FilteredBy, MonthCard, SavingsLine, StatusLine, TopCard,
  filterChipStyle, type TopRow,
} from '@/components/transactions/TxnDesktop'
import { MONO, R, borrowingToViewTx, kindOf, lookOf, matchesQuery, titleOf, type ViewTx } from '@/components/transactions/txnView'
import { getPendingSharedImage, clearPendingSharedImage } from '@/lib/shareTargetDb'
import { useAppStore } from '@/store/appStore'
import {
  buildMonthlySummary, buildSavingsByVehicle, isSavingsTransfer, EXPENSE_CATEGORIES, INCOME_CATEGORIES,
  getTransactionsForMonth, CATEGORY_COLORS, getLast6Months, computeCarryForward, computeMoneyStreak,
} from '@/lib/utils'
import { getCycleRange } from '@/lib/cycle'
import { CategoryIcon, getCategoryDisplayName, getSavingsVehicleMeta } from '@/lib/categoryIcons'

/** Rows render in pages of this many, loading the next as the list end nears */
const PAGE = 100
const REVEAL_KEY = 'txn-reveal'
const TYPE_IDS = new Set<FilterType>(['all', 'expense', 'income', 'savings', 'transfer'])

const monthLabel = (m: string) => format(parseISO(`${m}-01`), 'MMM yyyy')
const dm = (d: string) => format(parseISO(d), 'd MMM')
/** "7 – 13 Nov", or "15 Oct – 13 Nov" across months */
const rangeSub = (a: string, b: string) => (a.slice(0, 7) === b.slice(0, 7) ? `${format(parseISO(a), 'd')} – ${dm(b)}` : `${dm(a)} – ${dm(b)}`)
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const KIND_LABEL = { exp: 'Expense', inc: 'Income', ref: 'Refund', lent: 'Lent', borr: 'Borrowed', sav: 'Savings', savout: 'Savings withdrawal', tin: 'Repayment received', tout: 'Loan repaid' } as const

function TransactionsInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const desktop = useIsDesktop()
  const { transactions, borrowings, selectedMonth, setSelectedMonth, settings, assets, initialized } = useAppStore()

  // ── Shared image → bill scanner ─────────────────────────────────────────────
  const [pendingShareBlob, setPendingShareBlob] = useState<Blob | null>(null)
  useEffect(() => {
    const scanParam = searchParams.get('scan')
    if (scanParam === 'shared') {
      getPendingSharedImage().then(record => {
        if (record) {
          setPendingShareBlob(record.blob)
          clearPendingSharedImage()
        } else {
          toast.error('Shared image not found — please try again')
        }
        router.replace('/transactions')
      })
    } else if (scanParam === 'share-failed') {
      toast.error("Couldn't read the shared image")
      router.replace('/transactions')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Filters (deep links fill them in) ───────────────────────────────────────
  const [filters, setFiltersState] = useState<Filters>(() => {
    const t = searchParams.get('type') as FilterType | null
    return {
      type: t && TYPE_IDS.has(t) ? t : 'all',
      cat: searchParams.get('cat'),
      tag: searchParams.get('tag'),
      vehicle: searchParams.get('vehicle'),
      from: searchParams.get('from'),
      to: searchParams.get('to'),
      preset: searchParams.get('from') || searchParams.get('to') ? 'custom' : null,
      q: searchParams.get('search') ?? '',
    }
  })
  const setFilters = useCallback((p: Partial<Filters>) => setFiltersState(f => ({ ...f, ...p })), [])
  const clearAll = useCallback(() => setFiltersState({ type: 'all', cat: null, tag: null, vehicle: null, from: null, to: null, preset: null, q: '' }), [])
  const backToMonth = () => setFilters({ q: '', from: null, to: null, preset: null })

  // ── View state ──────────────────────────────────────────────────────────────
  const [reveal, setReveal] = useState(false)
  useEffect(() => { try { setReveal(localStorage.getItem(REVEAL_KEY) === '1') } catch { /* private mode */ } }, [])
  function toggleReveal() {
    setReveal(r => {
      try { localStorage.setItem(REVEAL_KEY, r ? '0' : '1') } catch { /* private mode */ }
      return !r
    })
  }
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [visible, setVisible] = useState(PAGE)
  const [sel, setSel] = useState<ViewTx | null>(null)
  const [sheet, setSheet] = useState(false)
  const [pop, setPop] = useState<null | 'cat' | 'tag' | 'date' | 'export' | 'add'>(null)
  const [popCatQ, setPopCatQ] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [toastState, setToastState] = useState<{ text: string; undo?: () => void } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()
  const notify: Notify = useCallback((text, undo) => {
    clearTimeout(toastTimer.current)
    setToastState({ text, undo })
    toastTimer.current = setTimeout(() => setToastState(null), 5000)
  }, [])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  // Desktop: only the header sticks and the page scrolls under it. The right column and day
  // headers stop just below the header rather than behind it. Measured from a ref callback, since
  // the header only mounts once the app's auth gate lets the page render.
  const [headEl, setHeadEl] = useState<HTMLElement | null>(null)
  const [headH, setHeadH] = useState(0)
  useEffect(() => {
    if (!headEl) return
    const ro = new ResizeObserver(() => setHeadH(headEl.offsetHeight))
    ro.observe(headEl)
    return () => ro.disconnect()
  }, [headEl])

  // Open at the top, so nothing starts out tucked under the sticky header after a reload
  useEffect(() => { window.scrollTo(0, 0) }, [])

  // "/" jumps to search on desktop
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!desktop) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [desktop])

  // ── Month ───────────────────────────────────────────────────────────────────
  const months = getLast6Months()
  const mi = months.indexOf(selectedMonth)
  const homeMonth = monthLabel(selectedMonth)
  const today = format(new Date(), 'yyyy-MM-dd')
  const { start, end } = getCycleRange(selectedMonth, settings)
  const rangeText = `${dm(start)} – ${dm(end)}`
  const monthTxs = useMemo(() => getTransactionsForMonth(transactions, selectedMonth, settings), [transactions, selectedMonth, settings])

  const q = filters.q.trim()
  const allTime = !!(q || filters.from || filters.to)
  const anyFilter = allTime || !!filters.cat || !!filters.tag || !!filters.vehicle || filters.type !== 'all'
  const dateActive = !!(filters.from || filters.to)
  const showCat = filters.type !== 'savings' && filters.type !== 'transfer'

  function goMonth(i: number) {
    if (i < 0 || i >= months.length) return
    setSelectedMonth(months[i])
    if (allTime) backToMonth()
  }

  // ── The list ────────────────────────────────────────────────────────────────
  const refundedByOriginal = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of transactions) if (t.type === 'refund' && t.refundOf) map.set(t.refundOf, (map.get(t.refundOf) ?? 0) + t.amount)
    return map
  }, [transactions])

  const list: ViewTx[] = useMemo(() => {
    const source: ViewTx[] = (allTime ? transactions : monthTxs).map(t =>
      t.type === 'expense' && refundedByOriginal.has(t.id) ? { ...t, _refundedAmount: refundedByOriginal.get(t.id) } : t)
    // Unfiltered, loans show as one row per borrowing; their loan_given transfers would double them
    const rows = anyFilter
      ? source
      : [
          ...source.filter(t => !(t.type === 'transfer' && t.transferKind === 'loan_given')),
          ...borrowings.filter(b => b.date >= start && b.date <= end).map(borrowingToViewTx),
        ]
    return rows.filter(t => {
      if (filters.from && t.date < filters.from) return false
      if (filters.to && t.date > filters.to) return false
      const savings = isSavingsTransfer(t)
      switch (filters.type) {
        case 'expense': if (t.type !== 'expense' && t.type !== 'refund') return false; break
        case 'income': if (t.type !== 'income') return false; break
        case 'savings': if (!savings) return false; break
        case 'transfer': if (t.type !== 'transfer' || savings) return false; break
      }
      if (filters.type === 'savings' && filters.vehicle && (t.savingsVehicle ?? '') !== filters.vehicle) return false
      if (showCat && filters.cat && t.category !== filters.cat) return false
      if (filters.tag && !(t.tags ?? []).includes(filters.tag)) return false
      if (q && !matchesQuery(t, q, assets)) return false
      return true
    }).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }, [allTime, transactions, monthTxs, refundedByOriginal, anyFilter, borrowings, start, end, filters, showCat, q, assets])

  // Back to the first page whenever what's listed changes
  useEffect(() => { setVisible(PAGE) }, [filters, selectedMonth])

  const groupsFor = useCallback((rows: ViewTx[]): DayGroup[] => {
    const out: DayGroup[] = []
    let lastMonth: string | null = null
    for (const t of rows) {
      const cur = out[out.length - 1]
      if (cur && cur.key === t.date) { cur.items.push(t); continue }
      const mk = t.date.slice(0, 7)
      out.push({ key: t.date, items: [t], monthBreak: allTime && mk !== lastMonth ? format(parseISO(t.date), 'MMMM yyyy') : null })
      lastMonth = mk
    }
    return out
  }, [allTime])
  const groups = useMemo(() => groupsFor(list.slice(0, visible)), [groupsFor, list, visible])
  const allDays = useMemo(() => Array.from(new Set(list.map(t => t.date))), [list])
  const hasMore = list.length > visible
  const count = list.length
  const anyOpen = allDays.some(d => !collapsed[d])
  function toggleAll() {
    if (!anyOpen) { setCollapsed({}); return }
    setCollapsed(Object.fromEntries(allDays.map(d => [d, true])))
  }

  // Load the next page as the end of the list comes near
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting) setVisible(v => v + PAGE) }, { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, visible])

  // ── Month summary ───────────────────────────────────────────────────────────
  const summary = buildMonthlySummary(transactions, selectedMonth, settings, borrowings)
  const carryForward = useMemo(() => (mi > 0 ? computeCarryForward(months.slice(0, mi), transactions, settings, borrowings) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, selectedMonth, settings, borrowings])
  const monthSummary: MonthSummary = useMemo(() => {
    const inNotes: Note[] = []
    if (summary.totalBorrowed > 0) inNotes.push([`incl. ${R(summary.totalBorrowed)} borrowed`, 'var(--info-ink)'])
    if (summary.repaymentIn > 0) inNotes.push([`← ${R(summary.repaymentIn)} repaid to you`, 'var(--good-ink)'])
    if (carryForward > 0 && mi > 0) inNotes.push([`↩ ${R(carryForward)} from ${monthLabel(months[mi - 1])}`, 'var(--t2)'])
    const outNotes: Note[] = []
    if (summary.totalExpenses > 0) outNotes.push([`${R(summary.totalExpenses)} spent`, 'var(--bad-ink)'])
    if (summary.lentOut > 0) outNotes.push([`${R(summary.lentOut)} lent out`, 'var(--info-ink)'])
    if (summary.repaymentPaid > 0) outNotes.push([`${R(summary.repaymentPaid)} loan repaid`, 'var(--t2)'])
    if (summary.savingsContributed > 0) {
      const net = summary.savingsContributed - summary.savingsWithdrawn
      outNotes.push([`${net < 0 ? '−' : ''}${R(net)} → savings${summary.savingsWithdrawn > 0 ? ` · ${R(summary.savingsContributed)} in − ${R(summary.savingsWithdrawn)} out` : ''}`, 'var(--t2)'])
    }
    return {
      in: summary.totalIncome + summary.totalBorrowed + summary.repaymentIn + carryForward,
      out: summary.totalExpenses + summary.lentOut + summary.repaymentPaid,
      net: summary.cashNet + carryForward,
      inNotes, outNotes, rangeText,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary.totalIncome, summary.totalBorrowed, summary.repaymentIn, summary.totalExpenses, summary.lentOut, summary.repaymentPaid, summary.savingsContributed, summary.savingsWithdrawn, summary.cashNet, carryForward, rangeText, mi])

  // ── Picker data ─────────────────────────────────────────────────────────────
  const { expCats, incCats } = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of monthTxs) counts[t.category] = (counts[t.category] ?? 0) + 1
    const builtIn = new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])
    const item = (id: string, custom = false): CatItem => ({ id, name: getCategoryDisplayName(id), color: CATEGORY_COLORS[id] ?? '#94a3b8', count: counts[id] ?? 0, custom })
    const byName = (a: CatItem, b: CatItem) => a.name.localeCompare(b.name)
    return {
      expCats: [...EXPENSE_CATEGORIES.map(c => item(c)), ...(settings?.customCategories ?? []).filter(c => !builtIn.has(c)).map(c => item(c, true))].sort(byName),
      incCats: INCOME_CATEGORIES.map(c => item(c)).sort(byName),
    }
  }, [monthTxs, settings])

  const tagItems: TagItem[] = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const tag of settings?.customTags ?? []) counts[tag] = 0
    for (const t of transactions) for (const tag of t.tags ?? []) counts[tag] = (counts[tag] ?? 0) + 1
    return Object.keys(counts).sort((a, b) => a.localeCompare(b)).map(tag => ({ tag, count: counts[tag] }))
  }, [transactions, settings])

  const balances = useMemo(() => buildSavingsByVehicle(transactions, settings?.savingsOpeningBalances ?? {}), [transactions, settings])
  const usedVehicles = useMemo(() => Object.keys(balances).sort((a, b) => a.localeCompare(b)), [balances])
  const vehicleItems: VehicleItem[] = [
    { id: null, label: 'All vehicles' },
    ...usedVehicles.map(v => {
      const meta = getSavingsVehicleMeta(v)
      return { id: v, label: v, icon: <meta.Icon size={14} stroke={2} color={filters.vehicle === v ? 'currentColor' : meta.color} /> }
    }),
  ]

  const presets: Preset[] = [
    { id: 'cycle', label: 'This month', sub: rangeSub(start, end), from: start, to: end },
    { id: '7d', label: 'Last 7 days', sub: rangeSub(format(subDays(new Date(), 6), 'yyyy-MM-dd'), today), from: format(subDays(new Date(), 6), 'yyyy-MM-dd'), to: today },
    { id: '30d', label: 'Last 30 days', sub: rangeSub(format(subDays(new Date(), 29), 'yyyy-MM-dd'), today), from: format(subDays(new Date(), 29), 'yyyy-MM-dd'), to: today },
    { id: 'custom', label: 'Custom', sub: 'Pick on calendar', from: null, to: null },
  ]
  const preset = presets.find(p => p.id === filters.preset)
  const dateLabel = dateActive
    ? preset && preset.id !== 'custom' ? preset.label : `${filters.from ? dm(filters.from) : '…'} – ${filters.to ? dm(filters.to) : '…'}`
    : 'Date'

  // ── Summaries over the filtered list ────────────────────────────────────────
  const fsBadges: { label: string; onRemove: () => void }[] = []
  if (showCat && filters.cat) fsBadges.push({ label: getCategoryDisplayName(filters.cat), onRemove: () => setFilters({ cat: null }) })
  if (filters.tag) fsBadges.push({ label: `#${filters.tag}`, onRemove: () => setFilters({ tag: null }) })
  if (dateActive) fsBadges.push({ label: dateLabel, onRemove: () => setFilters({ from: null, to: null, preset: null }) })
  const showFS = fsBadges.length > 0 && filters.type !== 'savings' && count > 0
  const fsTotals = useMemo(() => {
    let spent = 0, income = 0
    for (const t of list) {
      const k = kindOf(t)
      if (k === 'exp') spent += t.amount
      else if (k === 'ref') spent -= t.amount
      else if (k === 'inc') income += t.amount
    }
    return { spent, income }
  }, [list])

  const savingsView = useMemo(() => {
    let inAmt = 0, outAmt = 0
    for (const t of monthTxs) {
      if (!isSavingsTransfer(t) || (filters.vehicle && (t.savingsVehicle ?? '') !== filters.vehicle)) continue
      if (t.transferKind === 'savings_withdrawal' || t.transferKind === 'ef_withdrawal') outAmt += t.amount
      else inAmt += t.amount
    }
    const total = filters.vehicle ? (balances[filters.vehicle]?.balance ?? 0) : Object.values(balances).reduce((s, v) => s + v.balance, 0)
    return { inAmt, outAmt, total }
  }, [monthTxs, filters.vehicle, balances])
  const savMeta = filters.vehicle ? getSavingsVehicleMeta(filters.vehicle) : null
  const savingsSummary = filters.type === 'savings' && (
    <SavingsSummary
      phone={!desktop}
      title={filters.vehicle ? `${filters.vehicle} · balance` : 'Total saved (all-time)'}
      total={savingsView.total}
      color={savMeta?.color ?? '#22c55e'}
      icon={savMeta ? <savMeta.Icon size={20} stroke={2} color={savMeta.color} /> : <PiggyBank size={20} color="#22c55e" />}
      inAmt={savingsView.inAmt} outAmt={savingsView.outAmt}
    />
  )

  // ── Export ──────────────────────────────────────────────────────────────────
  function exportRows(rows: ViewTx[], file: string) {
    const refundLink = (t: ViewTx) => {
      if (t.refundOf) { const o = transactions.find(x => x.id === t.refundOf); return o ? `Refund of ${getCategoryDisplayName(o.category)} ${R(o.amount)} on ${o.date}` : 'Refund' }
      const r = refundedByOriginal.get(t.id)
      return r ? `Refunded ${R(r)}` : ''
    }
    const out = [
      ['Date', 'Title', 'Category', 'Type', 'Amount', 'Notes', 'Tags', 'Refund links'],
      ...rows.map(t => {
        const k = kindOf(t)
        return [t.date, titleOf(k, lookOf(t, k)), t._borrowDir ? '' : getCategoryDisplayName(t.category), KIND_LABEL[k], String(t.amount), t.notes ?? '', (t.tags ?? []).join('; '), refundLink(t)]
      }),
    ]
    const csv = out.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url; a.download = file; a.click()
    URL.revokeObjectURL(url)
    notify(`Exported ${plural(rows.length, 'row')} · ${file}`)
  }
  const monthFile = `growwly-${format(parseISO(`${selectedMonth}-01`), 'MMM-yyyy').toLowerCase()}.csv`
  const exportView = () => { setPop(null); exportRows(list, allTime ? 'growwly-search.csv' : monthFile) }
  const exportViewText = `${plural(count, 'row')} · ${allTime ? 'all time, ' : ''}${anyFilter ? 'with your filters' : 'everything shown'}`
  const exportMonth = () => { setPop(null); exportRows(monthTxs, monthFile) }

  // ── Rail insights ───────────────────────────────────────────────────────────
  const showInsights = filters.type !== 'income' && filters.type !== 'savings'
  const topCats: TopRow[] = Object.entries(summary.byCategory).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a).slice(0, 5)
    .map(([cat, amount]) => {
      const color = CATEGORY_COLORS[cat] ?? '#94a3b8'
      return {
        key: cat, name: getCategoryDisplayName(cat), amount, color, active: filters.cat === cat,
        icon: <CategoryIcon category={cat} size={14} color={color} stroke={2} />,
        onClick: () => setFilters({ cat: filters.cat === cat ? null : cat, type: showCat ? filters.type : 'all' }),
      }
    })
  const topTags: TopRow[] = useMemo(() => {
    const byTag: Record<string, number> = {}
    for (const t of monthTxs) if (t.type === 'expense') for (const tag of t.tags ?? []) byTag[tag] = (byTag[tag] ?? 0) + t.amount
    return Object.entries(byTag).sort(([, a], [, b]) => b - a).slice(0, 5).map(([tag, amount]) => ({
      key: tag, name: `#${tag}`, amount, color: 'var(--wants)', active: filters.tag === tag,
      onClick: () => setFilters({ tag: filters.tag === tag ? null : tag }),
    }))
  }, [monthTxs, filters.tag, setFilters])

  // ── Shared pieces ───────────────────────────────────────────────────────────
  const loading = !initialized
  const nFilters = [filters.type !== 'all', filters.cat, filters.tag, filters.vehicle, dateActive].filter(Boolean).length
  const scopeLabel = q ? 'Searching all time' : 'Date range · all months'
  const monthsSpanned = new Set(list.map(t => t.date.slice(0, 7))).size
  const scopeText = `${plural(count, 'result')}${count ? ` across ${plural(monthsSpanned, 'month')}` : ''}`
  const streak = computeMoneyStreak(transactions, settings?.noSpendDays ?? [])
  const setType = (t: FilterType) => setFilters({ type: t, cat: t === 'savings' || t === 'transfer' ? null : filters.cat, vehicle: t === 'savings' ? filters.vehicle : null })

  const listCard: CSSProperties = { marginTop: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: 'var(--shadow)', padding: '4px 8px 8px' }
  const pillBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 999, background: 'var(--surface)', fontSize: 13, fontWeight: 600, color: 'var(--t1)' }
  const continueToPrev = () => { goMonth(mi - 1); setCollapsed({}); setExpanded({}); window.scrollTo({ top: 0 }) }

  const desktopList = loading ? <div style={listCard}><ListSkeleton /></div> : count > 0 ? (
    <div style={listCard}>
      <TransactionList
        groups={groups} collapsed={collapsed} expanded={expanded} desktop
        onToggle={k => setCollapsed(c => ({ ...c, [k]: !c[k] }))}
        onExpand={k => setExpanded(e => ({ ...e, [k]: true }))}
        onOpen={setSel}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '18px 12px 10px', borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--t3)' }}>
        {hasMore ? (
          <>
            <div ref={sentinel} />
            <span>Showing {visible} of {count}</span>
            <button className="txn-hover" onClick={() => setVisible(v => v + PAGE)} style={pillBtn}>Show more<ArrowDown size={14} /></button>
          </>
        ) : (
          <>
            <span>{allTime ? 'End of results · searched all time' : `That’s everything in ${homeMonth}`}</span>
            {!allTime && mi > 0 && <button className="txn-hover" onClick={continueToPrev} style={pillBtn}>Continue to {monthLabel(months[mi - 1])}<ArrowDown size={14} /></button>}
          </>
        )}
      </div>
    </div>
  ) : !anyFilter ? <EmptyMonthD rangeText={rangeText} onAdd={() => setAddOpen(true)} onScan={() => setScanOpen(true)} />
    : q ? <EmptySearchD q={q} onClear={() => setFilters({ q: '' })} />
    : <EmptyFilterD onClear={clearAll} />

  const listBody = loading ? <ListSkeleton /> : count > 0 ? (
    <div style={{ padding: '4px 4px 0' }}>
      <TransactionList
        groups={groups} collapsed={collapsed} expanded={expanded}
        onToggle={k => setCollapsed(c => ({ ...c, [k]: !c[k] }))}
        onExpand={k => setExpanded(e => ({ ...e, [k]: true }))}
        onOpen={setSel}
      />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '20px 12px 8px', fontSize: 13, color: 'var(--t3)' }}>
        {hasMore ? (
          <>
            <div ref={sentinel} />
            <span>Showing {visible} of {count}</span>
            <button onClick={() => setVisible(v => v + PAGE)} style={{ height: 44, padding: '0 16px', border: '1px solid var(--border)', borderRadius: 999, background: 'var(--surface)', fontSize: 14, fontWeight: 600, color: 'var(--t1)' }}>Show more</button>
          </>
        ) : (
          <>
            <span>{allTime ? 'End of results · searched all time' : `That’s everything in ${homeMonth}`}</span>
            {!allTime && mi > 0 && (
              <button
                onClick={continueToPrev}
                style={{ height: 44, padding: '0 16px', border: '1px solid var(--border)', borderRadius: 999, background: 'var(--surface)', fontSize: 14, fontWeight: 600, color: 'var(--t1)' }}
              >Continue to {monthLabel(months[mi - 1])}</button>
            )}
          </>
        )}
      </div>
    </div>
  ) : !anyFilter ? <EmptyMonth rangeText={rangeText} onAdd={() => setAddOpen(true)} onScan={() => setScanOpen(true)} />
    : q ? <EmptySearch q={q} onClear={() => setFilters({ q: '' })} />
    : <EmptyFilter onClear={clearAll} />

  const status = !loading && (
    <StatusRow
      pad="6px 16px 0" allTime={allTime} scopeLabel={scopeLabel} scopeText={scopeText}
      countLabel={plural(count, 'transaction')} hasRows={count > 0}
      collapseLabel={anyOpen ? 'Collapse all' : 'Expand all'} onToggleAll={toggleAll}
    />
  )

  // ── Desktop chips with popovers ─────────────────────────────────────────────
  const togglePop = (key: NonNullable<typeof pop>) => { setPop(p => (p === key ? null : key)); setPopCatQ('') }
  const closePop = useCallback(() => setPop(null), [])
  const exportOption = (icon: ReactNode, title: string, sub: string, onClick: () => void) => (
    <button className="txn-hover" onClick={onClick} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%', padding: 10, border: 0, borderRadius: 10, background: 'transparent', color: 'var(--t1)', textAlign: 'left' }}>
      <span style={{ display: 'grid', marginTop: 2, flex: 'none' }}>{icon}</span>
      <span>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{title}</span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>{sub}</span>
      </span>
    </button>
  )

  return (
    <AppShell title="Transactions">
      <div className="txn-scope txn-page anim-page" style={{ '--txn-head': `${headH}px` } as CSSProperties}>
        {desktop ? (
          // ── Desktop ──────────────────────────────────────────────────────────
          <>
            <DesktopHeader
              headRef={setHeadEl} monthLabel={allTime ? 'All time' : homeMonth} canPrev={mi > 0} canNext={mi < months.length - 1}
              onPrev={() => goMonth(mi - 1)} onNext={() => goMonth(mi + 1)} streak={streak}
              addOpen={pop === 'add'} onAddToggle={() => togglePop('add')} onAddClose={closePop}
              onManual={() => { setPop(null); setAddOpen(true) }} onScan={() => { setPop(null); setScanOpen(true) }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 28, padding: '0 32px 56px', alignItems: 'start' }}>
              <main style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'relative', zIndex: 3, paddingTop: 24 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <label style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, height: 44, padding: '0 8px 0 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', cursor: 'text' }}>
                    <Search size={18} color="var(--t3)" style={{ flex: 'none' }} />
                    <input
                      ref={searchRef} value={filters.q} onChange={e => setFilters({ q: e.target.value })} placeholder="Search by name, category, amount…"
                      style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', font: 'inherit', fontSize: 15, color: 'var(--t1)' }}
                    />
                    {filters.q && (
                      <button onClick={() => setFilters({ q: '' })} aria-label="Clear search" style={{ width: 28, height: 28, border: 0, borderRadius: 999, background: 'var(--s2)', display: 'grid', placeItems: 'center', color: 'var(--t2)', flex: 'none' }}><X size={14} /></button>
                    )}
                    <kbd style={{ fontFamily: MONO, fontSize: 11, padding: '2px 7px', borderRadius: 5, border: '1px solid var(--border)', color: 'var(--t3)' }}>/</kbd>
                  </label>
                  <div role="tablist" style={{ display: 'flex', padding: 4, gap: 2, background: 'var(--s2)', borderRadius: 12, height: 44, boxSizing: 'border-box', flex: 'none' }}>
                    {TYPE_OPTS.map(o => <button key={o.id} role="tab" aria-selected={filters.type === o.id} onClick={() => setType(o.id)} style={segStyle(filters.type === o.id)}>{o.label}</button>)}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  {showCat && (
                    <Popover open={pop === 'cat'} onClose={closePop} anchor={
                      <button onClick={() => togglePop('cat')} aria-expanded={pop === 'cat'} style={filterChipStyle(!!filters.cat)}>
                        <ChipInner icon={<Shapes size={14} />} label={filters.cat ? getCategoryDisplayName(filters.cat) : 'Category'} active={!!filters.cat} onClear={() => setFilters({ cat: null })} clearLabel="Remove category" />
                      </button>
                    }>
                      <CategoryList exp={expCats} inc={incCats} selected={filters.cat} phone={false} query={popCatQ} onQuery={setPopCatQ}
                        onPick={id => { setFilters({ cat: filters.cat === id ? null : id }); setPop(null) }} />
                    </Popover>
                  )}
                  {filters.type === 'savings' && usedVehicles.length > 0 && vehicleItems.map(v => (
                    <button key={v.label} onClick={() => setFilters({ vehicle: v.id })} style={chipStyle(filters.vehicle === v.id, false)}>{v.icon}{v.label}</button>
                  ))}
                  {tagItems.length > 0 && (
                    <Popover open={pop === 'tag'} onClose={closePop} width={300} padding={12} anchor={
                      <button onClick={() => togglePop('tag')} aria-expanded={pop === 'tag'} style={filterChipStyle(!!filters.tag)}>
                        <ChipInner icon={<Hash size={14} />} label={filters.tag ? `#${filters.tag}` : 'Tag'} active={!!filters.tag} onClear={() => setFilters({ tag: null })} clearLabel="Remove tag" />
                      </button>
                    }>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--t3)', padding: '0 2px 10px' }}>Your tags</div>
                      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                        <TagChips tags={tagItems} selected={filters.tag} phone={false} onPick={t => { setFilters({ tag: filters.tag === t ? null : t }); setPop(null) }} />
                      </div>
                    </Popover>
                  )}
                  <Popover open={pop === 'date'} onClose={closePop} width={520} padding={14} anchor={
                    <button onClick={() => togglePop('date')} aria-expanded={pop === 'date'} style={filterChipStyle(dateActive)}>
                      <ChipInner icon={<CalendarRange size={14} />} label={dateLabel} active={dateActive} onClear={() => setFilters({ from: null, to: null, preset: null })} clearLabel="Remove date range" />
                    </button>
                  }>
                    <DateRangePicker presets={presets} from={filters.from} to={filters.to} preset={filters.preset} onChange={setFilters} phone={false} homeMonth={homeMonth} today={today} />
                  </Popover>
                  <div style={{ flex: 1 }} />
                  <Popover open={pop === 'export'} onClose={closePop} align="right" width={300} padding={6} radius={16} anchor={
                    <button className="txn-hover" onClick={() => togglePop('export')} aria-expanded={pop === 'export'} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'transparent', fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>
                      <Download size={14} />Export
                      <span style={{ fontFamily: MONO, fontSize: 11, padding: '2px 6px', borderRadius: 6, background: 'var(--s2)', color: 'var(--t2)' }}>{count}</span>
                    </button>
                  }>
                    {exportOption(<ListFilter size={16} />, 'Exactly what you see', exportViewText, exportView)}
                    {exportOption(<Calendar size={16} />, `All of ${homeMonth}`, `${plural(monthTxs.length, 'row')} · ignores filters & search`, exportMonth)}
                    <div style={{ padding: '8px 10px 6px', marginTop: 4, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--t3)', lineHeight: 1.5 }}>CSV · date, title, category, type, amount, notes, tags, refund links</div>
                  </Popover>
                </div>
                </div>

                {!loading && (
                  <StatusLine
                    allTime={allTime} scopeLabel={scopeLabel} scopeText={scopeText} homeMonth={homeMonth} onBack={backToMonth}
                    monthLabel={homeMonth} rangeText={rangeText} countLabel={plural(count, 'transaction')}
                    hasRows={count > 0} collapseLabel={anyOpen ? 'Collapse all' : 'Expand all'} onToggleAll={toggleAll}
                  />
                )}
                {showFS && <FilteredBy badges={fsBadges} count={count} spent={fsTotals.spent} income={fsTotals.income} />}
                {filters.type === 'savings' && (
                  <SavingsLine
                    title={filters.vehicle ? `${filters.vehicle} · balance` : 'Total saved (all-time)'} total={savingsView.total}
                    color={savMeta?.color ?? '#22c55e'} homeMonth={homeMonth} inAmt={savingsView.inAmt} outAmt={savingsView.outAmt}
                    icon={savMeta ? <savMeta.Icon size={20} stroke={2} color={savMeta.color} /> : <PiggyBank size={20} color="#22c55e" />}
                  />
                )}
                {desktopList}
              </main>

              <aside style={{ position: 'sticky', top: 'calc(var(--txn-head) + 24px)', marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <MonthCard s={monthSummary} homeMonth={homeMonth} reveal={reveal} onToggle={toggleReveal} loading={loading} />
                {showInsights && !loading && (topCats.length > 0 || topTags.length > 0) && <TopCard cats={topCats} tags={topTags} reveal={reveal} />}
              </aside>
            </div>
          </>
        ) : (
          // ── Phone ────────────────────────────────────────────────────────────
          <>
            {/* Keeps the sticky search bar clear of the status bar */}
            <div aria-hidden style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 'env(safe-area-inset-top, 0px)', background: 'var(--bg)', zIndex: 6 }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 'max(16px, calc(env(safe-area-inset-top, 0px) + 4px)) 16px 14px' }}>
              <h1 style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.025em' }}>Transactions</h1>
              <div style={{ display: 'flex', alignItems: 'center', height: 44, border: '1px solid var(--border)', borderRadius: 999, background: 'var(--surface)' }}>
                <button onClick={() => goMonth(mi - 1)} disabled={mi <= 0} aria-label="Previous month" style={{ width: 40, height: 42, border: 0, background: 'transparent', display: 'grid', placeItems: 'center', color: 'var(--t1)', opacity: mi > 0 ? 1 : 0.35 }}><ChevronLeft size={16} /></button>
                <span style={{ fontSize: 14, fontWeight: 700, minWidth: 66, textAlign: 'center' }}>{allTime ? 'All time' : homeMonth}</span>
                <button onClick={() => goMonth(mi + 1)} disabled={mi >= months.length - 1} aria-label="Next month" style={{ width: 40, height: 42, border: 0, background: 'transparent', display: 'grid', placeItems: 'center', color: 'var(--t1)', opacity: mi < months.length - 1 ? 1 : 0.35 }}><ChevronRight size={16} /></button>
              </div>
            </div>

            <SummaryPhone s={monthSummary} reveal={reveal} onToggle={toggleReveal} loading={loading} year={selectedMonth.slice(0, 4)} />

            <div style={{ position: 'sticky', top: 'env(safe-area-inset-top, 0px)', zIndex: 5, background: 'var(--bg)', padding: '14px 0 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, padding: '0 16px' }}>
                <label style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, height: 48, padding: '0 6px 0 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 }}>
                  <Search size={18} color="var(--t3)" style={{ flex: 'none' }} />
                  <input
                    value={filters.q} onChange={e => setFilters({ q: e.target.value })} placeholder="Search name, category, amount…"
                    style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', font: 'inherit', fontSize: 16, color: 'var(--t1)' }}
                  />
                  {filters.q && (
                    <button onClick={() => setFilters({ q: '' })} aria-label="Clear search" style={{ width: 36, height: 36, border: 0, borderRadius: 999, background: 'var(--s2)', display: 'grid', placeItems: 'center', color: 'var(--t2)', flex: 'none' }}><X size={14} /></button>
                  )}
                </label>
                <button onClick={() => setSheet(true)} aria-label="Filters" style={{ position: 'relative', width: 48, height: 48, flex: 'none', border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', display: 'grid', placeItems: 'center', color: 'var(--t1)' }}>
                  <SlidersHorizontal size={18} />
                  {nFilters > 0 && (
                    <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 20, height: 20, padding: '0 5px', boxSizing: 'border-box', borderRadius: 999, background: 'var(--good)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center', border: '2px solid var(--bg)' }}>{nFilters}</span>
                  )}
                </button>
              </div>
              <div className="txn-noscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 16px' }}>
                {TYPE_OPTS.map(o => <button key={o.id} onClick={() => setType(o.id)} style={chipStyle(filters.type === o.id, true)}>{o.label}</button>)}
              </div>
            </div>

            {status}
            {showFS && <div style={{ margin: '10px 16px 0' }}><FilterSummary phone badges={fsBadges} count={count} spent={fsTotals.spent} income={fsTotals.income} /></div>}
            {savingsSummary && <div style={{ margin: '10px 16px 0' }}>{savingsSummary}</div>}
            {listBody}
          </>
        )}

        {toastState && <PageToast text={toastState.text} onUndo={toastState.undo && (() => { const u = toastState.undo!; setToastState(null); u() })} desktop={desktop} />}
      </div>

      {!desktop && (
        <FilterSheet
          open={sheet} onClose={() => setSheet(false)} filters={filters} setFilters={setFilters} clearAll={clearAll} resultCount={count}
          exp={expCats} inc={incCats} tags={tagItems} presets={presets} vehicles={vehicleItems} homeMonth={homeMonth} today={today}
          dateLabel={dateLabel} exportCount={count} onExport={() => { setSheet(false); exportView() }}
        />
      )}
      <TransactionDetailModal tx={sel} onClose={() => setSel(null)} onNavigate={t => setSel(t)} notify={notify} />
      <AddTransactionModal open={addOpen} onClose={() => setAddOpen(false)} />
      <BillScannerModal
        open={scanOpen || !!pendingShareBlob}
        initialBlob={pendingShareBlob}
        onClose={() => { setScanOpen(false); setPendingShareBlob(null) }}
      />
    </AppShell>
  )
}

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsInner />
    </Suspense>
  )
}
