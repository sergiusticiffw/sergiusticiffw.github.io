/** Minimal typings for https://telegram.org/js/telegram-web-app.js */
interface TelegramHapticFeedback {
  impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
  notificationOccurred: (type: 'error' | 'success' | 'warning') => void
  selectionChanged: () => void
}

interface TelegramWebApp {
  ready: () => void
  expand: () => void
  close: () => void
  sendData: (data: string) => void
  HapticFeedback?: TelegramHapticFeedback
  version: string
  initData: string
  colorScheme: 'light' | 'dark'
  themeParams: Record<string, unknown>
}

interface Window {
  Telegram?: { WebApp: TelegramWebApp }
}
