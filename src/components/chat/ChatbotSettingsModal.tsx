'use client'

import { useState, useEffect } from 'react'
import { X, Eye, EyeOff, Check, ChevronDown, Zap } from 'lucide-react'
import {
  loadChatbotSettings,
  saveChatbotSettings,
  DEFAULT_CHATBOT_CONFIG,
  type ChatbotProviderConfig,
} from '@/lib/ai/chatbotSettings'
import { GROQ_MODELS, type ModelOption } from '@/lib/ai/chatbotConfig'

interface Props {
  open: boolean
  onClose: () => void
  userId: string
  onSave: (config: ChatbotProviderConfig) => void
}

function Overlay({ onClick }: { onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(8,6,20,.48)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'groowtt-fade-in .18s ease',
      }}
    />
  )
}

function ModelSelect({ label, value, options, onChange }: {
  label: string; value: string; options: ModelOption[]; onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: '100%', padding: '9px 36px 9px 12px', borderRadius: 12,
            border: '1.5px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text)', fontSize: 13.5, fontFamily: 'inherit',
            cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', outline: 'none',
          }}
        >
          {options.map(o => (
            <option key={o.id} value={o.id}>{o.label} — {o.description}</option>
          ))}
        </select>
        <ChevronDown size={15} style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-3)', pointerEvents: 'none',
        }} />
      </div>
    </div>
  )
}

function ApiKeyInput({ label, placeholder, value, hint, onChange }: {
  label: string; placeholder: string; value: string; hint?: string; onChange: (v: string) => void
}) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%', padding: '9px 40px 9px 12px', borderRadius: 12,
            border: '1.5px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text)', fontSize: 13.5, fontFamily: 'monospace',
            outline: 'none', boxSizing: 'border-box',
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--brand)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        />
        <button
          onClick={() => setShow(s => !s)}
          tabIndex={-1}
          type="button"
          style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-3)', padding: 2,
          }}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {hint && <div style={{ fontSize: 11.5, color: 'var(--text-4)', lineHeight: 1.5 }}>{hint}</div>}
    </div>
  )
}

export default function ChatbotSettingsModal({ open, onClose, userId, onSave }: Props) {
  const [config, setConfig] = useState<ChatbotProviderConfig>(DEFAULT_CHATBOT_CONFIG)
  const [saved, setSaved]   = useState(false)

  useEffect(() => {
    if (open) {
      setConfig(loadChatbotSettings(userId))
      setSaved(false)
    }
  }, [open, userId])

  function patch(partial: Partial<ChatbotProviderConfig>) {
    setConfig(prev => ({ ...prev, ...partial }))
    setSaved(false)
  }

  function handleSave() {
    saveChatbotSettings(userId, config)
    onSave(config)
    setSaved(true)
    setTimeout(onClose, 700)
  }

  if (!open) return null

  return (
    <>
      <style>{`
        @keyframes groowtt-fade-in  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes groowtt-slide-up { from { transform: translateY(28px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>

      <Overlay onClick={onClose} />

      <div role="dialog" aria-modal="true" style={{
        position: 'fixed', inset: 0, zIndex: 201,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          width: '100%', maxWidth: 500,
          background: 'var(--surface)', borderRadius: '28px 28px 0 0',
          padding: '6px 20px calc(env(safe-area-inset-bottom, 0px) + 28px)',
          boxShadow: '0 -16px 48px rgba(0,0,0,.2)',
          animation: 'groowtt-slide-up .24s cubic-bezier(.22,1,.36,1)',
          pointerEvents: 'auto',
          maxHeight: '90dvh',
          overflowY: 'auto',
        }}>
          {/* Handle */}
          <div style={{
            width: 40, height: 4, borderRadius: 999,
            background: 'var(--border-strong)', margin: '8px auto 20px', opacity: .6,
          }} />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 12,
                background: 'linear-gradient(140deg, var(--brand-2), var(--brand))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}>🌿</div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>Groowtt Settings</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>AI model configuration</div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: '50%', border: 'none',
                background: 'var(--surface-2)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)',
              }}
            >
              <X size={15} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Active provider badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 15px', borderRadius: 16,
              border: '2px solid var(--brand)', background: 'var(--brand-soft)',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                background: 'var(--brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Zap size={18} style={{ color: '#fff' }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Groq</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Fast inference · Free built-in key</div>
              </div>
              <span style={{
                marginLeft: 'auto', fontSize: 10.5, fontWeight: 700,
                padding: '2px 8px', borderRadius: 999,
                background: 'var(--brand)', color: '#fff', letterSpacing: '.04em',
              }}>Active</span>
            </div>

            {/* Config */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 14,
              padding: 16, borderRadius: 18,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
            }}>
              <ModelSelect
                label="Model"
                value={config.groqModel}
                options={GROQ_MODELS}
                onChange={v => patch({ groqModel: v })}
              />

              <ApiKeyInput
                label="API Key (optional)"
                placeholder="gsk_…"
                value={config.groqApiKey}
                hint="Leave blank to use the built-in app key. Add your own for higher rate limits."
                onChange={v => patch({ groqApiKey: v })}
              />
            </div>

            {/* Security note */}
            <div style={{
              fontSize: 12, color: 'var(--text-4)', padding: '10px 12px',
              borderRadius: 10, background: 'var(--surface-2)', lineHeight: 1.6,
            }}>
              🔒 Your API key is stored locally on this device only and never sent to Growwly servers.
            </div>

            {/* Save */}
            <button
              onClick={handleSave}
              className="btn-brand"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 7, padding: '12px 20px', borderRadius: 14, fontSize: 14, fontWeight: 700,
              }}
            >
              <Check size={16} strokeWidth={2.5} />
              {saved ? 'Saved!' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
