import { create } from 'zustand'

const KEY = 'growwly-privacy'

// One switch hides every ₹ figure on the home screen (replaces the per-card eyes).
// On by default, remembered per device.
interface PrivacyState {
  masked: boolean
  hydrated: boolean
  setMasked: (v: boolean) => void
  toggle: () => void
  hydrate: () => void
}

export const usePrivacy = create<PrivacyState>((set, get) => ({
  masked: true,
  hydrated: false,
  setMasked: v => {
    set({ masked: v })
    try { localStorage.setItem(KEY, v ? '1' : '0') } catch { /* storage blocked: not remembered */ }
  },
  toggle: () => get().setMasked(!get().masked),
  hydrate: () => {
    if (get().hydrated) return
    let masked = true
    try { masked = localStorage.getItem(KEY) !== '0' } catch { /* storage blocked: stay masked */ }
    set({ masked, hydrated: true })
  },
}))
