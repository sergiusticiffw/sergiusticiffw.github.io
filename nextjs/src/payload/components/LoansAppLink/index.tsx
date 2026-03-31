'use client'

import React from 'react'

export default function LoansAppLink() {
  return (
    <div className="mx-3 mb-3 rounded-2xl border border-white/10 bg-black/30 p-3">
      <div className="text-[11px] uppercase tracking-widest text-white/60 mb-2">Frontend</div>
      <a
        href="/loans"
        className="inline-flex items-center justify-between gap-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85 hover:bg-white/10 transition"
      >
        <span>Open Loans</span>
        <span aria-hidden="true">→</span>
      </a>
    </div>
  )
}

