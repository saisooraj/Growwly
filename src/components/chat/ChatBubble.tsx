'use client'

import type { ChatMessage } from '@/lib/ai/types'

interface Props {
  message: ChatMessage
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

// Very lightweight markdown-to-jsx: bold, bullets, line breaks
function renderContent(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let inList = false
  const listItems: React.ReactNode[] = []

  const flushList = () => {
    if (listItems.length) {
      elements.push(
        <ul key={`ul-${elements.length}`} style={{ margin: '6px 0 6px 16px', padding: 0, listStyle: 'disc' }}>
          {listItems.map((li, i) => <li key={i} style={{ marginBottom: 3 }}>{li}</li>)}
        </ul>
      )
      listItems.length = 0
    }
    inList = false
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim()

    // Bullet points
    if (trimmed.startsWith('* ') || trimmed.startsWith('• ') || trimmed.startsWith('- ')) {
      inList = true
      listItems.push(<span>{renderInline(trimmed.slice(2))}</span>)
      return
    }

    if (inList) flushList()

    if (trimmed === '') {
      if (i > 0) elements.push(<div key={`br-${i}`} style={{ height: 6 }} />)
      return
    }

    elements.push(<div key={i}>{renderInline(trimmed)}</div>)
  })

  if (inList) flushList()

  return elements
}

function renderInline(text: string): React.ReactNode {
  // **bold** and `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} style={{ fontFamily: 'monospace', fontSize: '0.9em', background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 4 }}>{part.slice(1, -1)}</code>
    }
    return part
  })
}

export default function ChatBubble({ message }: Props) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ maxWidth: '78%' }}>
          <div style={{
            background: 'var(--brand)',
            color: '#fff',
            borderRadius: '18px 18px 4px 18px',
            padding: '10px 14px',
            fontSize: 14,
            lineHeight: 1.5,
            wordBreak: 'break-word',
          }}>
            {message.content}
          </div>
          <div style={{ textAlign: 'right', marginTop: 4, fontSize: 11, color: 'var(--text-4)' }}>
            {formatTime(message.timestamp)}
          </div>
        </div>
      </div>
    )
  }

  // Assistant bubble
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
      {/* Avatar */}
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(140deg, var(--brand-2), var(--brand))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, color: '#fff', fontWeight: 700,
      }}>
        ✦
      </div>

      <div style={{ maxWidth: '78%' }}>
        <div style={{
          background: message.isError ? 'var(--bad-soft)' : 'var(--surface)',
          border: `1px solid ${message.isError ? 'transparent' : 'var(--border)'}`,
          borderRadius: '18px 18px 18px 4px',
          padding: '10px 14px',
          fontSize: 14,
          lineHeight: 1.6,
          color: message.isError ? 'var(--bad-ink)' : 'var(--text)',
          boxShadow: 'var(--elev)',
          wordBreak: 'break-word',
        }}>
          {renderContent(message.content)}
        </div>
        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-4)' }}>
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  )
}
