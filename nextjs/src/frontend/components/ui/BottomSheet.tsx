'use client'

import React, { useEffect } from 'react'

export function BottomSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0">
        <div className="mx-auto max-w-5xl px-4 pb-4">
          <div className="rounded-[28px] border border-white/10 bg-black/70 backdrop-blur-xl shadow-[0_30px_80px_rgba(0,0,0,0.6)] overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-white/10 flex items-center justify-between gap-3">
              <div>
                <div className="h-1.5 w-10 rounded-full bg-white/20 mx-auto mb-3" />
                <div className="text-sm text-white/60 uppercase tracking-widest">{title}</div>
              </div>
              <button
                type="button"
                className="h-9 w-9 rounded-2xl border border-white/10 bg-white/5 text-white/80 hover:text-white hover:bg-white/10 transition"
                onClick={onClose}
              >
                ✕
              </button>
            </div>
            <div className="px-5 py-4 max-h-[70vh] overflow-auto">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

