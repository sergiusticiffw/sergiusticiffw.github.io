/**
 * Tailwind class strings for layout and shared UI – fără CSS custom.
 */
/** Clase Tailwind pentru containerul de pagină (înlocuie .page-container) */
export const PAGE_CONTAINER_CLASS =
  'h-full w-full max-w-full overflow-x-hidden overflow-y-auto relative box-border ' +
  'bg-[var(--color-app-bg)] pt-0 px-4 pb-[calc(80px+env(safe-area-inset-bottom,0))] ' +
  'md:px-6 [&_*]:box-border overflow-touch';

/** Buton primar submit (înlocuie .btn-submit) – folosit în formulare și drawer footer */
export const BTN_SUBMIT_CLASS =
  'inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-0 px-4 py-3 text-base font-semibold ' +
  'text-[var(--color-btn-on-accent)] bg-gradient-to-br from-[var(--color-app-accent)] to-[var(--color-app-accent-hover)] ' +
  'shadow-[0_2px_8px_var(--color-app-accent-shadow),0_0_20px_var(--color-app-glow)] ' +
  '[&_svg]:size-5 [&_svg]:shrink-0 ' +
  'hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed';

/** Floating Action Button (înlocuie .fab) – Charts, Income, Loans, Loan detail, NewHome */
export const FAB_CLASS =
  'fixed z-[1000] flex cursor-pointer select-none items-center justify-center border-0 rounded-full ' +
  'bg-gradient-to-br from-[var(--color-app-accent)] to-[var(--color-app-accent-hover)] text-[var(--color-btn-on-accent)] ' +
  'shadow-[0_4px_16px_var(--color-app-accent-shadow),0_0_32px_var(--color-app-glow)] ' +
  'transition-all duration-300 touch-manipulation [-webkit-tap-highlight-color:transparent] ' +
  'bottom-[calc(100px+env(safe-area-inset-bottom))] right-5 w-14 h-14 ' +
  'hover:-translate-y-0.5 hover:scale-105 hover:shadow-[0_6px_24px_var(--color-app-accent-shadow),0_0_40px_var(--color-app-glow)] ' +
  'active:translate-y-0 active:scale-[0.98] active:shadow-[0_2px_8px_var(--color-app-accent-shadow)] ' +
  '[&_svg]:w-6 [&_svg]:h-6 [&_svg]:pointer-events-none ' +
  'md:bottom-[90px] md:right-4 md:w-[52px] md:h-[52px] md:[&_svg]:w-[22px] md:[&_svg]:h-[22px] ' +
  'max-[480px]:bottom-[calc(80px+env(safe-area-inset-bottom))] max-[480px]:right-3 max-[480px]:w-12 max-[480px]:h-12 max-[480px]:[&_svg]:w-5 max-[480px]:[&_svg]:h-5';
