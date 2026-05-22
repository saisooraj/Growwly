import { NextResponse } from 'next/server'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'application/json',
}

const TROY_OZ_TO_GRAM = 31.1035

async function fetchYahooMeta(symbol: string) {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1mo`
  const res = await fetch(url, { headers: HEADERS, next: { revalidate: 300 } })
  const json = await res.json()
  const result = json.chart?.result?.[0]
  const meta = result?.meta
  const timestamps = result?.timestamp ?? []
  const closes = result?.indicators?.quote?.[0]?.close ?? []
  return { meta, timestamps, closes }
}

export async function GET() {
  try {
    const [goldData, forexData] = await Promise.all([
      fetchYahooMeta('GC=F'),
      fetchYahooMeta('USDINR=X'),
    ])

    const goldUSD = goldData.meta?.regularMarketPrice ?? 0
    const usdInr  = forexData.meta?.regularMarketPrice ?? 84

    // Calculate prices
    const price24kPerGram = (goldUSD * usdInr) / TROY_OZ_TO_GRAM
    const price22kPerGram = price24kPerGram * (22 / 24)
    const sovereign = price22kPerGram * 8   // 1 sovereign = 8 grams
    const tenGram   = price22kPerGram * 10

    // Build 30-day history for 22K price per gram
    const history: { date: string; price22k: number }[] = []
    const goldCloses = goldData.closes
    const goldTimestamps = goldData.timestamps

    // forex close for the same period (may have different length, use latest rate as proxy)
    for (let i = 0; i < goldTimestamps.length; i++) {
      const close = goldCloses[i]
      if (close == null) continue
      const inrClose = (forexData.closes[i] ?? usdInr)
      const p22 = (close * inrClose) / TROY_OZ_TO_GRAM * (22 / 24)
      const date = new Date(goldTimestamps[i] * 1000).toISOString().split('T')[0]
      history.push({ date, price22k: parseFloat(p22.toFixed(0)) })
    }

    // Buy signal: compare current vs 30-day average
    const avg30 = history.length > 0
      ? history.reduce((s, h) => s + h.price22k, 0) / history.length
      : price22kPerGram

    const pctAboveAvg = ((price22kPerGram - avg30) / avg30) * 100
    let signal: 'buy' | 'hold' | 'wait'
    let signalText: string
    if (pctAboveAvg < -2) {
      signal = 'buy'
      signalText = `${Math.abs(pctAboveAvg).toFixed(1)}% below 30-day avg — Good time to buy`
    } else if (pctAboveAvg > 4) {
      signal = 'wait'
      signalText = `${pctAboveAvg.toFixed(1)}% above 30-day avg — Wait for correction`
    } else {
      signal = 'hold'
      signalText = 'Near 30-day average — Neutral'
    }

    return NextResponse.json({
      goldUSD: parseFloat(goldUSD.toFixed(2)),
      usdInr: parseFloat(usdInr.toFixed(2)),
      price24kPerGram: parseFloat(price24kPerGram.toFixed(0)),
      price22kPerGram: parseFloat(price22kPerGram.toFixed(0)),
      sovereign: parseFloat(sovereign.toFixed(0)),
      tenGram: parseFloat(tenGram.toFixed(0)),
      avg30Day: parseFloat(avg30.toFixed(0)),
      signal,
      signalText,
      history,
      updatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch gold price' }, { status: 500 })
  }
}
