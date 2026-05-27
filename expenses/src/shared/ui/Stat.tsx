import React from 'react';
import { cn } from './cn';
import { Card } from './Card';

export interface StatProps {
  label: string;
  value: string | number;
  delta?: { value: string; positive?: boolean };
  icon?: React.ReactNode;
  className?: string;
  /** Visually denser variant (smaller paddings) */
  compact?: boolean;
}

export function Stat({
  label,
  value,
  delta,
  icon,
  className,
  compact = false,
}: StatProps) {
  return (
    <Card
      variant="surface"
      padding={compact ? 'sm' : 'md'}
      className={cn('flex flex-col gap-1 min-w-0', className)}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon && (
          <span
            className="inline-flex w-6 h-6 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--color-app-accent)_22%,transparent)] text-[var(--color-app-accent)] shrink-0 [&_svg]:w-3.5 [&_svg]:h-3.5"
            aria-hidden
          >
            {icon}
          </span>
        )}
        <span className="text-micro text-app-muted truncate">{label}</span>
      </div>
      <p
        className={cn(
          'tabular-nums text-app-primary m-0 leading-tight truncate',
          compact
            ? 'text-[1.125rem] font-semibold sm:text-xl'
            : 'text-2xl font-bold sm:text-[1.75rem]'
        )}
      >
        {value}
      </p>
      {delta && (
        <p
          className={cn(
            'text-caption tabular-nums m-0 truncate',
            delta.positive
              ? 'text-[var(--color-income)]'
              : 'text-[var(--color-expense)]'
          )}
        >
          {delta.value}
        </p>
      )}
    </Card>
  );
}

export function StatsRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-2 mb-5 sm:grid-cols-4',
        className
      )}
    >
      {children}
    </div>
  );
}
