'use client'

export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { TrendingUp, ShieldCheck, BarChart3, Wallet, Zap } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) router.replace('/')
  }, [user, loading])

  async function handleLogin() {
    try {
      await signInWithGoogle()
    } catch {
      toast.error('Sign-in failed. Try again.')
    }
  }

  if (loading) return null

  return (
    <div className="min-h-screen bg-[#06030F] flex items-center justify-center p-4 relative overflow-hidden">

      {/* Background glow blobs */}
      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-violet-700/15 blur-[130px]" />
      <div className="pointer-events-none absolute bottom-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-fuchsia-700/10 blur-[100px]" />
      <div className="pointer-events-none absolute top-10 right-10 w-64 h-64 rounded-full bg-brand-800/10 blur-[80px]" />

      <div className="w-full max-w-md relative z-10">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5
            bg-gradient-to-br from-brand-500 to-fuchsia-500 shadow-2xl shadow-brand-500/30">
            <TrendingUp size={30} className="text-white" />
          </div>
          <h1 className="text-4xl font-display font-bold text-white mb-2 tracking-tight">
            Grow<span className="bg-gradient-to-r from-brand-400 to-fuchsia-400 bg-clip-text text-transparent">wly</span>
          </h1>
          <p className="text-slate-400 text-sm">Your personal finance command centre</p>
        </div>

        {/* Feature pills */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { icon: BarChart3,   label: 'Visual Charts' },
            { icon: Wallet,      label: 'Budget Plans'  },
            { icon: ShieldCheck, label: 'Secure Data'   },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-3.5 text-center hover:bg-white/8 transition-colors"
            >
              <Icon size={20} className="text-brand-400 mx-auto mb-2" />
              <p className="text-xs text-slate-300 font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* Login card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-7 shadow-2xl">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={16} className="text-brand-400" />
            <h2 className="text-base font-semibold text-white">Get started free</h2>
          </div>
          <p className="text-sm text-slate-400 mb-6">
            Track expenses, plan budgets, and take control of your finances.
          </p>

          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-semibold py-3.5 px-4 rounded-2xl transition-colors duration-150 shadow-lg"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-center text-xs text-slate-500 mt-4">
            Data secured with Firebase · Never shared
          </p>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Built for people who want to grow their wealth
        </p>
      </div>
    </div>
  )
}
