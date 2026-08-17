import type { FeedbackType } from '@/types'

export async function submitFeedback(
  idToken: string,
  params: { type: FeedbackType; message: string; context?: string }
): Promise<void> {
  const res = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.error ?? `Failed to submit feedback (${res.status})`)
  }
}
