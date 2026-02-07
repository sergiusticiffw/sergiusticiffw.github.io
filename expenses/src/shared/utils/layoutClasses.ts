/**
 * Tailwind class strings for layout – folosim doar clase Tailwind, fără CSS custom.
 * Actualizat din .page-container din index.css.
 */
/** Clase Tailwind pentru containerul de pagină (înlocuie .page-container) */
export const PAGE_CONTAINER_CLASS =
  'h-full w-full max-w-full overflow-x-hidden overflow-y-auto relative box-border ' +
  'bg-[var(--color-app-bg)] pt-0 px-4 pb-[calc(80px+env(safe-area-inset-bottom,0))] ' +
  'md:px-6 [&_*]:box-border overflow-touch';
