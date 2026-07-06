export interface ModelOption {
  id: string
  label: string
  description: string
}

export const GROQ_MODELS: ModelOption[] = [
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', description: 'Best quality · Recommended' },
  { id: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B',  description: 'Fastest responses' },
  { id: 'gemma2-9b-it',            label: 'Gemma 2 9B',     description: 'Balanced speed & quality' },
  { id: 'mixtral-8x7b-32768',      label: 'Mixtral 8x7B',   description: 'Long context (32k tokens)' },
]

export const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile'

// Tried in order when the chosen model fails with a retryable error (rate limit / unavailable)
export const GROQ_FALLBACK_CHAIN = [
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
  'mixtral-8x7b-32768',
]
