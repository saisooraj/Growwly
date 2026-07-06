'use client'

import { useRef, useEffect, useState, KeyboardEvent } from 'react'
import AppShell from '@/components/layout/AppShell'
import ChatBubble from '@/components/chat/ChatBubble'
import ActionConfirmCard from '@/components/chat/ActionConfirmCard'
import TypingIndicator from '@/components/chat/TypingIndicator'
import ChatbotSettingsModal from '@/components/chat/ChatbotSettingsModal'
import { useChat } from '@/hooks/useChat'
import { useAuth } from '@/context/AuthContext'
import { Send, RotateCcw, TrendingUp, PiggyBank, CircleDollarSign, BarChart3, Settings2 } from 'lucide-react'

// ── Quick suggestion chips ────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { icon: TrendingUp,        label: 'This month',    text: 'Give me a summary of my spending this month.' },
  { icon: BarChart3,         label: 'Top categories', text: 'Which categories did I spend the most on this month?' },
  { icon: CircleDollarSign,  label: 'vs Last month',  text: 'Compare my spending this month vs last month.' },
  { icon: PiggyBank,         label: 'Savings',        text: 'How are my savings goals and emergency fund progressing?' },
]

// ── Welcome / empty state ─────────────────────────────────────────────────────
function WelcomeScreen({ onQuickPrompt }: { onQuickPrompt: (text: string) => void }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 20px', textAlign: 'center', gap: 22,
    }}>
      {/* Groowtt avatar */}
      <div style={{ position: 'relative', display: 'inline-flex' }}>
        <div style={{
          width: 72, height: 72, borderRadius: 24,
          background: 'linear-gradient(140deg, var(--brand-2), var(--brand))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 34,
          boxShadow: '0 12px 32px -8px var(--brand)',
        }}>
          🌿
        </div>
      </div>

      <div>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
          Hey, I&apos;m Groowtt
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--text-3)', maxWidth: 300, lineHeight: 1.65, marginTop: 6 }}>
          Your AI finance assistant. Ask me anything about your money — spending, savings, budgets, or to log a transaction.
        </div>
      </div>

      {/* Quick prompts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 380 }}>
        {QUICK_PROMPTS.map(({ icon: Icon, label, text }) => (
          <button
            key={label}
            onClick={() => onQuickPrompt(text)}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '11px 14px', borderRadius: 14,
              background: 'var(--surface)', border: '1px solid var(--border)',
              cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              boxShadow: 'var(--elev)',
              transition: 'background .12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
          >
            <Icon size={15} style={{ color: 'var(--brand)', flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)' }}>{label}</span>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--text-4)', maxWidth: 280, lineHeight: 1.6 }}>
        Your financial data is private and only visible to you.
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { user } = useAuth()
  const {
    messages, pendingAction, loading, confirming,
    providerConfig, sendMessage, confirmAction, cancelAction,
    clearMessages, updateProviderConfig,
  } = useChat()

  const [input, setInput]             = useState('')
  const [inputRows, setInputRows]     = useState(1)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const messagesEndRef                = useRef<HTMLDivElement>(null)
  const textareaRef                   = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = () => {
    const text = input.trim()
    if (!text || loading || confirming) return
    setInput('')
    setInputRows(1)
    sendMessage(text)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const lines = e.target.value.split('\n').length
    setInputRows(Math.min(4, Math.max(1, lines)))
  }

  const hasMessages = messages.length > 0

  return (
    <AppShell title="Groowtt">
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: 'calc(100dvh - 64px)',
        maxHeight: 'calc(100dvh - 64px)',
        background: 'var(--bg)',
      }}>

        {/* ── Top bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface)', flexShrink: 0,
          gap: 10,
        }}>
          {/* Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 12, flexShrink: 0,
              background: 'linear-gradient(140deg, var(--brand-2), var(--brand))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }}>
              🌿
            </div>
            <div>
              <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em' }}>Groowtt</span>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                {providerConfig.groqModel.split('-').slice(0, 3).join(' ')}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {hasMessages && (
              <button
                onClick={clearMessages}
                className="btn btn-ghost btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                title="Clear conversation"
              >
                <RotateCcw size={13} />
                <span style={{ fontSize: 12 }}>Clear</span>
              </button>
            )}
            <button
              onClick={() => setSettingsOpen(true)}
              className="btn btn-ghost btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}
              title="Groowtt settings"
            >
              <Settings2 size={15} />
              <span style={{ fontSize: 12 }}>Model</span>
            </button>
          </div>
        </div>

        {/* ── Messages area ── */}
        <div style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          display: 'flex', flexDirection: 'column',
          padding: '16px 14px 8px',
          gap: 14,
        }}>
          {!hasMessages && !loading && (
            <WelcomeScreen onQuickPrompt={text => sendMessage(text)} />
          )}

          {messages.map(msg => {
            // Replace the assistant message that carries the pending action with the confirm card
            if (
              msg.role === 'assistant' &&
              msg.action &&
              pendingAction &&
              msg.action.type === pendingAction.type &&
              msg.id === messages.filter(m => m.action).at(-1)?.id
            ) {
              return (
                <ActionConfirmCard
                  key={msg.id}
                  action={pendingAction}
                  onConfirm={confirmAction}
                  onCancel={cancelAction}
                  loading={confirming}
                />
              )
            }
            return <ChatBubble key={msg.id} message={msg} />
          })}

          {loading && <TypingIndicator />}

          <div ref={messagesEndRef} style={{ height: 4 }} />
        </div>

        {/* ── Input bar ── */}
        <div style={{
          flexShrink: 0,
          padding: '10px 14px 16px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg)',
        }}>
          <div
            style={{
              display: 'flex', alignItems: 'flex-end', gap: 10,
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              borderRadius: 22,
              padding: '6px 6px 6px 14px',
              boxShadow: 'var(--elev)',
              transition: 'border-color .15s',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--brand)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              rows={inputRows}
              placeholder="Ask Groowtt about your finances…"
              disabled={loading || confirming}
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 14, lineHeight: 1.55, resize: 'none', fontFamily: 'inherit',
                color: 'var(--text)', padding: '4px 0', minHeight: 26,
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading || confirming}
              style={{
                width: 38, height: 38, borderRadius: 13, border: 'none', flexShrink: 0,
                background: (!input.trim() || loading || confirming) ? 'var(--surface-2)' : 'var(--brand)',
                color: (!input.trim() || loading || confirming) ? 'var(--text-4)' : '#fff',
                cursor: (!input.trim() || loading || confirming) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background .15s, color .15s',
              }}
            >
              {loading
                ? <span style={{ width: 14, height: 14, border: '2.5px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'gw-spin .7s linear infinite', display: 'inline-block' }} />
                : <Send size={15} strokeWidth={2.2} />
              }
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: 7, fontSize: 11, color: 'var(--text-4)' }}>
            Finance questions only · Enter to send · Shift+Enter for new line
          </div>
        </div>
      </div>

      {/* ── Settings modal ── */}
      {user && (
        <ChatbotSettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          userId={user.uid}
          onSave={cfg => {
            updateProviderConfig(cfg)
            setSettingsOpen(false)
          }}
        />
      )}
    </AppShell>
  )
}
