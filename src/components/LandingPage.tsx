'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bot, LayoutDashboard, ArrowLeftRight, BarChart2, TrendingUp,
  Target, Users, Bell, MessageSquare, Lock, Smartphone, Zap,
  Moon, MapPin, ShieldCheck, Heart, type LucideIcon,
} from 'lucide-react'
import GrowwlyLogo from '@/components/ui/GrowwlyLogo'

type IconComponent = LucideIcon

// ── Feature carousel data ─────────────────────────────────────────────────────
// AI is deliberately first — it's the most differentiated feature.
interface Feature {
  Icon: IconComponent
  color: string
  name: string
  desc: string
  preview: string
}

const FEATURES: Feature[] = [
  {
    Icon: Bot,
    color: 'oklch(0.58 0.13 286)',
    name: 'Growwly AI',
    desc: 'Ask anything about your money. Log transactions by chat.',
    preview: `
      <div style="display:flex;flex-direction:column;gap:7px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
          <div style="width:20px;height:20px;border-radius:6px;background:color-mix(in oklch,oklch(0.58 0.13 286) 16%,white);display:flex;align-items:center;justify-content:center">
            <svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='oklch(0.58 0.13 286)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M12 8V4H8'/><rect width='16' height='12' x='4' y='8' rx='2'/><path d='M2 14h2'/><path d='M20 14h2'/><path d='M15 13v2'/><path d='M9 13v2'/></svg>
          </div>
          <span style="font-size:10.5px;font-weight:700;color:var(--lp-text-3)">Growwly AI</span>
        </div>
        <div style="align-self:flex-end;max-width:82%;background:var(--lp-border);border-radius:12px 12px 3px 12px;padding:8px 11px;font-size:11.5px;font-weight:600;color:var(--lp-text-2)">
          How much did I spend on food?
        </div>
        <div style="max-width:88%;background:var(--lp-brand-soft);border-radius:12px 12px 12px 3px;padding:8px 11px;font-size:11.5px;font-weight:600;color:var(--lp-brand-deep)">
          You've spent <b>₹2,340</b> on food — 18% more than last week.
        </div>
        <div style="max-width:88%;background:var(--lp-brand-soft);border-radius:12px;padding:8px 11px;font-size:11px;font-weight:600;color:var(--lp-brand-deep);opacity:0.8">
          Want me to add a budget for food?
        </div>
      </div>`,
  },
  {
    Icon: LayoutDashboard,
    color: 'oklch(0.62 0.15 158)',
    name: 'Dashboard',
    desc: 'Your financial pulse — health score, safe to spend, monthly summary.',
    preview: `
      <div style="border-radius:14px;padding:12px;background:linear-gradient(150deg,oklch(0.7 0.14 158),oklch(0.46 0.13 160));color:#fff;margin-bottom:8px;position:relative;overflow:hidden">
        <div style="position:absolute;top:-20px;right:-10px;width:80px;height:80px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.25),transparent 70%)"></div>
        <div style="font-size:9.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;opacity:.8;position:relative">Safe to spend today</div>
        <div style="font-size:26px;font-weight:800;margin-top:3px;position:relative;font-family:monospace">₹18,420</div>
        <div style="font-size:11px;opacity:.85;font-weight:600;position:relative">On track · 12 days left</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:38px;height:38px;border-radius:50%;background:conic-gradient(var(--lp-brand) 0 82%,var(--lp-border) 82%);flex-shrink:0;position:relative;display:flex;align-items:center;justify-content:center">
          <div style="position:absolute;inset:5px;border-radius:50%;background:#fff"></div>
          <span style="position:relative;font-weight:800;font-size:11px;z-index:1">82</span>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;gap:4px">
          <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700"><span style="color:var(--lp-text-3)">Income</span><b style="color:var(--lp-good);font-family:monospace">₹45K</b></div>
          <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700"><span style="color:var(--lp-text-3)">Spent</span><b style="font-family:monospace">₹32K</b></div>
        </div>
      </div>`,
  },
  {
    Icon: ArrowLeftRight,
    color: 'oklch(0.6 0.13 245)',
    name: 'Transactions',
    desc: 'Every rupee tracked and auto-categorized.',
    preview: `
      <div style="display:flex;flex-direction:column;gap:7px">
        <div style="display:flex;align-items:center;gap:8px;padding:5px 0">
          <div style="width:28px;height:28px;border-radius:8px;background:oklch(0.95 0.04 25);flex-shrink:0"></div>
          <div style="flex:1">
            <div style="font-size:11.5px;font-weight:700;color:var(--lp-text)">Swiggy</div>
            <div style="font-size:10px;color:var(--lp-text-3)">Food & Drinks</div>
          </div>
          <b style="font-size:12px;font-family:monospace;color:var(--lp-bad)">−₹380</b>
        </div>
        <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid var(--lp-border)">
          <div style="width:28px;height:28px;border-radius:8px;background:oklch(0.94 0.05 158);flex-shrink:0"></div>
          <div style="flex:1">
            <div style="font-size:11.5px;font-weight:700;color:var(--lp-text)">Salary</div>
            <div style="font-size:10px;color:var(--lp-text-3)">Income</div>
          </div>
          <b style="font-size:12px;font-family:monospace;color:var(--lp-good)">+₹56K</b>
        </div>
        <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid var(--lp-border)">
          <div style="width:28px;height:28px;border-radius:8px;background:oklch(0.94 0.04 245);flex-shrink:0"></div>
          <div style="flex:1">
            <div style="font-size:11.5px;font-weight:700;color:var(--lp-text)">Rent</div>
            <div style="font-size:10px;color:var(--lp-text-3)">Housing</div>
          </div>
          <b style="font-size:12px;font-family:monospace;color:var(--lp-bad)">−₹24K</b>
        </div>
      </div>`,
  },
  {
    Icon: BarChart2,
    color: 'oklch(0.78 0.14 80)',
    name: 'Budget Planning',
    desc: 'Set limits per category, see overruns at a glance.',
    preview: `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div>
          <div style="display:flex;justify-content:space-between;font-size:10.5px;font-weight:700;margin-bottom:5px;color:var(--lp-text-2)">
            <span>Needs</span><span>₹28K / ₹34K</span>
          </div>
          <div style="height:7px;border-radius:99px;background:var(--lp-border);overflow:hidden">
            <div style="width:82%;height:100%;border-radius:99px;background:var(--lp-good)"></div>
          </div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;font-size:10.5px;font-weight:700;margin-bottom:5px;color:var(--lp-text-2)">
            <span>Wants</span><span style="color:var(--lp-bad)">Over budget</span>
          </div>
          <div style="height:7px;border-radius:99px;background:var(--lp-border);overflow:hidden">
            <div style="width:100%;height:100%;border-radius:99px;background:var(--lp-bad)"></div>
          </div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;font-size:10.5px;font-weight:700;margin-bottom:5px;color:var(--lp-text-2)">
            <span>Savings</span><span>100%</span>
          </div>
          <div style="height:7px;border-radius:99px;background:var(--lp-border);overflow:hidden">
            <div style="width:100%;height:100%;border-radius:99px;background:var(--lp-brand)"></div>
          </div>
        </div>
      </div>`,
  },
  {
    Icon: TrendingUp,
    color: 'oklch(0.55 0.16 270)',
    name: 'Net Worth',
    desc: 'Assets minus liabilities — watch your wealth grow month by month.',
    preview: `
      <div style="font-size:22px;font-weight:800;font-family:monospace;color:var(--lp-text)">₹4,97,400</div>
      <div style="font-size:11px;color:var(--lp-good);font-weight:700;margin-bottom:10px">+₹11,200 this month</div>
      <div style="display:flex;height:10px;border-radius:8px;overflow:hidden;margin-bottom:7px">
        <div style="width:62%;background:oklch(0.64 0.16 286)"></div>
        <div style="width:38%;background:oklch(0.64 0.16 200)"></div>
      </div>
      <div style="display:flex;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:5px;font-size:10px;font-weight:700;color:var(--lp-text-2)">
          <span style="width:8px;height:8px;border-radius:2px;background:oklch(0.64 0.16 286);display:inline-block"></span>Assets ₹6.2L
        </div>
        <div style="display:flex;align-items:center;gap:5px;font-size:10px;font-weight:700;color:var(--lp-text-2)">
          <span style="width:8px;height:8px;border-radius:2px;background:oklch(0.64 0.16 200);display:inline-block"></span>Liabilities ₹1.2L
        </div>
      </div>`,
  },
  {
    Icon: Target,
    color: 'oklch(0.6 0.17 340)',
    name: 'Savings Goals',
    desc: 'Create goals, track progress, celebrate milestones.',
    preview: `
      <div style="display:flex;gap:10px;justify-content:center;margin-bottom:4px">
        <div style="text-align:center">
          <div style="width:46px;height:46px;border-radius:50%;background:conic-gradient(oklch(0.6 0.17 340) 0 40%,var(--lp-border) 40%);margin:0 auto;position:relative">
            <div style="position:absolute;inset:6px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:oklch(0.6 0.17 340)">40%</div>
          </div>
          <div style="font-size:9.5px;font-weight:700;margin-top:5px;color:var(--lp-text-2)">Trip</div>
        </div>
        <div style="text-align:center">
          <div style="width:46px;height:46px;border-radius:50%;background:conic-gradient(var(--lp-brand) 0 27%,var(--lp-border) 27%);margin:0 auto;position:relative">
            <div style="position:absolute;inset:6px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:var(--lp-brand-deep)">27%</div>
          </div>
          <div style="font-size:9.5px;font-weight:700;margin-top:5px;color:var(--lp-text-2)">House</div>
        </div>
        <div style="text-align:center">
          <div style="width:46px;height:46px;border-radius:50%;background:conic-gradient(oklch(0.55 0.16 270) 0 68%,var(--lp-border) 68%);margin:0 auto;position:relative">
            <div style="position:absolute;inset:6px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:oklch(0.55 0.16 270)">68%</div>
          </div>
          <div style="font-size:9.5px;font-weight:700;margin-top:5px;color:var(--lp-text-2)">Buffer</div>
        </div>
      </div>`,
  },
  {
    Icon: Users,
    color: 'oklch(0.6 0.13 232)',
    name: 'Borrowings',
    desc: 'Track who you lent to and what you owe — never lose track.',
    preview: `
      <div style="display:flex;flex-direction:column">
        <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--lp-border)">
          <div style="width:28px;height:28px;border-radius:50%;background:oklch(0.94 0.04 232);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:oklch(0.6 0.13 232);flex-shrink:0">R</div>
          <div style="flex:1">
            <div style="font-size:11.5px;font-weight:700;color:var(--lp-text)">Rahul</div>
            <div style="font-size:10px;color:var(--lp-text-3)">Lent · 3 days ago</div>
          </div>
          <b style="color:var(--lp-good);font-size:12px;font-family:monospace">+₹6,800</b>
        </div>
        <div style="display:flex;align-items:center;gap:8px;padding:7px 0">
          <div style="width:28px;height:28px;border-radius:50%;background:oklch(0.95 0.04 25);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:oklch(0.6 0.19 20);flex-shrink:0">P</div>
          <div style="flex:1">
            <div style="font-size:11.5px;font-weight:700;color:var(--lp-text)">Priya</div>
            <div style="font-size:10px;color:var(--lp-text-3)">Borrowed · 1 week ago</div>
          </div>
          <b style="color:var(--lp-bad);font-size:12px;font-family:monospace">−₹1,200</b>
        </div>
      </div>`,
  },
  {
    Icon: Bell,
    color: 'oklch(0.72 0.16 52)',
    name: 'Upcoming Bills',
    desc: 'See every due payment before it sneaks up on you.',
    preview: `
      <div style="display:flex;flex-direction:column;gap:7px">
        <div style="display:flex;align-items:center;gap:8px;padding:3px 0">
          <div style="flex-shrink:0;padding:3px 9px;border-radius:999px;background:oklch(0.95 0.04 25);color:oklch(0.5 0.18 25);font-size:10px;font-weight:700">Overdue</div>
          <div style="flex:1">
            <div style="font-size:11.5px;font-weight:700;color:var(--lp-text)">Credit Card</div>
          </div>
          <span style="font-size:11px;font-family:monospace;color:var(--lp-bad)">₹12,400</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;padding:3px 0;border-top:1px solid var(--lp-border)">
          <div style="flex-shrink:0;padding:3px 9px;border-radius:999px;background:oklch(0.95 0.06 82);color:oklch(0.5 0.13 70);font-size:10px;font-weight:700">2 days</div>
          <div style="flex:1">
            <div style="font-size:11.5px;font-weight:700;color:var(--lp-text)">Netflix</div>
          </div>
          <span style="font-size:11px;font-family:monospace;color:var(--lp-text-2)">₹649</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;padding:3px 0;border-top:1px solid var(--lp-border)">
          <div style="flex-shrink:0;padding:3px 9px;border-radius:999px;background:var(--lp-brand-soft);color:var(--lp-brand-deep);font-size:10px;font-weight:700">Jul 5</div>
          <div style="flex:1">
            <div style="font-size:11.5px;font-weight:700;color:var(--lp-text)">SIP Autopay</div>
          </div>
          <span style="font-size:11px;font-family:monospace;color:var(--lp-text-2)">₹5,000</span>
        </div>
      </div>`,
  },
]

// ── Capability tiles ──────────────────────────────────────────────────────────
interface Tile {
  Icon: IconComponent
  bg: string
  fg: string
  title: string
  desc: string
}

const TILES: Tile[] = [
  { Icon: Bot,        bg: 'oklch(0.94 0.05 158)', fg: 'oklch(0.4 0.13 160)',  title: 'AI Finance Assistant', desc: 'Ask questions, get insights, log transactions by chat.' },
  { Icon: Lock,       bg: 'oklch(0.94 0.04 245)', fg: 'oklch(0.4 0.1 245)',   title: 'Fully Private',        desc: 'Your data lives in your account, never shared.' },
  { Icon: Smartphone, bg: 'oklch(0.95 0.04 286)', fg: 'oklch(0.42 0.12 286)', title: 'Mobile First',         desc: 'Designed for phone, works perfectly on desktop too.' },
  { Icon: Zap,        bg: 'oklch(0.95 0.06 82)',  fg: 'oklch(0.45 0.1 70)',   title: 'Instant Sync',         desc: 'Changes reflect everywhere in real time.' },
  { Icon: Moon,       bg: 'oklch(0.93 0.02 286)', fg: 'oklch(0.35 0.02 286)', title: 'Dark Mode',            desc: 'Easy on the eyes, day or night.' },
  { Icon: MapPin,     bg: 'oklch(0.95 0.05 50)',  fg: 'oklch(0.45 0.13 45)',  title: 'Built for India',      desc: 'INR, Indian number formats, local financial context.' },
]

// ── Scoped CSS ────────────────────────────────────────────────────────────────
const LP_CSS = `
.gw-landing {
  --lp-bg: #F6F5F0;
  --lp-surface: #fff;
  --lp-border: #E2E0D5;
  --lp-text: #14151A;
  --lp-text-2: #51525A;
  --lp-text-3: #8B8C92;
  --lp-brand: oklch(0.62 0.15 158);
  --lp-brand-deep: oklch(0.46 0.13 160);
  --lp-brand-soft: oklch(0.94 0.05 158);
  --lp-good: oklch(0.62 0.15 158);
  --lp-bad: oklch(0.6 0.19 20);
  --lp-shadow: 0 1px 2px rgba(20,21,26,.04), 0 8px 24px -10px rgba(20,21,26,.12);
  --lp-shadow-lg: 0 1px 2px rgba(20,21,26,.05), 0 24px 60px -18px rgba(20,21,26,.22);

  background: var(--lp-bg);
  color: var(--lp-text);
  font-family: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

.gw-landing *, .gw-landing *::before, .gw-landing *::after { box-sizing: border-box; }

.gw-landing h1, .gw-landing h2, .gw-landing h3 {
  margin: 0; letter-spacing: -0.03em; font-weight: 800; color: var(--lp-text);
}
.gw-landing p { margin: 0; }
.gw-landing a { color: var(--lp-brand); text-decoration: none; }
.gw-landing a:hover { color: var(--lp-brand-deep); }

.lp-mono {
  font-family: 'Geist Mono', 'Geist', ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
}

/* ── Layout ── */
.lp-wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px; }

/* ── Buttons ── */
.lp-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 13px 24px; border-radius: 999px; font-weight: 700; font-size: 15px;
  border: none; cursor: pointer;
  transition: transform .15s, box-shadow .15s, background .15s;
  font-family: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
  text-decoration: none;
}
.lp-btn:active { transform: scale(.97); }
.lp-btn-primary {
  background: linear-gradient(150deg, oklch(0.68 0.15 158), var(--lp-brand));
  color: #fff;
  box-shadow: 0 10px 24px -8px var(--lp-brand);
}
.lp-btn-primary:hover { box-shadow: 0 14px 30px -8px var(--lp-brand); }
.lp-btn-ghost {
  background: transparent; color: var(--lp-text); border: 1.5px solid var(--lp-border);
}
.lp-btn-ghost:hover { background: var(--lp-surface); border-color: var(--lp-text-3); }
.lp-btn-white { background: #fff; color: var(--lp-brand-deep); }
.lp-btn-white:hover { background: #f5f5f5; }
.lp-btn-lg { padding: 17px 32px; font-size: 17px; }

/* ── Nav ── */
.lp-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: 16px 0;
  transition: background .25s, box-shadow .25s, backdrop-filter .25s;
}
.lp-nav.lp-scrolled {
  background: rgba(246,245,240,.85);
  backdrop-filter: blur(16px) saturate(160%);
  box-shadow: 0 1px 0 var(--lp-border);
}
.lp-nav-inner { display: flex; align-items: center; justify-content: space-between; }
.lp-logo { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 19px; color: var(--lp-text); }
.lp-nav-actions { display: flex; align-items: center; gap: 10px; }
@media (max-width: 640px) { .lp-nav-actions .lp-btn-ghost { display: none; } }

/* ── Hero ── */
.lp-hero { position: relative; padding: 150px 0 90px; overflow: hidden; background: var(--lp-bg); }
.lp-hero-glow {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(680px 480px at 78% 20%, oklch(0.85 0.1 158 / 0.35), transparent 65%);
}
.lp-hero-grid {
  position: relative; display: grid;
  grid-template-columns: 1fr 1fr; gap: 56px; align-items: center;
}
@media (max-width: 900px) { .lp-hero-grid { grid-template-columns: 1fr; text-align: center; } }
.lp-eyebrow {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: 13px; font-weight: 700; color: var(--lp-brand-deep);
  background: var(--lp-brand-soft); padding: 6px 14px; border-radius: 999px; margin-bottom: 20px;
}
.lp-hero h1 { font-size: 56px; line-height: 1.05; }
@media (max-width: 900px) { .lp-hero h1 { font-size: 38px; } }
.lp-hero-sub { margin-top: 20px; font-size: 18px; color: var(--lp-text-2); max-width: 480px; }
@media (max-width: 900px) { .lp-hero-sub { margin: 20px auto 0; } }
.lp-hero-ctas { display: flex; gap: 12px; margin-top: 32px; flex-wrap: wrap; }
@media (max-width: 900px) { .lp-hero-ctas { justify-content: center; } }

/* ── Hero mockup ── */
.lp-mockup-wrap { position: relative; display: flex; justify-content: center; }
.lp-mockup {
  width: 320px; border-radius: 32px; background: var(--lp-surface);
  border: 1px solid var(--lp-border); box-shadow: var(--lp-shadow-lg); padding: 20px;
}
.lp-mockup-notch { width: 70px; height: 5px; border-radius: 99px; background: var(--lp-border); margin: 0 auto 18px; }
.lp-safe-card {
  border-radius: 20px; padding: 18px;
  background: linear-gradient(150deg, oklch(0.7 0.14 158), var(--lp-brand-deep));
  color: #fff; position: relative; overflow: hidden;
}
.lp-safe-card::after {
  content: ''; position: absolute; top: -30px; right: -20px;
  width: 120px; height: 120px; border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,.3), transparent 70%);
}
.lp-safe-eyebrow { font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: rgba(255,255,255,.8); position: relative; }
.lp-safe-amt { font-size: 34px; font-weight: 800; margin-top: 8px; position: relative; font-family: 'Geist Mono', monospace; }
.lp-safe-sub { font-size: 12.5px; color: rgba(255,255,255,.85); margin-top: 4px; font-weight: 600; position: relative; }
.lp-mockup-row { display: flex; gap: 12px; margin-top: 14px; align-items: center; }
.lp-ring-wrap {
  width: 80px; height: 80px; border-radius: 20px;
  background: var(--lp-bg); border: 1px solid var(--lp-border);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.lp-ring {
  width: 60px; height: 60px; border-radius: 50%;
  background: conic-gradient(var(--lp-brand) 0 82%, var(--lp-border) 82% 100%);
  display: flex; align-items: center; justify-content: center; position: relative;
}
.lp-ring::before { content: ''; position: absolute; inset: 7px; border-radius: 50%; background: var(--lp-surface); }
.lp-ring span { position: relative; font-weight: 800; font-size: 15px; z-index: 1; }
.lp-chip-col { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.lp-chip {
  display: flex; justify-content: space-between;
  background: var(--lp-bg); border: 1px solid var(--lp-border);
  border-radius: 12px; padding: 8px 12px; font-size: 12px; font-weight: 700;
}

/* ── Proof band ── */
.lp-proof { padding: 44px 0; border-top: 1px solid var(--lp-border); border-bottom: 1px solid var(--lp-border); }
.lp-proof-inner { display: flex; align-items: center; justify-content: center; gap: 36px; flex-wrap: wrap; text-align: center; }
.lp-proof-line { font-size: 14px; font-weight: 700; color: var(--lp-text-3); }
.lp-proof-stats { display: flex; gap: 28px; flex-wrap: wrap; justify-content: center; }
.lp-proof-stat { font-size: 14px; font-weight: 700; color: var(--lp-text-2); display: flex; align-items: center; gap: 6px; }
.lp-proof-stat svg { color: var(--lp-brand); flex-shrink: 0; }

/* ── Section ── */
.lp-section { padding: 96px 0; }
.lp-section-head { text-align: center; max-width: 600px; margin: 0 auto 52px; }
.lp-section-head h2 { font-size: 38px; }
@media (max-width: 640px) { .lp-section-head h2 { font-size: 28px; } }
.lp-section-head p { margin-top: 14px; font-size: 16px; color: var(--lp-text-2); }

/* ── Feature carousel ── */
.lp-carousel {
  display: flex; gap: 20px; overflow-x: auto; scroll-snap-type: x mandatory;
  padding: 6px 24px 20px; margin: 0 -24px; scrollbar-width: none;
}
.lp-carousel::-webkit-scrollbar { display: none; }
.lp-fcard {
  flex: 0 0 300px; scroll-snap-align: start;
  background: var(--lp-surface); border: 1px solid var(--lp-border);
  border-radius: 22px; padding: 22px;
  display: flex; flex-direction: column; gap: 14px; box-shadow: var(--lp-shadow);
}
.lp-fcard-icon {
  width: 44px; height: 44px; border-radius: 13px;
  display: flex; align-items: center; justify-content: center;
}
.lp-fcard h3 { font-size: 17px; }
.lp-fcard p { font-size: 13.5px; color: var(--lp-text-2); line-height: 1.5; }
.lp-fcard-preview {
  margin-top: auto; border-radius: 14px;
  background: var(--lp-bg); border: 1px solid var(--lp-border);
  padding: 14px; min-height: 128px;
  display: flex; flex-direction: column; justify-content: center; gap: 8px;
}
.lp-dots { display: flex; justify-content: center; gap: 7px; margin-top: 8px; }
.lp-dot { width: 7px; height: 7px; border-radius: 99px; background: var(--lp-border); transition: all .2s; }
.lp-dot.lp-dot-active { width: 20px; background: var(--lp-brand); }

/* ── Capability grid ── */
.lp-grid6 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
@media (max-width: 900px) { .lp-grid6 { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px) { .lp-grid6 { grid-template-columns: 1fr; } }
.lp-tile {
  background: var(--lp-surface); border: 1px solid var(--lp-border);
  border-radius: 22px; padding: 26px; box-shadow: var(--lp-shadow);
}
.lp-tile-icon {
  width: 46px; height: 46px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center; margin-bottom: 16px;
}
.lp-tile h3 { font-size: 16.5px; margin-bottom: 6px; }
.lp-tile p { font-size: 13.5px; color: var(--lp-text-2); line-height: 1.5; }

/* ── Steps ── */
.lp-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; position: relative; }
@media (max-width: 800px) { .lp-steps { grid-template-columns: 1fr; } }
.lp-steps::before {
  content: ''; position: absolute; top: 26px; left: 16.5%; right: 16.5%;
  border-top: 2px dashed var(--lp-border); z-index: 0;
}
@media (max-width: 800px) { .lp-steps::before { display: none; } }
.lp-step { position: relative; z-index: 1; text-align: center; }
.lp-step-num {
  width: 52px; height: 52px; border-radius: 50%;
  background: var(--lp-brand); color: #fff; font-weight: 800; font-size: 20px;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 18px; box-shadow: 0 10px 24px -8px var(--lp-brand);
}
.lp-step h3 { font-size: 18px; margin-bottom: 8px; }
.lp-step p { font-size: 14px; color: var(--lp-text-2); max-width: 260px; margin: 0 auto; }

/* ── Final CTA ── */
.lp-cta {
  background: linear-gradient(160deg, oklch(0.3 0.08 160), oklch(0.2 0.06 165));
  color: #fff; padding: 100px 0; text-align: center; border-radius: 40px; margin: 0 24px;
}
.lp-cta h2 { font-size: 40px; color: #fff; }
@media (max-width: 640px) { .lp-cta h2 { font-size: 28px; } }
.lp-cta p { margin-top: 14px; font-size: 17px; color: rgba(255,255,255,.75); }
.lp-cta-btn { margin-top: 32px; }
.lp-cta-secure {
  margin-top: 18px; font-size: 13px; color: rgba(255,255,255,.6); font-weight: 600;
  display: flex; align-items: center; justify-content: center; gap: 6px;
}

/* ── Footer ── */
.lp-footer { padding: 40px 0; }
.lp-footer-inner {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 14px; width: 100%;
}
.lp-footer-logo { display: flex; align-items: center; gap: 9px; font-weight: 800; font-size: 15px; color: var(--lp-text); }
.lp-footer-tag { font-size: 13px; color: var(--lp-text-3); margin-top: 2px; }
.lp-footer-made {
  font-size: 13.5px; color: var(--lp-text-3); font-weight: 600;
  display: flex; align-items: center; gap: 5px;
}
`

// ── Component ─────────────────────────────────────────────────────────────────
// Matches AppShell's favicon generator — keeps the brand icon consistent
// on the landing page where AppShell never mounts.
function makeFaviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#22c55e"/>
        <stop offset="100%" stop-color="#16a34a"/>
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="7" fill="url(#g)"/>
    <g transform="translate(6 6) scale(0.833)" fill="none" stroke="white" stroke-opacity="0.95" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
    </g>
  </svg>`
}

export default function LandingPage() {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [activeDot, setActiveDot] = useState(0)
  const carouselRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Set favicon — AppShell normally handles this but doesn't mount on landing page
  useEffect(() => {
    const svgUrl = `data:image/svg+xml,${encodeURIComponent(makeFaviconSvg())}`
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.type = 'image/svg+xml'
    link.href = svgUrl
  }, [])

  function handleCarouselScroll() {
    const el = carouselRef.current
    if (!el || !el.firstElementChild) return
    // Use scroll ratio across the full scrollable range so the last dot
    // activates correctly regardless of how many cards are visible at once.
    const maxScroll = el.scrollWidth - el.clientWidth
    if (maxScroll <= 0) return
    const atEnd = el.scrollLeft >= maxScroll - 8
    if (atEnd) {
      setActiveDot(FEATURES.length - 1)
      return
    }
    const cardW = (el.firstElementChild as HTMLElement).offsetWidth + 20
    setActiveDot(Math.min(FEATURES.length - 1, Math.round(el.scrollLeft / cardW)))
  }

  const goToLogin = () => router.push('/login')
  const scrollToFeatures = () =>
    document.getElementById('lp-features')?.scrollIntoView({ behavior: 'smooth' })

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LP_CSS }} />
      <div className="gw-landing">

        {/* ── Nav ── */}
        <nav className={`lp-nav${scrolled ? ' lp-scrolled' : ''}`}>
          <div className="lp-wrap lp-nav-inner">
            <div className="lp-logo">
              <GrowwlyLogo size="sm" />
              <span>Growwly</span>
            </div>
            <div className="lp-nav-actions">
              <button className="lp-btn lp-btn-ghost" onClick={goToLogin}>Sign In</button>
              <button className="lp-btn lp-btn-primary" onClick={goToLogin}>Get Started</button>
            </div>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="lp-hero">
          <div className="lp-hero-glow" />
          <div className="lp-wrap lp-hero-grid">
            <div>
              <span className="lp-eyebrow">Meet Growwly</span>
              <h1>Your complete<br />money OS</h1>
              <p className="lp-hero-sub">
                Track expenses, plan budgets, monitor net worth, and get AI-powered insights — all in one place.
              </p>
              <div className="lp-hero-ctas">
                <button className="lp-btn lp-btn-primary lp-btn-lg" onClick={goToLogin}>
                  Get Started — it&apos;s free
                </button>
                <button className="lp-btn lp-btn-ghost lp-btn-lg" onClick={scrollToFeatures}>
                  See how it works →
                </button>
              </div>
            </div>

            <div className="lp-mockup-wrap">
              <div className="lp-mockup">
                <div className="lp-mockup-notch" />
                <div className="lp-safe-card">
                  <div className="lp-safe-eyebrow">Safe to Spend Today</div>
                  <div className="lp-safe-amt">₹18,420</div>
                  <div className="lp-safe-sub">On track · 12 days left</div>
                </div>
                <div className="lp-mockup-row">
                  <div className="lp-ring-wrap">
                    <div className="lp-ring"><span>82</span></div>
                  </div>
                  <div className="lp-chip-col">
                    <div className="lp-chip">
                      <span style={{ color: 'var(--lp-text-3)' }}>Income</span>
                      <b className="lp-mono" style={{ color: 'var(--lp-good)' }}>₹45K</b>
                    </div>
                    <div className="lp-chip">
                      <span style={{ color: 'var(--lp-text-3)' }}>Expenses</span>
                      <b className="lp-mono">₹32K</b>
                    </div>
                    <div className="lp-chip">
                      <span style={{ color: 'var(--lp-text-3)' }}>Net</span>
                      <b className="lp-mono" style={{ color: 'var(--lp-good)' }}>+₹13K</b>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Proof ── */}
        <section className="lp-proof">
          <div className="lp-wrap lp-proof-inner">
            <span className="lp-proof-line">Join people who track smarter</span>
            <div className="lp-proof-stats">
              <span className="lp-proof-stat">
                <MessageSquare size={15} />
                ₹2Cr+ tracked
              </span>
              <span className="lp-proof-stat">
                <ArrowLeftRight size={15} />
                10k+ transactions logged
              </span>
              <span className="lp-proof-stat">
                <MapPin size={15} />
                Built for India
              </span>
            </div>
          </div>
        </section>

        {/* ── Feature carousel ── */}
        <section className="lp-section" id="lp-features">
          <div className="lp-wrap">
            <div className="lp-section-head">
              <h2>Everything your finances need</h2>
              <p>Eight tools, one calm app — swipe through what&apos;s inside.</p>
            </div>
            <div className="lp-carousel" ref={carouselRef} onScroll={handleCarouselScroll}>
              {FEATURES.map((f) => (
                <div key={f.name} className="lp-fcard">
                  <div
                    className="lp-fcard-icon"
                    style={{ background: `color-mix(in oklch, ${f.color} 16%, white)` }}
                  >
                    <f.Icon size={22} style={{ color: f.color }} />
                  </div>
                  <h3>{f.name}</h3>
                  <p>{f.desc}</p>
                  <div
                    className="lp-fcard-preview"
                    dangerouslySetInnerHTML={{ __html: f.preview }}
                  />
                </div>
              ))}
            </div>
            <div className="lp-dots">
              {FEATURES.map((_, i) => (
                <span key={i} className={`lp-dot${i === activeDot ? ' lp-dot-active' : ''}`} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Capability grid ── */}
        <section className="lp-section" style={{ paddingTop: 0 }}>
          <div className="lp-wrap">
            <div className="lp-section-head">
              <h2>Built for how you actually manage money</h2>
              <p>Small details that make daily tracking feel effortless.</p>
            </div>
            <div className="lp-grid6">
              {TILES.map((t) => (
                <div key={t.title} className="lp-tile">
                  <div className="lp-tile-icon" style={{ background: t.bg }}>
                    <t.Icon size={22} style={{ color: t.fg }} />
                  </div>
                  <h3>{t.title}</h3>
                  <p>{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="lp-section">
          <div className="lp-wrap">
            <div className="lp-section-head">
              <h2>How it works</h2>
              <p>Three steps between you and financial clarity.</p>
            </div>
            <div className="lp-steps">
              <div className="lp-step">
                <div className="lp-step-num">1</div>
                <h3>Create your account</h3>
                <p>Sign in with Google in one tap — no forms, no passwords.</p>
              </div>
              <div className="lp-step">
                <div className="lp-step-num">2</div>
                <h3>Log your money</h3>
                <p>Add income, expenses, savings — or let Growwly AI do it for you.</p>
              </div>
              <div className="lp-step">
                <div className="lp-step-num">3</div>
                <h3>Get insights</h3>
                <p>See where your money goes, plan better, grow faster.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section style={{ padding: '0 0 96px' }}>
          <div className="lp-cta">
            <div className="lp-wrap">
              <h2>Start tracking your money today</h2>
              <p>Free forever. No credit card. Just clarity.</p>
              <button className="lp-btn lp-btn-white lp-btn-lg lp-cta-btn" onClick={goToLogin}>
                Create your free account
              </button>
              <div className="lp-cta-secure">
                <ShieldCheck size={14} />
                Secured by Google Authentication
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="lp-footer">
          <div className="lp-wrap lp-footer-inner">
            <div>
              <div className="lp-footer-logo">
                <GrowwlyLogo size="sm" />
                <span>Growwly</span>
              </div>
              <div className="lp-footer-tag">Your complete money OS</div>
            </div>
            <div className="lp-footer-made">
              Built with <Heart size={13} style={{ color: 'var(--lp-bad)' }} /> for personal finance
            </div>
          </div>
        </footer>

      </div>
    </>
  )
}
