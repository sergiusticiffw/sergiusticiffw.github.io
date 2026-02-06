/**
 * Theme context and DOM sync: value from settingsStore (single source of truth).
 * Applies data-theme on <html> so CSS variables take effect.
 */
import React, { createContext, useContext, useEffect } from 'react';
import { useStore } from '@tanstack/react-store';
import { settingsStore } from '@stores/settingsStore';
import { DEFAULT_THEME_ID } from '@shared/constants/themes';

const ThemeContext = createContext<string>(DEFAULT_THEME_ID);

export function useTheme(): string {
  return useContext(ThemeContext) ?? DEFAULT_THEME_ID;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const theme = useStore(settingsStore, (s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
};
