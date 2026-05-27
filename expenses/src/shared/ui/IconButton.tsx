import React from 'react';
import { cn } from './cn';

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  'aria-label': string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'surface';
}

const sizeClasses = {
  sm: 'w-9 h-9 [&_svg]:w-4 [&_svg]:h-4',
  md: 'w-11 h-11 [&_svg]:w-[18px] [&_svg]:h-[18px]',
  lg: 'w-12 h-12 [&_svg]:w-5 [&_svg]:h-5',
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      'aria-label': ariaLabel,
      size = 'md',
      variant = 'ghost',
      className,
      children,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      type="button"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center justify-center rounded-xl transition-colors duration-[var(--duration-fast)] motion-safe shrink-0',
        '[&_svg]:shrink-0',
        'text-app-secondary hover:text-app-primary hover:bg-app-surface',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-input-focus-ring)]',
        variant === 'surface' && 'bg-app-surface border border-app-subtle',
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);
IconButton.displayName = 'IconButton';
