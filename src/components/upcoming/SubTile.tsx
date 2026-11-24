'use client'

import {
  IconBrandAdobe, IconBrandAmazon, IconBrandApple, IconBrandAudible, IconBrandBumble, IconBrandDiscord,
  IconBrandDropbox, IconBrandGithub, IconBrandGoogle, IconBrandGrammarly, IconBrandLinkedin, IconBrandMedium,
  IconBrandNetflix, IconBrandNotion, IconBrandOffice, IconBrandOpenai, IconBrandSpotify, IconBrandTinder,
  IconBrandXbox, IconBrandYoutube, IconBrandZoom, type Icon as TablerIcon,
} from '@tabler/icons-react'
import { matchService, type Service } from '@/lib/subscriptions'
import { catColor } from './upView'

// Services with a Tabler brand mark; the rest get their initial on the brand colour
const ICONS: Record<string, TablerIcon> = {
  netflix: IconBrandNetflix, spotify: IconBrandSpotify, youtube: IconBrandYoutube, prime: IconBrandAmazon,
  applemusic: IconBrandApple, appletv: IconBrandApple, icloud: IconBrandApple, googleone: IconBrandGoogle,
  chatgpt: IconBrandOpenai, microsoft365: IconBrandOffice, adobe: IconBrandAdobe, notion: IconBrandNotion,
  github: IconBrandGithub, linkedin: IconBrandLinkedin, bumble: IconBrandBumble, tinder: IconBrandTinder,
  audible: IconBrandAudible, xbox: IconBrandXbox, dropbox: IconBrandDropbox, zoom: IconBrandZoom,
  discord: IconBrandDiscord, grammarly: IconBrandGrammarly, medium: IconBrandMedium,
}

/** A rounded square with the service's mark, or the name's first letter on its category colour */
export default function SubTile({ label, service, category, size = 44, muted = false }: {
  label: string; service?: Service; category?: string; size?: number; muted?: boolean
}) {
  const svc = service ?? matchService(label)
  const Icon = svc ? ICONS[svc.id] : undefined
  const bg = svc?.color ?? catColor(category)
  const letter = (svc?.name ?? label).trim().charAt(0).toUpperCase() || '•'
  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, borderRadius: Math.round(size * 0.28), flexShrink: 0,
        background: bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: Math.round(size * 0.42), lineHeight: 1,
        filter: muted ? 'grayscale(1)' : undefined, opacity: muted ? 0.55 : 1,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.12)',
      }}
    >
      {Icon ? <Icon size={Math.round(size * 0.56)} stroke={1.8} /> : letter}
    </span>
  )
}
