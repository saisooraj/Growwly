import { parseISO } from 'date-fns'
import { Leaf, Flame, Zap, Target, Trophy, Star, Diamond, Crown, Award, Medal, type LucideIcon } from 'lucide-react'

export interface BadgeDef {
  name: string
  threshold: number
  Icon: LucideIcon
  iconColor: string
  description: string
  quote: string
}

export const BADGES: BadgeDef[] = [
  {
    name: 'First Step',
    threshold: 3,
    Icon: Leaf,
    iconColor: '#22c55e',
    description: 'Logged financial activity 3 days in a row — the streak begins.',
    quote: '"The secret of getting ahead is getting started." — Mark Twain',
  },
  {
    name: 'Week Warrior',
    threshold: 7,
    Icon: Flame,
    iconColor: '#f97316',
    description: 'Seven consecutive days of tracking. A full week of awareness.',
    quote: '"Beware of little expenses; a small leak will sink a great ship." — Benjamin Franklin',
  },
  {
    name: 'Fortnight Fire',
    threshold: 14,
    Icon: Zap,
    iconColor: '#eab308',
    description: '14 days straight — your financial habits are sparking into life.',
    quote: '"Small daily disciplines compound into extraordinary results." — Darren Hardy',
  },
  {
    name: 'Habit Locked',
    threshold: 21,
    Icon: Target,
    iconColor: '#3b82f6',
    description: '21 days in a row. Science says the habit is now wired in.',
    quote: '"We are what we repeatedly do. Excellence is not an act but a habit." — Aristotle',
  },
  {
    name: 'Monthly Master',
    threshold: 30,
    Icon: Trophy,
    iconColor: '#f59e0b',
    description: 'A full calendar month of unbroken financial discipline.',
    quote: '"Compound interest is the eighth wonder of the world. He who understands it, earns it." — Albert Einstein',
  },
  {
    name: 'Power Tracker',
    threshold: 45,
    Icon: Star,
    iconColor: '#8b5cf6',
    description: '45 days — your consistency is becoming your superpower.',
    quote: '"A budget is telling your money where to go instead of wondering where it went." — John Maxwell',
  },
  {
    name: 'Iron Discipline',
    threshold: 60,
    Icon: Diamond,
    iconColor: '#06b6d4',
    description: 'Two months of diamond-hard tracking discipline. Rare.',
    quote: '"An investment in knowledge pays the best interest." — Benjamin Franklin',
  },
  {
    name: 'Quarter Legend',
    threshold: 90,
    Icon: Crown,
    iconColor: '#ec4899',
    description: 'Three months of unbroken financial awareness. A true legend.',
    quote: '"Do not save what is left after spending; spend what is left after saving." — Warren Buffett',
  },
  {
    name: 'Half-Year Hero',
    threshold: 180,
    Icon: Award,
    iconColor: '#10b981',
    description: '180 days — half a year of mastering your money. Extraordinary.',
    quote: '"Wealth is not about having a lot of money; it\'s about having a lot of options." — Chris Rock',
  },
  {
    name: 'Year of Mastery',
    threshold: 365,
    Icon: Medal,
    iconColor: '#f97316',
    description: '365 days. A full year of perfect tracking. You\'ve earned legendary status.',
    quote: '"The best time to plant a tree was 20 years ago. The second best time is now." — Chinese Proverb',
  },
]

export function getBadgeEarnedDate(txDates: string[], noSpendDays: string[], threshold: number): string | null {
  const all = Array.from(new Set([...txDates, ...noSpendDays])).sort()
  let current = 0
  for (let i = 0; i < all.length; i++) {
    if (i === 0) { current = 1 }
    else {
      const diff = Math.round((parseISO(all[i]).getTime() - parseISO(all[i - 1]).getTime()) / 86400000)
      current = diff === 1 ? current + 1 : 1
    }
    if (current >= threshold) return all[i]
  }
  return null
}

export const SEEN_BADGES_KEY = 'sw-seen-badges'
