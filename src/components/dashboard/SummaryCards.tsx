'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, ShieldCheck, ArrowUpDown, Eye, EyeOff } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { buildMonthlySummary, formatCurrencyFull, formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

export default function SummaryCards() {
  const [maskIncome, setMaskIncome] = useState(true)
  const [maskExpense, setMaskExpense] = useState(true)
  const { transactions, selectedMonth, emergencyFund, borrowings, budgets } = useAppStore()

  const summary = buildMonthlySummary(transactions, selectedMonth)

  const totalBudget = budgets
    .filter((b) => b.month === selectedMonth)
    .reduce((s, b) => s + b.planned, 0)

  const remaining = totalBudget > 0 ? totalBudget - summary.totalExpenses : null

  const pendingBorrow = borrowings
    .filter((b) => b.type === 'borrowed' && b.status !== 'repaid')
    .reduce((s, b) => s + (b.amount - b.repaidAmount), 0)

  const isDeficit = summary.net < 0
  const efProgress = emergencyFund
    ? Math.min((emergencyFund.currentBalance / emergencyFund.targetAmount) * 100, 100)
    : 0

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">

      {/* Total Income */}
      <div className="card-sm flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">Total Income</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMaskIncome((v) => !v)}
              className="text-slate-300 hover:text-slate-500 transition-colors"
              aria-label={maskIncome ? 'Show income' : 'Hide income'}
            >
              {maskIncome ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-green-50">
              <TrendingUp size={14} className="text-green-600" />
            </div>
          </div>
        </div>
        <p className="text-lg font-bold text-slate-800 leading-tight">
          {maskIncome ? '₹ ••••••' : formatCurrencyFull(summary.totalIncome)}
        </p>
        <p className="text-xs text-slate-400">{selectedMonth}</p>
      </div>

      {/* Total Expenses */}
      <div className="card-sm flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">Total Expenses</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMaskExpense((v) => !v)}
              className="text-slate-300 hover:text-slate-500 transition-colors"
              aria-label={maskExpense ? 'Show expenses' : 'Hide expenses'}
            >
              {maskExpense ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-50">
              <TrendingDown size={14} className="text-red-500" />
            </div>
          </div>
        </div>
        <p className="text-lg font-bold text-slate-800 leading-tight">
          {maskExpense ? '₹ ••••••' : formatCurrencyFull(summary.totalExpenses)}
        </p>
        <p className="text-xs text-slate-400">vs {formatCurrency(totalBudget)} planned</p>
      </div>

      {/* Surplus / Deficit */}
      <div className={cn('card-sm flex flex-col gap-2', isDeficit && 'ring-1 ring-red-200')}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">{isDeficit ? 'Deficit' : 'Surplus'}</span>
          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', isDeficit ? 'bg-red-50' : 'bg-brand-50')}>
            <ArrowUpDown size={14} className={isDeficit ? 'text-red-500' : 'text-brand-600'} />
          </div>
        </div>
        <p className="text-lg font-bold text-slate-800 leading-tight">{formatCurrencyFull(Math.abs(summary.net))}</p>
        <p className={cn('text-xs', isDeficit ? 'text-red-500 font-medium' : 'text-slate-400')}>
          {isDeficit ? 'Cash pressure this month' : 'Great job!'}
        </p>
      </div>

      {/* Remaining Budget */}
      <div className={cn('card-sm flex flex-col gap-2', remaining !== null && remaining < 0 && 'ring-1 ring-red-200')}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">Remaining Budget</span>
          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', remaining !== null && remaining < 0 ? 'bg-orange-50' : 'bg-blue-50')}>
            <Wallet size={14} className={remaining !== null && remaining < 0 ? 'text-orange-500' : 'text-blue-600'} />
          </div>
        </div>
        <p className="text-lg font-bold text-slate-800 leading-tight">
          {remaining !== null ? formatCurrencyFull(Math.abs(remaining)) : '—'}
        </p>
        <p className={cn('text-xs', remaining !== null && remaining < 0 ? 'text-red-500 font-medium' : 'text-slate-400')}>
          {remaining !== null && remaining < 0 ? 'Over budget!' : 'Left to spend'}
        </p>
      </div>

      {/* Borrowed */}
      <div className={cn('card-sm flex flex-col gap-2', pendingBorrow > 0 && 'ring-1 ring-red-200')}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">Borrowed</span>
          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', pendingBorrow > 0 ? 'bg-yellow-50' : 'bg-slate-50')}>
            <AlertTriangle size={14} className={pendingBorrow > 0 ? 'text-yellow-600' : 'text-slate-400'} />
          </div>
        </div>
        <p className="text-lg font-bold text-slate-800 leading-tight">{formatCurrencyFull(pendingBorrow)}</p>
        <p className={cn('text-xs', pendingBorrow > 0 ? 'text-red-500 font-medium' : 'text-slate-400')}>
          {pendingBorrow > 0 ? 'Pending repayment' : 'All clear'}
        </p>
      </div>

      {/* Emergency Fund */}
      <div className={cn('card-sm flex flex-col gap-2', efProgress < 30 && !!emergencyFund && 'ring-1 ring-red-200')}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">Emergency Fund</span>
          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', efProgress < 30 ? 'bg-red-50' : efProgress < 70 ? 'bg-yellow-50' : 'bg-green-50')}>
            <ShieldCheck size={14} className={efProgress < 30 ? 'text-red-500' : efProgress < 70 ? 'text-yellow-600' : 'text-green-600'} />
          </div>
        </div>
        <p className="text-lg font-bold text-slate-800 leading-tight">
          {emergencyFund ? formatCurrencyFull(emergencyFund.currentBalance) : '—'}
        </p>
        <p className={cn('text-xs', efProgress < 30 && !!emergencyFund ? 'text-red-500 font-medium' : 'text-slate-400')}>
          {emergencyFund ? `${efProgress.toFixed(0)}% of target` : 'Not configured'}
        </p>
      </div>

    </div>
  )
}
