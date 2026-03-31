'use client'

import React, { createContext, useCallback, use, useEffect, useState } from 'react'

import type { Theme, ThemeContextType } from './types'

import canUseDOM from '@/utilities/canUseDOM'
import { defaultTheme, getImplicitPreference, themeLocalStorageKey } from './shared'
import { themeIsValid } from './types'

const initialContext: ThemeContextType = {
  setTheme: () => null,
  theme: undefined,
}

const ThemeContext = createContext(initialContext)

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<Theme | undefined>(
    canUseDOM ? (document.documentElement.getAttribute('data-theme') as Theme) : undefined,
  )

  const setTheme = useCallback((themeToSet: Theme | null) => {
    // Theme switching disabled: always dark
    void themeToSet
    setThemeState('dark')
    if (canUseDOM) {
      window.localStorage.removeItem(themeLocalStorageKey)
      document.documentElement.setAttribute('data-theme', 'dark')
    }
  }, [])

  useEffect(() => {
    // Theme switching disabled: always dark
    window.localStorage.removeItem(themeLocalStorageKey)
    document.documentElement.setAttribute('data-theme', defaultTheme)
    setThemeState(defaultTheme)
  }, [])

  return <ThemeContext value={{ setTheme, theme }}>{children}</ThemeContext>
}

export const useTheme = (): ThemeContextType => use(ThemeContext)
