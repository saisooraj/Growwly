'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/hooks/useData'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import LoadingScreen from '@/components/ui/LoadingScreen'
import { ConsentSheet } from '@/components/auth/AuthUI'

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
  if (!privacyAgreed) return <ConsentSheet onAgree={handleAgree} saving={saving} />

  return <>{children}</>
}
