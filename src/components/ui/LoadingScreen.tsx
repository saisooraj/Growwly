'use client'

import GrowwlyLogo from '@/components/ui/GrowwlyLogo'

export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#06030F]">
      <div className="flex flex-col items-center gap-3">
        <GrowwlyLogo size="md" pulse />
        <p className="text-sm text-slate-400 font-medium">Loading Growwly...</p>
      </div>
    </div>
  )
}
