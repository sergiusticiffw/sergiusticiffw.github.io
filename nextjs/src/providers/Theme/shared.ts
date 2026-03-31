import type { Theme } from './types'

export const themeLocalStorageKey = 'payload-theme'

export const defaultTheme = 'dark'

export const getImplicitPreference = (): Theme | null => {
  return 'dark'
}
