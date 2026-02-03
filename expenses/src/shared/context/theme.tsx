/**
 * Theme context only; value from settingsStore (single source of truth).
 */
import React, { createContext, useContext } from 'react';
import { useStore } from '@tanstack/react-store';
import { settingsStore } from '@stores/settingsStore';

const ThemeContext = createContext<string>('blue-pink-gradient');

export function useTheme(): string {
  return useContext(ThemeContext) ?? 'blue-pink-gradient';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const theme = useStore(settingsStore, (s) => s.theme);
  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
};
