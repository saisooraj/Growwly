'use client'

import { useMemo } from 'react'
import { useAppStore } from '@/store/appStore'
import { deriveFireData, type FireData } from '@/lib/fireInputs'
import { toAssumptions } from '@/lib/fireDefaults'
import { computeFire, horizonFor, scenarioOf, SCENARIO_KEYS, type FireAssumptions, type FireResult, type PlanInput, type ScenarioKey } from '@/lib/fire'
import type { AssetWithValue, LivePrices } from '@/lib/assetValuation'
import type { FireSettings } from '@/types'

export interface FirePlan {
  data: FireData
  assumptions: FireAssumptions
  input: PlanInput
  results: Record<ScenarioKey, FireResult>
}

/**
 * The FIRE plan for the signed-in user: inputs worked out from their data, assumptions from
 * their saved settings (or `draft`, while the planner is being edited), and one result per scenario.
 */
export function useFirePlan(valuedAssets: AssetWithValue[], prices: LivePrices, draft?: FireSettings): FirePlan {
  const { transactions, settings, liabilities, emergencyFund } = useAppStore()
  const fire = draft ?? settings?.fire

  const data = useMemo(() => deriveFireData({
    transactions, valuedAssets, prices, liabilities, emergencyFund,
    settings: settings ? { ...settings, fire } : null,
  }), [transactions, valuedAssets, prices, liabilities, emergencyFund, settings, fire])

  const assumptions = useMemo(() => toAssumptions(fire), [fire])

  return useMemo(() => {
    const now = new Date()
    const input: PlanInput = {
      portfolio: data.portfolio.value,
      monthlySip: Math.max(0, data.monthlyInvestment.value),
      spend: { monthly: Math.max(0, data.monthlyExpenses.value) },
      age: data.age,
      startYear: now.getFullYear(),
      startMonthIndex: now.getMonth(),
      horizonMonths: horizonFor(data.age),
    }
    const results = Object.fromEntries(
      SCENARIO_KEYS.map(k => [k, computeFire(input, assumptions, scenarioOf(assumptions, k))]),
    ) as Record<ScenarioKey, FireResult>
    return { data, assumptions, input, results }
  }, [data, assumptions])
}
