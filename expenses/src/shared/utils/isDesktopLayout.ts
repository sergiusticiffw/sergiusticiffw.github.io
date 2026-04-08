export function isDesktopLayout(minWidthPx = 768): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(`(min-width: ${minWidthPx}px)`).matches;
}

