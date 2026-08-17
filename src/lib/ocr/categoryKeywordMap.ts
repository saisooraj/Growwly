import type { TransactionType } from '@/types'

export const EXPENSE_MERCHANT_KEYWORDS: Record<string, string[]> = {
  'Food & Dining': ['swiggy', 'zomato', 'dominos', "domino's", 'mcdonald', 'kfc', 'starbucks', 'burger king', 'pizza hut', 'restaurant', 'cafe', 'dining', 'eatery'],
  'Groceries': ['bigbasket', 'blinkit', 'zepto', 'dmart', 'instamart', 'grocery', 'groceries', 'supermarket', 'more retail', 'reliance fresh'],
  'Transport': ['uber', 'ola', 'rapido', 'metro', 'taxi', 'cab ride', 'auto fare'],
  'Fuel': ['petrol', 'diesel', 'fuel', 'hpcl', 'bpcl', 'iocl', 'indian oil', 'shell petrol'],
  'Entertainment': ['netflix', 'hotstar', 'prime video', 'spotify', 'bookmyshow', 'pvr', 'inox', 'movie', 'cinema'],
  'Shopping': ['amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'shopping mall'],
  'Healthcare': ['pharmacy', 'hospital', 'clinic', 'apollo', 'practo', 'medplus', 'medical store', 'diagnostic'],
  'Utilities': ['electricity', 'electricity bill', 'water bill', 'broadband', 'airtel', 'jio', 'vodafone', ' vi ', 'bsnl', 'gas bill'],
  'Subscriptions': ['subscription', 'icloud', 'google one', 'microsoft 365'],
  'Personal Care': ['salon', 'spa', 'barber'],
  'Education': ['udemy', 'coursera', 'byju', 'tuition', 'school fee', 'college fee'],
  'Travel': ['makemytrip', 'goibibo', 'irctc', 'indigo', 'spicejet', 'airbnb', 'oyo', 'flight ticket', 'hotel booking'],
  'Fitness': ['gym', 'cult.fit', 'cultfit', 'fitness club'],
  'Insurance': ['lic', 'policybazaar', 'insurance premium'],
  'Gifts & Donations': ['donation', 'charity', 'ngo'],
}

export const INCOME_MERCHANT_KEYWORDS: Record<string, string[]> = {
  'Salary': ['salary credited', 'salary'],
  'Freelance': ['freelance', 'upwork', 'fiverr'],
  'Business': ['business income'],
  'Rental Income': ['rent received', 'rental income'],
  'Dividends / Interest': ['dividend', 'interest credited', 'interest earned'],
  'Bonus / Gift': ['bonus', 'gift received', 'cashback'],
}

export function suggestCategoryFromText(merchant: string | null, fullText: string, type: TransactionType): string {
  const map = type === 'income' ? INCOME_MERCHANT_KEYWORDS : EXPENSE_MERCHANT_KEYWORDS
  const fallback = type === 'income' ? 'Other Income' : 'Other'

  const merchantLower = (merchant ?? '').toLowerCase()
  if (merchantLower) {
    for (const [category, keywords] of Object.entries(map)) {
      if (keywords.some(kw => merchantLower.includes(kw))) return category
    }
  }

  const textLower = fullText.toLowerCase()
  for (const [category, keywords] of Object.entries(map)) {
    if (keywords.some(kw => textLower.includes(kw))) return category
  }

  return fallback
}
