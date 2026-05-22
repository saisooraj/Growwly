'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight, TrendingUp, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAppStore } from '@/store/appStore'
import { getLast6Months, getMonthLabel } from '@/lib/utils'
import Link from 'next/link'

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="w-8 h-8" />

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}

export default function Header({ title }: { title?: string }) {
  const { selectedMonth, setSelectedMonth } = useAppStore()
  const months = getLast6Months()

  const currentIdx = months.indexOf(selectedMonth)
  const canPrev = currentIdx > 0
  const canNext = currentIdx < months.length - 1

  function prev() { if (canPrev) setSelectedMonth(months[currentIdx - 1]) }
  function next() { if (canNext) setSelectedMonth(months[currentIdx + 1]) }

  return (
    <header className="bg-white dark:bg-[#0A0B14] border-b border-slate-200 dark:border-[#151728] px-4 lg:px-6 h-14 flex items-center justify-between gap-4 sticky top-0 z-40">
      {/* Mobile logo */}
      <Link href="/" className="flex items-center gap-2 lg:hidden">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br from-brand-500 to-fuchsia-500">
          <TrendingUp size={14} className="text-white" />
        </div>
        <span className="font-display font-bold text-sm bg-gradient-to-r from-brand-600 to-fuchsia-500 dark:from-brand-400 dark:to-fuchsia-400 bg-clip-text text-transparent">
          {title ?? 'Growwly'}
        </span>
      </Link>

      {/* Desktop title */}
      <h1 className="hidden lg:block text-base font-semibold text-slate-800 dark:text-slate-100">
        {title ?? 'Dashboard'}
      </h1>

      {/* Right side: month nav + theme toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={prev}
          disabled={!canPrev}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors text-slate-600 dark:text-slate-300"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 min-w-[110px] text-center">
          {getMonthLabel(selectedMonth)}
        </span>
        <button
          onClick={next}
          disabled={!canNext}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors text-slate-600 dark:text-slate-300"
        >
          <ChevronRight size={16} />
        </button>

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
        <ThemeToggle />
      </div>
    </header>
  )
}
