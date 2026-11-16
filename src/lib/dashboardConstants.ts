export const DEFAULT_CARD_ORDER = [
  'month', 'attention', 'spend', 'week', 'streak',
  'upcoming', 'emergency', 'savings', 'loans', 'goals', 'trends',
]

// The setup tray isn't reorderable (it always sits last) but can be turned off
export const HIDEABLE_EXTRAS = ['tray']

export const CARD_LABELS: Record<string, string> = {
  month:     'Month: health score, verdict and pace',
  attention: 'Needs attention',
  spend:     'Spent today',
  week:      'This week',
  streak:    'Money streak',
  upcoming:  'Upcoming',
  emergency: 'Emergency fund',
  savings:   'Savings',
  loans:     'Loans',
  goals:     'Goals',
  trends:    'Trends: categories and in vs out',
  tray:      'More you can track',
}

// Blocks from before the Nov 2026 redesign, and where their contents went
const LEGACY_BLOCKS: Record<string, string[]> = {
  hero:     ['month', 'spend', 'week', 'streak', 'emergency'],
  insights: ['attention'],
  charts:   ['trends'],
  savings:  ['savings'],
  goals:    ['goals'],
  pulse:    ['month'],
  weekly:   ['upcoming', 'loans'],
}

// A saved order may use the old block IDs or predate newer blocks: map old IDs to
// their new blocks, drop unknown ones, and append any default block missing from it
// so new sections aren't silently hidden
export function resolveCardOrder(saved?: string[] | null): string[] {
  if (!saved?.length) return DEFAULT_CARD_ORDER
  const out: string[] = []
  for (const id of saved) {
    const ids = DEFAULT_CARD_ORDER.includes(id) ? [id] : LEGACY_BLOCKS[id] ?? []
    for (const n of ids) if (!out.includes(n)) out.push(n)
  }
  return [...out, ...DEFAULT_CARD_ORDER.filter(id => !out.includes(id))]
}
