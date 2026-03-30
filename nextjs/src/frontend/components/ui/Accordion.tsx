'use client'

import React from 'react'

export function AccordionSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <button
        type="button"
        className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-white/[0.03] transition"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div>
          <div className="text-xs uppercase tracking-widest text-white/60">Section</div>
          <div className="text-base font-semibold mt-1">{title}</div>
        </div>
        <div className="h-9 w-9 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center text-white/70">
          {open ? '–' : '+'}
        </div>
      </button>
      {open ? <div className="px-5 pb-5">{children}</div> : null}
    </div>
  )
}

