// Icons (Material Symbols Rounded ligature names) and tint hues for the add-transaction sheet.
// Each hue feeds an oklch tint: a soft background and a darker ink, see `tone` in TxnSheetParts.

export interface SheetMeta { icon: string; h: number }

export const CATEGORY_SHEET_META: Record<string, SheetMeta> = {
  'Food & Dining':      { icon: 'restaurant', h: 35 },
  'Groceries':          { icon: 'shopping_basket', h: 135 },
  'Transport':          { icon: 'directions_bus', h: 245 },
  'Fuel':               { icon: 'local_gas_station', h: 60 },
  'Entertainment':      { icon: 'movie', h: 300 },
  'Shopping':           { icon: 'shopping_bag', h: 330 },
  'Healthcare':         { icon: 'medical_services', h: 15 },
  'Utilities':          { icon: 'bolt', h: 85 },
  'Subscriptions':      { icon: 'autorenew', h: 275 },
  'Personal Care':      { icon: 'spa', h: 350 },
  'Education':          { icon: 'school', h: 230 },
  'Travel':             { icon: 'flight', h: 210 },
  'Fitness':            { icon: 'fitness_center', h: 150 },
  'Home & Maintenance': { icon: 'home_repair_service', h: 50 },
  'Insurance':          { icon: 'shield', h: 260 },
  'Gifts & Donations':  { icon: 'redeem', h: 0 },
  'Living Expenses':    { icon: 'chair', h: 95 },
  'Rent / Deposit':     { icon: 'key', h: 200 },
  'Gold':               { icon: 'diamond', h: 80 },
  'Construction':       { icon: 'construction', h: 45 },
  'Family':             { icon: 'family_restroom', h: 20 },
  'Family Events':      { icon: 'celebration', h: 320 },
  'Food with Her':      { icon: 'favorite', h: 5 },
  'Treat':              { icon: 'icecream', h: 340 },
  'Office Expense':     { icon: 'work', h: 230 },
  'Relationship':       { icon: 'volunteer_activism', h: 10 },
  'Covered for Others': { icon: 'handshake', h: 170 },
  'Other':              { icon: 'more_horiz', h: 250 },
  'Salary':               { icon: 'payments', h: 158 },
  'Freelance':            { icon: 'laptop_mac', h: 245 },
  'Business':             { icon: 'storefront', h: 60 },
  'Rental Income':        { icon: 'apartment', h: 200 },
  'Dividends / Interest': { icon: 'trending_up', h: 140 },
  'Bonus / Gift':         { icon: 'card_giftcard', h: 330 },
  'Other Income':         { icon: 'more_horiz', h: 250 },
}

// Shown when the user has no history yet; their most-used categories replace these
export const DEFAULT_TOP_EXPENSE = ['Food & Dining', 'Groceries', 'Transport', 'Fuel', 'Shopping', 'Utilities', 'Subscriptions']

export const EXPENSE_GROUPS: [string, string[]][] = [
  ['Everyday',      ['Food & Dining', 'Groceries', 'Transport', 'Fuel', 'Shopping', 'Utilities', 'Subscriptions', 'Personal Care']],
  ['Home & family', ['Living Expenses', 'Rent / Deposit', 'Home & Maintenance', 'Family', 'Family Events', 'Construction']],
  ['Lifestyle',     ['Entertainment', 'Travel', 'Fitness', 'Treat', 'Food with Her', 'Relationship', 'Gifts & Donations']],
  ['Money & work',  ['Healthcare', 'Insurance', 'Education', 'Office Expense', 'Gold', 'Covered for Others', 'Other']],
]

export const VEHICLE_SHEET_META: Record<string, SheetMeta> = {
  'Emergency Fund':    { icon: 'health_and_safety', h: 25 },
  'SIP / Investments': { icon: 'trending_up', h: 158 },
  'Stocks':            { icon: 'candlestick_chart', h: 245 },
  'PF / EPF':          { icon: 'account_balance', h: 275 },
  'Gold':              { icon: 'diamond', h: 80 },
  'Fixed Deposit':     { icon: 'lock', h: 200 },
  'Recurring Deposit': { icon: 'event_repeat', h: 180 },
  'Post Office':       { icon: 'local_post_office', h: 15 },
  'NPS':               { icon: 'elderly', h: 300 },
  'Other Savings':     { icon: 'savings', h: 50 },
}

// Stable hue from a name, for avatars and custom categories / vehicles
export function hueOf(name: string): number {
  let x = 7
  for (const c of name) x = (x * 31 + c.charCodeAt(0)) % 360
  return x
}

export function vehicleSheetMeta(vehicle: string): SheetMeta {
  return VEHICLE_SHEET_META[vehicle] ?? { icon: 'savings', h: hueOf(vehicle) }
}
