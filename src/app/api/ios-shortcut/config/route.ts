import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { resolveToken } from '@/lib/iosToken'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/utils'
import type { UserSettings } from '@/types'

export const dynamic = 'force-dynamic'

// Lets the shortcut pull the current category list so its picker stays in sync
// with the app (built-in + the user's custom categories).
export async function GET(req: NextRequest) {
  const token =
    req.headers.get('x-growwly-token') || req.nextUrl.searchParams.get('token')

  const resolved = await resolveToken(token)
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid or revoked token' }, { status: 401 })
  }

  let custom: string[] = []
  try {
    const settings = (
      await adminDb.collection('userSettings').doc(resolved.userId).get()
    ).data() as UserSettings | undefined
    custom = settings?.customCategories ?? []
  } catch {
    /* fall back to built-ins only */
  }

  const seen = new Set<string>()
  const expenseCategories = [...EXPENSE_CATEGORIES, ...custom].filter((c) => {
    if (seen.has(c)) return false
    seen.add(c)
    return true
  })

  return NextResponse.json({
    expenseCategories,
    incomeCategories: INCOME_CATEGORIES,
  })
}
