'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Sparkles, Loader2 } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { buildChatContext } from '@/lib/buildChatContext'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'model'
  text: string
}

const SUGGESTIONS = [
  'How much did I spend yesterday?',
  'How much budget is left this month?',
  'Who do I still owe money to?',
  'How is my emergency fund?',
]

export default function ChatBot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { transactions, budgets, borrowings, emergencyFund, projects } = useAppStore()

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
      if (messages.length === 0) {
        setMessages([{
          role: 'model',
          text: "Hi! I'm your Growwly assistant. Ask me anything about your finances — spending, budgets, borrowings, or savings.",
        }])
      }
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text?: string) {
    const message = (text ?? input).trim()
    if (!message || loading) return

    setInput('')
    const userMsg: Message = { role: 'user', text: message }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const context = buildChatContext({ transactions, budgets, borrowings, emergencyFund, projects })
      const history = messages.slice(1).map(m => ({
        role: m.role,
        parts: [{ text: m.text }],
      }))

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, context, history }),
      })

      const data = await res.json()
      setMessages(prev => [...prev, { role: 'model', text: data.reply ?? data.error ?? 'Something went wrong.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'model', text: 'Failed to reach the assistant. Check your connection.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-24 right-4 lg:bottom-6 lg:right-24 z-40 w-13 h-13 flex items-center justify-center rounded-2xl shadow-lg transition-all hover:scale-105',
          'bg-gradient-to-br from-brand-500 to-fuchsia-500 shadow-brand-500/30',
          open && 'hidden'
        )}
        style={{ width: 52, height: 52 }}
        aria-label="Open finance assistant"
      >
        <Sparkles size={22} className="text-white" />
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-0 left-0 mx-3 lg:left-auto lg:right-6 lg:mx-0 lg:w-[380px] z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-[#1E2140]"
          style={{ maxHeight: 'calc(100dvh - 120px)', height: 520 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-brand-600 to-fuchsia-600 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-white" />
              <span className="text-sm font-semibold text-white">Growwly Assistant</span>
              <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded-full">AI</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white dark:bg-[#0F1120]">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                  m.role === 'user'
                    ? 'bg-brand-600 text-white rounded-br-sm'
                    : 'bg-slate-100 dark:bg-[#1a1d30] text-slate-800 dark:text-slate-100 rounded-bl-sm'
                )}>
                  {m.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 dark:bg-[#1a1d30] px-4 py-2.5 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
                  <Loader2 size={13} className="text-brand-500 animate-spin" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">Thinking...</span>
                </div>
              </div>
            )}

            {/* Suggestions (only at start) */}
            {messages.length === 1 && !loading && (
              <div className="space-y-1.5 pt-1">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="w-full text-left text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1a1d30] text-slate-600 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600 dark:hover:text-brand-400 transition-colors border border-slate-100 dark:border-slate-800"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-3 border-t border-slate-100 dark:border-[#1E2140] bg-white dark:bg-[#0F1120] flex-shrink-0">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask about your finances..."
              className="flex-1 text-sm px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1a1d30] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 transition-colors flex-shrink-0"
            >
              <Send size={15} className="text-white" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
