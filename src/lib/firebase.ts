import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

// Avoid instantiating Firebase at build/SSR time when env vars aren't present.
// All firebase callers are inside 'use client' components so this is safe.
const app =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    ? getApps().length > 0
      ? getApp()
      : initializeApp(firebaseConfig)
    : null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const auth = app ? getAuth(app) : (null as any)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = app ? getFirestore(app) : (null as any)
export const googleProvider = app ? new GoogleAuthProvider() : (null as any)

if (googleProvider) {
  googleProvider.setCustomParameters({ prompt: 'select_account' })
}
