import React from 'react';
import { Card } from '@shared/ui';
import { FiTrendingDown, FiTrendingUp } from 'react-icons/fi';
import { cn } from '@shared/ui';

export interface HeroSpendCardProps {
  /** Month / period title shown in the card header */
  title: string;
  /** Secondary badge text (e.g. "72 transactions") */
  meta?: string;
  label: string;
  amount: string;
  deltaLabel?: string;
  deltaPositive?: boolean;
  /** Footer line — days remaining, without repeating the month title */
  footer?: string;
}

export function HeroSpendCard({
  title,
  meta,
  label,
  amount,
  deltaLabel,
  deltaPositive,
  footer,
}: HeroSpendCardProps) {
  return (
    <Card
      variant="surface"
      padding="lg"
      className="mb-5 flex flex-col gap-3 border-[var(--color-border-subtle)] shadow-[0_8px_28px_rgba(0,0,0,0.24)]"
    >
      {/* Top: period + transaction count */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-2xl font-extrabold tracking-tight text-app-primary leading-tight">
          {title}
        </h2>
        {meta && (
          <span className="shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal bg-[var(--color-surface-2)]/60 text-app-muted/80 tabular-nums">
            {meta}
          </span>
        )}
      </div>

      {/* Middle: primary spend stat */}
      <div className="flex flex-col gap-1">
        <p className="text-micro text-app-muted m-0 uppercase tracking-widest">
          {label}
        </p>
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          <p
            className="tabular-nums text-app-primary m-0 font-extrabold tracking-tight leading-[1.05] break-words drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]"
            style={{ fontSize: 'clamp(1.75rem, 8vw, 2.5rem)' }}
          >
            {amount}
          </p>
          {deltaLabel && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 tabular-nums px-2.5 py-1 rounded-full border text-[0.9rem] font-semibold [&_svg]:w-4 [&_svg]:h-4 shadow-[0_6px_18px_rgba(0,0,0,0.25)] mb-0.5',
                deltaPositive
                  ? 'text-[var(--color-income)] border-[color-mix(in_srgb,var(--color-income)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-income)_16%,transparent)]'
                  : 'text-[var(--color-expense)] border-[color-mix(in_srgb,var(--color-expense)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-expense)_16%,transparent)]'
              )}
            >
              {/* Spending down (positive/good) → arrow down; spending up (bad) → arrow up */}
              {deltaPositive ? (
                <FiTrendingDown aria-hidden />
              ) : (
                <FiTrendingUp aria-hidden />
              )}
              {deltaLabel}
            </span>
          )}
        </div>
      </div>

      {/* Bottom: days left only — no repeated month */}
      {footer && (
        <p className="m-0 flex items-center gap-2 text-caption text-app-secondary/90">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-app-accent)] shrink-0"
            aria-hidden
          />
          {footer}
        </p>
      )}
    </Card>
  );
}
