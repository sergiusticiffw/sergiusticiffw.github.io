'use client'

import React, { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] overflow-hidden">
      <div className="p-6">{children}</div>
    </div>
  )
}

function Field({
  label,
  type = 'text',
  value,
  onChange,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <div className="text-sm text-white/70 mb-1">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/40 outline-none focus:border-white/25"
      />
    </label>
  )
}

function ProviderButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm hover:bg-white/10 transition text-center"
    >
      Continue with {label}
    </a>
  )
}

export function LoginClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const redirectTo = useMemo(() => searchParams.get('redirectTo') ?? '/', [searchParams])
  const oauthState = encodeURIComponent(redirectTo)

  const oauthEnabled = {
    google: process.env.NEXT_PUBLIC_OAUTH_GOOGLE === '1',
    github: process.env.NEXT_PUBLIC_OAUTH_GITHUB === '1',
    microsoft: process.env.NEXT_PUBLIC_OAUTH_MICROSOFT === '1',
    facebook: process.env.NEXT_PUBLIC_OAUTH_FACEBOOK === '1',
    linkedin: process.env.NEXT_PUBLIC_OAUTH_LINKEDIN === '1',
  }
  const anyOauthEnabled =
    oauthEnabled.google ||
    oauthEnabled.github ||
    oauthEnabled.microsoft ||
    oauthEnabled.facebook ||
    oauthEnabled.linkedin

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(mode === 'login' ? '/auth/login' : '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'login'
            ? { email, password, redirectTo }
            : { ...(name ? { name } : {}), email, password, redirectTo },
        ),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error || 'Authentication failed')
      }

      router.replace(redirectTo)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <div className="text-xs uppercase tracking-widest text-white/60">Welcome</div>
      <h1 className="text-2xl font-bold mt-1">{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
      <div className="text-sm text-white/60 mt-2">
        {mode === 'login' ? 'Use your email/password or a social provider.' : 'Sign up with email/password or a social provider.'}
      </div>

      {anyOauthEnabled ? (
        <div className="mt-5 grid grid-cols-1 gap-2">
          {oauthEnabled.google ? (
            <ProviderButton href={`/api/users/oauth/google?state=${oauthState}`} label="Google" />
          ) : null}
          {oauthEnabled.github ? (
            <ProviderButton href={`/api/users/oauth/github?state=${oauthState}`} label="GitHub" />
          ) : null}
          {oauthEnabled.microsoft ? (
            <ProviderButton href={`/api/users/oauth/microsoft?state=${oauthState}`} label="Microsoft" />
          ) : null}
          {oauthEnabled.facebook ? (
            <ProviderButton href={`/api/users/oauth/facebook?state=${oauthState}`} label="Facebook" />
          ) : null}
          {oauthEnabled.linkedin ? (
            <ProviderButton href={`/api/users/oauth/linkedin?state=${oauthState}`} label="LinkedIn" />
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 flex items-center gap-3">
        <div className="h-px bg-white/10 flex-1" />
        <div className="text-xs text-white/50">or</div>
        <div className="h-px bg-white/10 flex-1" />
      </div>

      <form
        className="mt-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        {mode === 'register' ? <Field label="Name (optional)" value={name} onChange={setName} /> : null}
        <Field label="Email" type="email" value={email} onChange={setEmail} />
        <Field label="Password" type="password" value={password} onChange={setPassword} />

        {error ? <div className="mt-4 text-sm text-red-300">{error}</div> : null}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="flex-1 rounded-2xl bg-[var(--color-app-accent,#3b82f6)] px-4 py-2.5 text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
          <button
            type="button"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm hover:bg-white/10 transition"
            onClick={() => {
              setError(null)
              setMode((m) => (m === 'login' ? 'register' : 'login'))
            }}
          >
            {mode === 'login' ? 'Register' : 'Login'}
          </button>
        </div>
      </form>
    </Card>
  )
}
