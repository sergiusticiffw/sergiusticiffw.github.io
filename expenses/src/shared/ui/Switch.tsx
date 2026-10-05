import React from 'react';
import { cn } from './cn';

export interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, className, disabled, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-[var(--duration-fast)] motion-safe cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-input-focus-ring)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked
          ? 'bg-[var(--color-app-accent)] border-[var(--color-app-accent)]'
          : 'bg-white/10 border-white/15',
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform duration-[var(--duration-fast)] motion-safe',
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
        )}
      />
    </button>
  )
);
Switch.displayName = 'Switch';
