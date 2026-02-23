import React, { memo } from 'react';

const DOT_CLASS =
  'w-1.5 h-1.5 rounded-full animate-[loading-dots_1.4s_ease-in-out_infinite_both]';

interface LoaderProps {
  /** 'default' = accent color (e.g. standalone); 'on-button' = white (inside primary button) */
  variant?: 'default' | 'on-button';
  className?: string;
  'aria-label'?: string;
}

const Loader: React.FC<LoaderProps> = memo(
  ({ variant = 'default', className = '', 'aria-label': ariaLabel = 'Loading' }) => {
    const bgClass = variant === 'on-button' ? 'bg-white' : 'bg-[var(--color-app-accent)]';
    return (
      <div
        className={`inline-flex items-center justify-center gap-[5px] ${className}`}
        role="status"
        aria-label={ariaLabel}
      >
        <span className={`${DOT_CLASS} ${bgClass}`} style={{ animationDelay: '-0.32s' }} />
        <span className={`${DOT_CLASS} ${bgClass}`} style={{ animationDelay: '-0.16s' }} />
        <span className={`${DOT_CLASS} ${bgClass}`} />
      </div>
    );
  }
);

Loader.displayName = 'Loader';

export default Loader;
