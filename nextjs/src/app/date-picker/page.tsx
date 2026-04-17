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

function isTelegramContext(): boolean {
  return Boolean(window.Telegram?.WebApp)
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

/** 0 = Mon … 6 = Sun (ISO weekday) */
function startDayOfWeek(year: number, month: number) {
  const d = new Date(year, month, 1).getDay()
  return (d + 6) % 7
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
      {/* header */}
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

      {/* weekday labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map(l => (
          <div key={l} className="text-center text-[0.7rem] font-medium text-white/40 py-1">
            {l}
          </div>
        ))}
      </div>

      {/* day grid */}
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
  const [error, setError] = useState<string | null>(null)
  const [inTelegram, setInTelegram] = useState(false)

  useEffect(() => {
    const finish = () => {
      window.Telegram?.WebApp?.ready()
      window.Telegram?.WebApp?.expand()
      setInTelegram(isTelegramContext())
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
      setError('Open this page from Telegram to send the date.')
      return
    }
    try {
      tg.HapticFeedback?.notificationOccurred('success')
      tg.sendData(ddmmyyyy)
      tg.close()
    } catch (err) {
      setError(`Failed to send: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [ddmmyyyy])

  return (
    <div className="min-h-screen box-border p-5 bg-[#0a0a0a] text-[#ededed] font-[system-ui,sans-serif]">
      <h1 className="text-xl mb-2">Pick a date</h1>
      <p className="text-sm opacity-85 mb-4">
        BNM (USD) rate for the selected day; send it to the bot via the button below.
      </p>

      {ready && !inTelegram ? (
        <p className="mb-4 px-3.5 py-3 rounded-xl text-sm leading-[1.45] bg-yellow-400/[0.12] border border-yellow-400/[0.35]">
          Open this page from Telegram to send the date to the bot.
        </p>
      ) : null}

      <Calendar selectedIso={iso} onSelect={setIso} />

      {ddmmyyyy ? (
        <p className="mt-3 text-sm opacity-90">
          Selected: <strong>{ddmmyyyy}</strong>
        </p>
      ) : null}

      <button
        type="button"
        onClick={onSend}
        disabled={!ready || !ddmmyyyy}
        className="mt-5 px-6 py-3.5 rounded-[14px] border-none bg-[#2aabee] text-white font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        Send to bot
      </button>

      {error ? (
        <p className="mt-3.5 text-[#f87171] text-sm">{error}</p>
      ) : null}
      {!ready && !error ? (
        <p className="mt-3.5 text-[0.85rem] opacity-70">Loading…</p>
      ) : null}
    </div>
  )
}
