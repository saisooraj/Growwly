'use client'

import { Children, useState, type ReactNode } from 'react'
import { Collapsible, MONO } from './shared'

function Item({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{title}</span>
      <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55 }}>{children}</span>
    </div>
  )
}

/** Numbers each note 01, 02, … */
function Numbered({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px 28px' }}>
      {Children.toArray(children).map((c, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ font: `600 11px/1 ${MONO}`, color: 'var(--text-3)' }}>{String(i + 1).padStart(2, '0')}</span>
          {c}
        </div>
      ))}
    </div>
  )
}

export default function LearnCard() {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible id="fire-method" open={open} onToggle={() => setOpen(v => !v)} title="How this works, and its limits" sub="Formula, compounding, the 4% rule, risks — 8 short notes">
      <Numbered>
        <Item title="The FI corpus">
          Annual retirement spending ÷ withdrawal rate. At 4% that’s 25× a year’s spending, at 3.5% about 28.6×, at 3% about 33.3×.
          The future target prices today’s spending at the inflation you set: spending × (1 + inflation)<sup>years</sup> ÷ withdrawal rate.
          Tax on withdrawals, if you set it, raises the corpus so the after-tax amount still covers spending.
        </Item>
        <Item title="How the portfolio grows">
          Month by month: each month the balance grows at the monthly equivalent of the annual return, then that month’s SIP is added at the end of the month.
          The SIP steps up once every 12 months from today. FI is the first month the portfolio reaches that month’s target.
        </Item>
        <Item title="Future rupees vs today’s money">
          Returns here are nominal — what a statement would show. To compare with today, future amounts are divided by inflation once.
          Inflation is never also taken off the returns, so it isn’t counted twice.
        </Item>
        <Item title="Why not just use the 4% rule?">
          The 4% rule came from US data for 30-year retirements. Retiring early in India can mean 40–50 years of withdrawals, with inflation that has
          often been higher than in the US. A lower rate (3–3.5%) builds in more room; no rate is guaranteed safe.
        </Item>
        <Item title="Sequence-of-returns risk">
          Two portfolios with the same average return can end very differently if one has its bad years first. A crash right after you retire forces selling
          at low prices to cover spending, and the portfolio may never recover. These projections assume a smooth return every year — real markets don’t move that way,
          and the portfolio may also simply earn less than assumed. Keeping a cash and debt buffer and being able to trim spending in bad years both help.
        </Item>
        <Item title="Taxes, healthcare and emergencies">
          Tax rules change; set the withdrawal tax to what you expect rather than relying on a fixed rate. Medical costs often rise faster than general inflation and
          employer health cover ends when you stop working, so add retirement healthcare separately. Your emergency fund is left out of the FI portfolio by default, since it’s a reserve for emergencies; you can switch it in under What counts toward FI.
        </Item>
        <Item title="Where your numbers come from">
          Expenses and income average your last 12 completed salary cycles that have data (transfers, savings and loans are already left out, refunds are netted).
          Investing is savings put in minus taken out (emergency fund savings only when the fund is switched on), plus EPF credited from your salary. The portfolio uses live prices for your holdings,
          counting each rupee once; property and vehicles are left out unless you switch them on.
        </Item>
        <Item title="What this isn’t">
          A planning tool with assumptions you control — not a forecast, and not financial advice. It never changes your holdings or makes transactions.
        </Item>
      </Numbered>
    </Collapsible>
  )
}
