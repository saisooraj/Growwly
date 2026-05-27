import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, setDoc, deleteDoc } from 'firebase/firestore'

export async function POST(req: NextRequest) {
  try {
    const { userId, subscription } = await req.json()
    if (!userId || !subscription) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    await setDoc(doc(db, 'pushSubscriptions', userId), {
      userId,
      subscription,
      updatedAt: new Date().toISOString(),
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('push/subscribe error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    await deleteDoc(doc(db, 'pushSubscriptions', userId))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('push/unsubscribe error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
