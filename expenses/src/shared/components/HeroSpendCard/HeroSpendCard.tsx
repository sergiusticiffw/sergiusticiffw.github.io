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
      className="mb-5 flex flex-col gap-1"
    >
      <p className="text-micro text-app-muted m-0">{label}</p>
      <p
        className="tabular-nums text-app-primary m-0 font-bold tracking-tight leading-[1.1] break-words"
        style={{ fontSize: 'clamp(1.75rem, 8vw, 2.5rem)' }}
      >
        {amount}
      </p>
      {(deltaLabel || subtitle) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-caption">
          {deltaLabel && (
            <span
              className={cn(
                'inline-flex items-center gap-1 tabular-nums [&_svg]:w-3.5 [&_svg]:h-3.5',
                deltaPositive
                  ? 'text-[var(--color-income)]'
                  : 'text-[var(--color-expense)]'
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
            <span className="text-app-muted truncate">{subtitle}</span>
          )}
        </div>
      )}
    </Card>
  );
}
