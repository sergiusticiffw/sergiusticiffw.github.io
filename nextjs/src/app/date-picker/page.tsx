'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

const SCRIPT = 'https://telegram.org/js/telegram-web-app.js'

function todayIsoLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isoToDDMMYYYY(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  return `${m[3]}.${m[2]}.${m[1]}`
}

export default function DatePickerPage() {
  const [iso, setIso] = useState(todayIsoLocal)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const existing = document.querySelector(`script[src="${SCRIPT}"]`)
    if (existing && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready()
      setReady(true)
      return
    }
    const s = document.createElement('script')
    s.src = SCRIPT
    s.async = true
    s.onload = () => {
      window.Telegram?.WebApp?.ready()
      window.Telegram?.WebApp?.expand()
      setReady(true)
    }
    s.onerror = () => setError('Could not load Telegram Web App.')
    document.body.appendChild(s)
  }, [])

  const ddmmyyyy = useMemo(() => isoToDDMMYYYY(iso), [iso])

  const onSend = useCallback(() => {
    setError(null)
    if (!ddmmyyyy) {
      setError('Invalid date.')
      return
    }
    const tg = window.Telegram?.WebApp
    if (!tg) {
      setError('Open this page from Telegram (Web App) to send the date.')
      return
    }
    tg.HapticFeedback?.notificationOccurred('success')
    tg.sendData(ddmmyyyy)
    tg.close()
  }, [ddmmyyyy])

  return (
    <div
      style={{
        minHeight: '100vh',
        boxSizing: 'border-box',
        padding: '20px',
        background: '#0a0a0a',
        color: '#ededed',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Pick a date</h1>
      <p style={{ fontSize: '0.9rem', opacity: 0.85, marginBottom: '16px' }}>
        BNM (USD) rate for the selected day; send it to the bot via the button below.
      </p>
      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem' }} htmlFor="d">
        Date
      </label>
      <input
        id="d"
        type="date"
        value={iso}
        onChange={(e) => setIso(e.target.value)}
        disabled={!ready}
        style={{
          width: '100%',
          maxWidth: '300px',
          padding: '12px 14px',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(255,255,255,0.06)',
          color: 'inherit',
          fontSize: '1rem',
        }}
      />
      {ddmmyyyy ? (
        <p style={{ marginTop: '12px', fontSize: '0.9rem', opacity: 0.9 }}>Format: {ddmmyyyy}</p>
      ) : null}
      <button
        type="button"
        onClick={onSend}
        disabled={!ready || !ddmmyyyy}
        style={{
          marginTop: '20px',
          padding: '14px 22px',
          borderRadius: '14px',
          border: 'none',
          background: '#2aabee',
          color: '#fff',
          fontWeight: 600,
          fontSize: '1rem',
          cursor: ready && ddmmyyyy ? 'pointer' : 'not-allowed',
          opacity: ready && ddmmyyyy ? 1 : 0.5,
        }}
      >
        Send to bot
      </button>
      {error ? (
        <p style={{ marginTop: '14px', color: '#f87171', fontSize: '0.9rem' }}>{error}</p>
      ) : null}
      {!ready && !error ? (
        <p style={{ marginTop: '14px', fontSize: '0.85rem', opacity: 0.7 }}>Loading…</p>
      ) : null}
    </div>
  )
}
