'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

const SCRIPT = 'https://telegram.org/js/telegram-web-app.js'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function todayParts() {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }
}

function toIso(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function isoToDDMMYYYY(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  return `${m[3]}.${m[2]}.${m[1]}`
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function startDayOfWeek(year: number, month: number) {
  const d = new Date(year, month, 1).getDay()
  return (d + 6) % 7
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

function Calendar({
  selectedIso,
  onSelect,
}: {
  selectedIso: string
  onSelect: (iso: string) => void
}) {
  const today = todayParts()
  const todayIso = toIso(today.year, today.month, today.day)

  const selParts = useMemo(() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(selectedIso)
    if (!m) return today
    return { year: +m[1], month: +m[2] - 1, day: +m[3] }
  }, [selectedIso])

  const [viewYear, setViewYear] = useState(selParts.year)
  const [viewMonth, setViewMonth] = useState(selParts.month)

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const offset = startDayOfWeek(viewYear, viewMonth)

  const prev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const next = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="w-full max-w-[340px]">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prev}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-white/70 hover:bg-white/10 active:bg-white/15 transition-colors text-lg"
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="text-[0.95rem] font-semibold text-white">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={next}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-white/70 hover:bg-white/10 active:bg-white/15 transition-colors text-lg"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map(l => (
          <div key={l} className="text-center text-[0.7rem] font-medium text-white/40 py-1">
            {l}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />
          const iso = toIso(viewYear, viewMonth, day)
          const isSelected = iso === selectedIso
          const isToday = iso === todayIso
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
              className={[
                'mx-auto w-9 h-9 flex items-center justify-center rounded-full text-sm transition-colors',
                isSelected
                  ? 'bg-[#2aabee] text-white font-semibold'
                  : isToday
                    ? 'ring-1 ring-[#2aabee] text-[#2aabee] font-semibold hover:bg-white/10'
                    : 'text-white/80 hover:bg-white/10 active:bg-white/15',
              ].join(' ')}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function DatePickerPage() {
  const t = todayParts()
  const [iso, setIso] = useState(() => toIso(t.year, t.month, t.day))
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
    s.onerror = () => {
      setReady(true)
    }
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
        setTimeout(() => {
          window.Telegram?.WebApp?.close()
        }, 1200)
      } else {
        setError(data?.error || 'Failed to send. Try /date ' + ddmmyyyy)
      }
    } catch (err) {
      setError('Network error. Check your connection.')
    } finally {
      setSending(false)
    }
  }, [ddmmyyyy, urlParams])

  return (
    <div className="min-h-screen box-border p-5 bg-[#0a0a0a] text-[#ededed] font-[system-ui,sans-serif]">
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

      <Calendar selectedIso={iso} onSelect={setIso} />

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
