import { DEFAULT_GROQ_MODEL } from './chatbotConfig'

export interface ChatbotProviderConfig {
  groqModel: string
  groqApiKey: string  // '' = use server env key
}

export const DEFAULT_CHATBOT_CONFIG: ChatbotProviderConfig = {
  groqModel: DEFAULT_GROQ_MODEL,
  groqApiKey: '',
}

function storageKey(userId: string) {
  return `groowtt-settings-${userId}`
}

export function loadChatbotSettings(userId: string): ChatbotProviderConfig {
  if (typeof window === 'undefined') return DEFAULT_CHATBOT_CONFIG
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return DEFAULT_CHATBOT_CONFIG
    return { ...DEFAULT_CHATBOT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_CHATBOT_CONFIG
  }
}

export function saveChatbotSettings(userId: string, config: ChatbotProviderConfig): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(storageKey(userId), JSON.stringify(config))
}
