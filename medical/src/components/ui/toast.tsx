"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastKind = "success" | "error" | "info";

type ToastItem = { id: number; kind: ToastKind; message: string };

type ToastApi = {
  show: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const DISMISS_MS = 4500;
const MAX_VISIBLE = 3;

const KIND_STYLES: Record<ToastKind, string> = {
  success: "border-success/40 bg-success-soft text-foreground",
  error: "border-destructive/40 bg-card text-foreground",
  info: "border-info/40 bg-info-soft text-foreground",
};

const KIND_LABELS: Record<ToastKind, string> = {
  success: "Salvat",
  error: "Eroare",
  info: "Info",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = nextId.current++;
      setToasts((current) =>
        [...current, { id, kind, message }].slice(-MAX_VISIBLE),
      );
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), kind === "error" ? DISMISS_MS * 2 : DISMISS_MS),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) {
        clearTimeout(timer);
      }
      pending.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message) => show(message, "success"),
      error: (message) => show(message, "error"),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex w-[min(100%-1.5rem,28rem)] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-base shadow-md animate-in fade-in-0 slide-in-from-bottom-2 ${KIND_STYLES[toast.kind]}`}
          >
            <p className="min-w-0 flex-1">
              <span className="sr-only">{KIND_LABELS[toast.kind]}: </span>
              {toast.message}
            </p>
            <button
              type="button"
              className="-m-2 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              aria-label="Închide mesajul"
              onClick={() => dismiss(toast.id)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="size-4"
                aria-hidden
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    // Outside the provider (tests, stories) fall back to a no-op.
    return { show: () => undefined, success: () => undefined, error: () => undefined };
  }
  return context;
}
