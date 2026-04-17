'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

const SCRIPT = 'https://telegram.org/js/telegram-web-app.js'

function todayIso(): string {
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

function getUrlParams(): { chatId: number; token: string } | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const c = params.get('c')
  const t = params.get('t')
  if (!c || !t) return null
  const chatId = Number(c)
  if (!Number.isFinite(chatId)) return null
  return { chatId, token: t }
}

export default function DatePickerPage() {
  const [iso, setIso] = useState(todayIso)
  const [ready, setReady] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [urlParams, setUrlParams] = useState<{ chatId: number; token: string } | null>(null)

  useEffect(() => {
    setUrlParams(getUrlParams())

    const finish = () => {
      window.Telegram?.WebApp?.ready()
      window.Telegram?.WebApp?.expand()
      setReady(true)
    }

    const existing = document.querySelector(`script[src="${SCRIPT}"]`)
    if (existing && window.Telegram?.WebApp) {
      finish()
      return
    }
    const s = document.createElement('script')
    s.src = SCRIPT
    s.async = true
    s.onload = finish
    s.onerror = () => setReady(true)
    document.body.appendChild(s)
  }, [])

  const ddmmyyyy = useMemo(() => isoToDDMMYYYY(iso), [iso])
  const canSend = ready && !!ddmmyyyy && !!urlParams && !sending && !sent

  const onSend = useCallback(async () => {
    setError(null)
    if (!ddmmyyyy || !urlParams) return

    setSending(true)
    try {
      const res = await fetch('/api/bot/date-pick', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          date: ddmmyyyy,
          chatId: urlParams.chatId,
          token: urlParams.token,
        }),
      })
      const data = await res.json().catch(() => null)

      if (res.ok && data?.ok) {
        setSent(true)
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success')
        setTimeout(() => window.Telegram?.WebApp?.close(), 1200)
      } else {
        setError(data?.error || 'Failed to send. Try /date ' + ddmmyyyy)
      }
    } catch {
      setError('Network error. Check your connection.')
    } finally {
      setSending(false)
    }
  }, [ddmmyyyy, urlParams])

  return (
    <div className="min-h-screen p-5 bg-[#0a0a0a] text-[#ededed] font-[system-ui,sans-serif]">
      <h1 className="text-xl mb-2">Pick a date</h1>
      <p className="text-sm opacity-85 mb-4">
        BNM (USD) rate for the selected day.
      </p>

      {ready && !urlParams ? (
        <p className="mb-4 px-3.5 py-3 rounded-xl text-sm leading-[1.45] bg-yellow-400/[0.12] border border-yellow-400/[0.35]">
          To send a date to the bot, tap <strong>📅 Pick a date</strong> from the chat keyboard,
          or send <strong>/date</strong> and tap the button below the message.
        </p>
      ) : null}

      <label className="block mb-1.5 text-sm" htmlFor="d">Date</label>
      <input
        id="d"
        type="date"
        value={iso}
        onChange={(e) => setIso(e.target.value)}
        disabled={!ready}
        className="w-full max-w-[300px] px-3.5 py-3 rounded-xl border border-white/20 bg-white/[0.06] text-inherit text-base"
      />

      {ddmmyyyy ? (
        <p className="mt-3 text-sm opacity-90">
          Selected: <strong>{ddmmyyyy}</strong>
        </p>
      ) : null}

      {sent ? (
        <p className="mt-5 text-[#34d399] font-semibold text-base">
          ✅ Sent! Check the chat for results.
        </p>
      ) : (
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className="mt-5 px-6 py-3.5 rounded-[14px] border-none bg-[#2aabee] text-white font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {sending ? 'Sending…' : 'Send to bot'}
        </button>
      )}

      {error ? (
        <p className="mt-3.5 text-[#f87171] text-sm">{error}</p>
      ) : null}
      {!ready ? (
        <p className="mt-3.5 text-[0.85rem] opacity-70">Loading…</p>
      ) : null}
    </div>
  )
}
