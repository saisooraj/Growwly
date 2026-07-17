'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/hooks/useData'
import { ShieldCheck } from 'lucide-react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Link from 'next/link'
import LoadingScreen from '@/components/ui/LoadingScreen'

function PrivacyConsentSheet({ onAgree, saving }: { onAgree: () => void; saving: boolean }) {
  return (
    <div className="min-h-screen bg-[#06030F] flex flex-col items-center justify-end p-4 pb-8">
      <div className="pointer-events-none fixed inset-0 bg-violet-700/10 blur-[130px]" />

      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-7 shadow-2xl relative z-10">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-500/15 border border-brand-500/25 mb-5 mx-auto">
          <ShieldCheck size={22} className="text-brand-400" />
        </div>

        <h2 className="text-white font-bold text-xl text-center mb-2">Privacy Policy</h2>
        <p className="text-slate-400 text-sm text-center mb-6 leading-relaxed">
          We've added a privacy policy. Please review it before continuing.
        </p>

        <button
          onClick={onAgree}
          disabled={saving}
          className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold py-3.5 rounded-2xl transition-colors text-sm mb-3"
        >
          {saving ? 'Saving…' : 'I Understand & Agree'}
        </button>

        <p className="text-center text-xs text-slate-600">
          <Link href="/privacy" className="text-slate-500 hover:text-slate-400 underline underline-offset-2">
            Read full Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  useData()

  const [privacyChecked, setPrivacyChecked] = useState(false)
  const [privacyAgreed, setPrivacyAgreed]   = useState(false)
  const [saving, setSaving]                 = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading])

  useEffect(() => {
    if (!user) return
    getDoc(doc(db, 'users', user.uid))
      .then(snap => {
        setPrivacyAgreed(snap.exists() && !!snap.data()?.privacyAgreed)
        setPrivacyChecked(true)
      })
      .catch(() => {
        setPrivacyAgreed(false)
        setPrivacyChecked(true)
      })
  }, [user?.uid])

  async function handleAgree() {
    if (!user) return
    setSaving(true)
    try {
      await setDoc(doc(db, 'users', user.uid), {
        privacyAgreed: true,
        privacyAgreedAt: new Date().toISOString(),
      }, { merge: true })
      setPrivacyAgreed(true)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !user || !privacyChecked) return <LoadingScreen />
  if (!privacyAgreed) return <PrivacyConsentSheet onAgree={handleAgree} saving={saving} />

  return <>{children}</>
}
