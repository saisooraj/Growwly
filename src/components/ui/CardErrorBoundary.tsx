'use client'

import { Component, ReactNode } from 'react'

interface Props { children: ReactNode; label?: string }
interface State { hasError: boolean }

export default class CardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 80, flexDirection: 'column', gap: 6,
        }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            {this.props.label ?? 'Card'} couldn&apos;t load
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{ fontSize: 11, color: 'var(--brand-ink)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
