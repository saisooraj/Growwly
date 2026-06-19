/**
 * Category icon system — replaces emoji with Tabler icons.
 *
 * Predefined categories map to a specific Tabler icon.
 * Custom categories store their icon name as a prefix: "IconMotorbike Bike"
 * Old emoji-prefixed custom categories still render the emoji (backward compat).
 */

import React from 'react'
import {
  IconToolsKitchen2, IconShoppingCart, IconBus, IconGasStation, IconMovie,
  IconShoppingBag, IconBuildingHospital, IconBolt, IconDeviceMobile, IconMassage,
  IconBook, IconPlane, IconBarbell, IconHome, IconShield, IconGift,
  IconBuilding, IconBuildingEstate, IconTrendingUp, IconMedal, IconCrane,
  IconUsers, IconConfetti, IconHeartHandshake, IconAlertOctagon, IconHeart,
  IconStar, IconBriefcase, IconDeviceLaptop, IconChartBar, IconCoin,
  IconPackage, IconKey, IconCamera, IconTrophy, IconPill, IconBuildingBank,
  IconCar, IconTrain, IconMotorbike, IconBike, IconShip,
  IconMeat, IconSalad, IconCoffee, IconBeer, IconGlass, IconFish, IconCake,
  IconBread, IconDeviceGamepad2, IconMusic, IconMicrophone, IconDice,
  IconBallFootball, IconTarget, IconSwimming, IconBath, IconTool,
  IconBulb, IconSofa, IconLeaf, IconDog, IconCat, IconStethoscope,
  IconVaccine, IconDna, IconDental, IconEyeglass, IconCreditCard,
  IconDiamond, IconSchool, IconSun, IconFlame, IconSnowflake, IconDroplet,
  IconDeviceWatch, IconTag, IconRosette, IconPlant, IconWaveSine, IconPizza,
  IconMoodSmile, IconBottle, IconCup, IconBackpack, IconHeartbeat,
  IconBeach,
} from '@tabler/icons-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TablerIconComponent = React.ComponentType<any>

// ── Predefined category → icon component ─────────────────────────────────────

export const CATEGORY_ICON_MAP: Record<string, TablerIconComponent> = {
  'Food & Dining':        IconToolsKitchen2,
  'Groceries':            IconShoppingCart,
  'Transport':            IconBus,
  'Fuel':                 IconGasStation,
  'Entertainment':        IconMovie,
  'Shopping':             IconShoppingBag,
  'Healthcare':           IconBuildingHospital,
  'Utilities':            IconBolt,
  'Subscriptions':        IconDeviceMobile,
  'Personal Care':        IconMassage,
  'Education':            IconBook,
  'Travel':               IconPlane,
  'Fitness':              IconBarbell,
  'Home & Maintenance':   IconHome,
  'Insurance':            IconShield,
  'Gifts & Donations':    IconGift,
  'Living Expenses':      IconBuildingEstate,
  'Rent / Deposit':       IconBuilding,
  'SIP / Investments':    IconTrendingUp,
  'Gold':                 IconMedal,
  'Construction':         IconCrane,
  'Family':               IconUsers,
  'Family Events':        IconConfetti,
  'Borrowed / Loan':      IconHeartHandshake,
  'Emergency Fund':       IconAlertOctagon,
  'Food with Her':        IconHeart,
  'Treat':                IconStar,
  'Office Expense':       IconBriefcase,
  'Relationship':         IconHeart,
  'Covered for Others':   IconHeartHandshake,
  'Bike':                 IconMotorbike,
  'Other':                IconPackage,
  // Income
  'Salary':               IconBriefcase,
  'Freelance':            IconDeviceLaptop,
  'Business':             IconChartBar,
  'Rental Income':        IconBuilding,
  'Dividends / Interest': IconTrendingUp,
  'Bonus / Gift':         IconGift,
  'Other Income':         IconCoin,
}

// ── Curated icon palette for custom categories ─────────────────────────────────

export interface PaletteIcon {
  name: string
  Icon: TablerIconComponent
  label: string
  group: string
}

export const ICON_PALETTE: PaletteIcon[] = [
  // Food & Drink
  { name: 'IconPizza',           Icon: IconPizza,          label: 'Pizza',        group: 'Food' },
  { name: 'IconMeat',            Icon: IconMeat,           label: 'Meat',         group: 'Food' },
  { name: 'IconSalad',           Icon: IconSalad,          label: 'Salad',        group: 'Food' },
  { name: 'IconFish',            Icon: IconFish,           label: 'Fish',         group: 'Food' },
  { name: 'IconCake',            Icon: IconCake,           label: 'Cake',         group: 'Food' },
  { name: 'IconBread',           Icon: IconBread,          label: 'Bread',        group: 'Food' },
  { name: 'IconCoffee',          Icon: IconCoffee,         label: 'Coffee',       group: 'Food' },
  { name: 'IconBeer',            Icon: IconBeer,           label: 'Beer',         group: 'Food' },
  { name: 'IconGlass',           Icon: IconGlass,          label: 'Drink',        group: 'Food' },
  { name: 'IconBottle',          Icon: IconBottle,         label: 'Bottle',       group: 'Food' },
  { name: 'IconCup',             Icon: IconCup,            label: 'Cup',          group: 'Food' },
  { name: 'IconToolsKitchen2',   Icon: IconToolsKitchen2,  label: 'Kitchen',      group: 'Food' },
  // Transport
  { name: 'IconCar',             Icon: IconCar,            label: 'Car',          group: 'Transport' },
  { name: 'IconBus',             Icon: IconBus,            label: 'Bus',          group: 'Transport' },
  { name: 'IconTrain',           Icon: IconTrain,          label: 'Train',        group: 'Transport' },
  { name: 'IconPlane',           Icon: IconPlane,          label: 'Flight',       group: 'Transport' },
  { name: 'IconMotorbike',       Icon: IconMotorbike,      label: 'Motorbike',    group: 'Transport' },
  { name: 'IconBike',            Icon: IconBike,           label: 'Bicycle',      group: 'Transport' },
  { name: 'IconShip',            Icon: IconShip,           label: 'Ship',         group: 'Transport' },
  { name: 'IconGasStation',      Icon: IconGasStation,     label: 'Fuel',         group: 'Transport' },
  // Shopping
  { name: 'IconShoppingBag',     Icon: IconShoppingBag,    label: 'Shopping Bag', group: 'Shopping' },
  { name: 'IconShoppingCart',    Icon: IconShoppingCart,   label: 'Cart',         group: 'Shopping' },
  { name: 'IconBackpack',        Icon: IconBackpack,       label: 'Backpack',     group: 'Shopping' },
  { name: 'IconTag',             Icon: IconTag,            label: 'Tag',          group: 'Shopping' },
  { name: 'IconGift',            Icon: IconGift,           label: 'Gift',         group: 'Shopping' },
  { name: 'IconDeviceWatch',     Icon: IconDeviceWatch,    label: 'Watch',        group: 'Shopping' },
  { name: 'IconDiamond',         Icon: IconDiamond,        label: 'Jewellery',    group: 'Shopping' },
  // Entertainment
  { name: 'IconMovie',           Icon: IconMovie,          label: 'Movie',        group: 'Entertainment' },
  { name: 'IconDeviceGamepad2',  Icon: IconDeviceGamepad2, label: 'Gaming',       group: 'Entertainment' },
  { name: 'IconMusic',           Icon: IconMusic,          label: 'Music',        group: 'Entertainment' },
  { name: 'IconMicrophone',      Icon: IconMicrophone,     label: 'Microphone',   group: 'Entertainment' },
  { name: 'IconDice',            Icon: IconDice,           label: 'Games',        group: 'Entertainment' },
  { name: 'IconBallFootball',    Icon: IconBallFootball,   label: 'Football',     group: 'Entertainment' },
  { name: 'IconTarget',          Icon: IconTarget,         label: 'Target',       group: 'Entertainment' },
  { name: 'IconSwimming',        Icon: IconSwimming,       label: 'Swimming',     group: 'Entertainment' },
  { name: 'IconBarbell',         Icon: IconBarbell,        label: 'Gym',          group: 'Entertainment' },
  { name: 'IconMoodSmile',       Icon: IconMoodSmile,      label: 'Leisure',      group: 'Entertainment' },
  // Home
  { name: 'IconHome',            Icon: IconHome,           label: 'Home',         group: 'Home' },
  { name: 'IconBuilding',        Icon: IconBuilding,       label: 'Office',       group: 'Home' },
  { name: 'IconBath',            Icon: IconBath,           label: 'Bath',         group: 'Home' },
  { name: 'IconTool',            Icon: IconTool,           label: 'Tools',        group: 'Home' },
  { name: 'IconBulb',            Icon: IconBulb,           label: 'Electricity',  group: 'Home' },
  { name: 'IconSofa',            Icon: IconSofa,           label: 'Furniture',    group: 'Home' },
  { name: 'IconLeaf',            Icon: IconLeaf,           label: 'Plant',        group: 'Home' },
  { name: 'IconPlant',           Icon: IconPlant,          label: 'Garden',       group: 'Home' },
  { name: 'IconDog',             Icon: IconDog,            label: 'Pet',          group: 'Home' },
  { name: 'IconCat',             Icon: IconCat,            label: 'Cat',          group: 'Home' },
  // Health
  { name: 'IconPill',            Icon: IconPill,           label: 'Medicine',     group: 'Health' },
  { name: 'IconBuildingHospital',Icon: IconBuildingHospital,label: 'Hospital',    group: 'Health' },
  { name: 'IconStethoscope',     Icon: IconStethoscope,    label: 'Doctor',       group: 'Health' },
  { name: 'IconVaccine',         Icon: IconVaccine,        label: 'Vaccine',      group: 'Health' },
  { name: 'IconDna',             Icon: IconDna,            label: 'DNA',          group: 'Health' },
  { name: 'IconHeart',           Icon: IconHeart,          label: 'Heart',        group: 'Health' },
  { name: 'IconDental',          Icon: IconDental,         label: 'Dental',       group: 'Health' },
  { name: 'IconEyeglass',        Icon: IconEyeglass,       label: 'Eye',          group: 'Health' },
  { name: 'IconMassage',         Icon: IconMassage,        label: 'Spa',          group: 'Health' },
  // Finance & Work
  { name: 'IconCoin',            Icon: IconCoin,           label: 'Cash',         group: 'Finance' },
  { name: 'IconCreditCard',      Icon: IconCreditCard,     label: 'Card',         group: 'Finance' },
  { name: 'IconTrendingUp',      Icon: IconTrendingUp,     label: 'Investment',   group: 'Finance' },
  { name: 'IconBuildingBank',    Icon: IconBuildingBank,   label: 'Bank',         group: 'Finance' },
  { name: 'IconBriefcase',       Icon: IconBriefcase,      label: 'Work',         group: 'Finance' },
  { name: 'IconChartBar',        Icon: IconChartBar,       label: 'Chart',        group: 'Finance' },
  { name: 'IconDeviceLaptop',    Icon: IconDeviceLaptop,   label: 'Laptop',       group: 'Finance' },
  { name: 'IconDeviceMobile',    Icon: IconDeviceMobile,   label: 'Phone',        group: 'Finance' },
  { name: 'IconBook',            Icon: IconBook,           label: 'Book',         group: 'Finance' },
  { name: 'IconSchool',          Icon: IconSchool,         label: 'Education',    group: 'Finance' },
  { name: 'IconMedal',           Icon: IconMedal,          label: 'Medal',        group: 'Finance' },
  // People & Social
  { name: 'IconUsers',           Icon: IconUsers,          label: 'Family',       group: 'Social' },
  { name: 'IconConfetti',        Icon: IconConfetti,       label: 'Celebration',  group: 'Social' },
  { name: 'IconHeartHandshake',  Icon: IconHeartHandshake, label: 'Together',     group: 'Social' },
  { name: 'IconHeartbeat',       Icon: IconHeartbeat,      label: 'Relationship', group: 'Social' },
  { name: 'IconShield',          Icon: IconShield,         label: 'Insurance',    group: 'Social' },
  { name: 'IconAlertOctagon',    Icon: IconAlertOctagon,   label: 'Emergency',    group: 'Social' },
  // Nature & Misc
  { name: 'IconSun',             Icon: IconSun,            label: 'Sun',          group: 'Misc' },
  { name: 'IconFlame',           Icon: IconFlame,          label: 'Fire',         group: 'Misc' },
  { name: 'IconSnowflake',       Icon: IconSnowflake,      label: 'Cold',         group: 'Misc' },
  { name: 'IconDroplet',         Icon: IconDroplet,        label: 'Water',        group: 'Misc' },
  { name: 'IconBolt',            Icon: IconBolt,           label: 'Lightning',    group: 'Misc' },
  { name: 'IconWaveSine',        Icon: IconWaveSine,       label: 'Wave',         group: 'Misc' },
  { name: 'IconStar',            Icon: IconStar,           label: 'Star',         group: 'Misc' },
  { name: 'IconKey',             Icon: IconKey,            label: 'Key',          group: 'Misc' },
  { name: 'IconCamera',          Icon: IconCamera,         label: 'Camera',       group: 'Misc' },
  { name: 'IconRosette',         Icon: IconRosette,        label: 'Badge',        group: 'Misc' },
  { name: 'IconTrophy',          Icon: IconTrophy,         label: 'Trophy',       group: 'Misc' },
  { name: 'IconPackage',         Icon: IconPackage,        label: 'Other',        group: 'Misc' },
  { name: 'IconCrane',           Icon: IconCrane,          label: 'Construction', group: 'Misc' },
]

// Fast lookup: icon name → component
export const ICON_COMPONENT_MAP: Record<string, TablerIconComponent> = Object.fromEntries(
  ICON_PALETTE.map(p => [p.name, p.Icon])
)

// ── Parse custom category string ───────────────────────────────────────────────

export function parseCustomCategory(val: string): { iconName?: string; emoji?: string; name: string } {
  if (!val) return { name: '' }
  const spaceIdx = val.indexOf(' ')
  if (spaceIdx > 0) {
    const prefix = val.slice(0, spaceIdx)
    const name   = val.slice(spaceIdx + 1)
    if (prefix.startsWith('Icon') && ICON_COMPONENT_MAP[prefix]) return { iconName: prefix, name }
    if ((prefix.codePointAt(0) ?? 0) > 255) return { emoji: prefix, name }
  }
  return { name: val }
}

export function buildCustomCategory(iconName: string, name: string): string {
  return `${iconName} ${name}`
}

// ── CategoryIcon component ─────────────────────────────────────────────────────

interface CategoryIconProps {
  category: string
  size?: number
  color?: string
  stroke?: number
}

export function CategoryIcon({ category, size = 16, color = 'currentColor', stroke = 1.5 }: CategoryIconProps) {
  const PredefinedIcon = CATEGORY_ICON_MAP[category]
  if (PredefinedIcon) return <PredefinedIcon size={size} color={color} stroke={stroke} />

  const parsed = parseCustomCategory(category)

  if (parsed.iconName) {
    const CustomIcon = ICON_COMPONENT_MAP[parsed.iconName]
    if (CustomIcon) return <CustomIcon size={size} color={color} stroke={stroke} />
  }

  if (parsed.emoji) {
    return <span style={{ fontSize: size, lineHeight: 1 }}>{parsed.emoji}</span>
  }

  return <IconPackage size={size} color={color} stroke={stroke} />
}

// ── Display name ───────────────────────────────────────────────────────────────

export function getCategoryDisplayName(category: string): string {
  const parsed = parseCustomCategory(category)
  return parsed.name || category
}

// ── Curated icon palette for savings goals ────────────────────────────────────

export const GOAL_ICONS: PaletteIcon[] = [
  { name: 'IconTarget',        Icon: IconTarget,        label: 'Goal',         group: 'Goals' },
  { name: 'IconHome',          Icon: IconHome,          label: 'Home',         group: 'Goals' },
  { name: 'IconBuildingEstate',Icon: IconBuildingEstate,label: 'Property',     group: 'Goals' },
  { name: 'IconCrane',         Icon: IconCrane,         label: 'Construction', group: 'Goals' },
  { name: 'IconPlane',         Icon: IconPlane,         label: 'Travel',       group: 'Goals' },
  { name: 'IconBeach',         Icon: IconBeach,         label: 'Vacation',     group: 'Goals' },
  { name: 'IconCar',           Icon: IconCar,           label: 'Car',          group: 'Goals' },
  { name: 'IconMotorbike',     Icon: IconMotorbike,     label: 'Motorbike',    group: 'Goals' },
  { name: 'IconDeviceMobile',  Icon: IconDeviceMobile,  label: 'Phone',        group: 'Goals' },
  { name: 'IconDeviceLaptop',  Icon: IconDeviceLaptop,  label: 'Laptop',       group: 'Goals' },
  { name: 'IconDeviceWatch',   Icon: IconDeviceWatch,   label: 'Watch',        group: 'Goals' },
  { name: 'IconDiamond',       Icon: IconDiamond,       label: 'Jewellery',    group: 'Goals' },
  { name: 'IconSchool',        Icon: IconSchool,        label: 'Education',    group: 'Goals' },
  { name: 'IconBook',          Icon: IconBook,          label: 'Course',       group: 'Goals' },
  { name: 'IconCoin',          Icon: IconCoin,          label: 'Savings',      group: 'Goals' },
  { name: 'IconTrendingUp',    Icon: IconTrendingUp,    label: 'Investment',   group: 'Goals' },
  { name: 'IconMedal',         Icon: IconMedal,         label: 'Gold',         group: 'Goals' },
  { name: 'IconBuildingBank',  Icon: IconBuildingBank,  label: 'Bank',         group: 'Goals' },
  { name: 'IconAlertOctagon',  Icon: IconAlertOctagon,  label: 'Emergency',    group: 'Goals' },
  { name: 'IconShield',        Icon: IconShield,        label: 'Insurance',    group: 'Goals' },
  { name: 'IconConfetti',      Icon: IconConfetti,      label: 'Celebration',  group: 'Goals' },
  { name: 'IconHeart',         Icon: IconHeart,         label: 'Wedding',      group: 'Goals' },
  { name: 'IconUsers',         Icon: IconUsers,         label: 'Family',       group: 'Goals' },
  { name: 'IconGift',          Icon: IconGift,          label: 'Gift',         group: 'Goals' },
  { name: 'IconShoppingBag',   Icon: IconShoppingBag,   label: 'Shopping',     group: 'Goals' },
  { name: 'IconBarbell',       Icon: IconBarbell,       label: 'Fitness',      group: 'Goals' },
  { name: 'IconTrophy',        Icon: IconTrophy,        label: 'Trophy',       group: 'Goals' },
  { name: 'IconStar',          Icon: IconStar,          label: 'Dream',        group: 'Goals' },
]

// ── Goal icon renderer ────────────────────────────────────────────────────────

const GOAL_EMOJI_ICON_MAP: Record<string, TablerIconComponent> = {
  '🏠': IconHome,  '✈️': IconPlane,  '🚗': IconCar,    '📱': IconDeviceMobile,
  '💍': IconDiamond, '🎓': IconSchool, '💰': IconCoin, '🏖️': IconBeach,
  '🎯': IconTarget, '🛍️': IconShoppingBag, '🏋️': IconBarbell, '💻': IconDeviceLaptop,
}

interface GoalIconProps {
  emoji: string
  size?: number
  color?: string
  stroke?: number
}

export function GoalIcon({ emoji, size = 16, color = 'currentColor', stroke = 1.5 }: GoalIconProps) {
  // New format: bare icon name string like "IconHome"
  if (emoji.startsWith('Icon')) {
    const Icon = ICON_COMPONENT_MAP[emoji]
    if (Icon) return <Icon size={size} color={color} stroke={stroke} />
  }
  // Legacy: emoji mapped to Tabler icon
  const MappedIcon = GOAL_EMOJI_ICON_MAP[emoji]
  if (MappedIcon) return <MappedIcon size={size} color={color} stroke={stroke} />
  // Ultimate fallback: raw emoji text
  return <span style={{ fontSize: size, lineHeight: 1 }}>{emoji}</span>
}
