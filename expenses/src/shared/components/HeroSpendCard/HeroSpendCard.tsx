import React from 'react';
import { Card } from '@shared/ui';
import { FiTrendingDown, FiTrendingUp } from 'react-icons/fi';
import { cn } from '@shared/ui';

export interface HeroSpendCardProps {
  label: string;
  amount: string;
  deltaLabel?: string;
  deltaPositive?: boolean;
  subtitle?: string;
}

export function HeroSpendCard({
  label,
  amount,
  deltaLabel,
  deltaPositive,
  subtitle,
}: HeroSpendCardProps) {
  return (
    <Card
      variant="elevated"
      padding="lg"
      className="mb-5 flex flex-col gap-1 border-[var(--color-border-accent)] shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
    >
      <p className="text-micro text-app-muted m-0">{label}</p>
      <p
        className="tabular-nums text-app-primary m-0 font-extrabold tracking-tight leading-[1.05] break-words drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]"
        style={{ fontSize: 'clamp(1.75rem, 8vw, 2.5rem)' }}
      >
        {amount}
      </p>
      {(deltaLabel || subtitle) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-2 text-caption">
          {deltaLabel && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 tabular-nums px-2.5 py-1 rounded-full border text-[0.9rem] font-semibold [&_svg]:w-4 [&_svg]:h-4 shadow-[0_6px_18px_rgba(0,0,0,0.25)]',
                deltaPositive
                  ? 'text-[var(--color-income)] border-[color-mix(in_srgb,var(--color-income)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-income)_16%,transparent)]'
                  : 'text-[var(--color-expense)] border-[color-mix(in_srgb,var(--color-expense)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-expense)_16%,transparent)]'
              )}
            >
              {deltaPositive ? (
                <FiTrendingUp aria-hidden />
              ) : (
                <FiTrendingDown aria-hidden />
              )}
              {deltaLabel}
            </span>
          )}
          {subtitle && (
            <span className="text-app-secondary/90 truncate">{subtitle}</span>
          )}
        </div>
      )}
    </Card>
  );
}
