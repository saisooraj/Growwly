'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/hooks/useData'
import { TrendingUp } from 'lucide-react'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  useData()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#06030F]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center animate-pulse bg-gradient-to-br from-brand-500 to-fuchsia-500 shadow-lg shadow-brand-500/30">
            <TrendingUp size={24} className="text-white" />
          </div>
          <p className="text-sm text-slate-400 font-medium">Loading Growwly...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
