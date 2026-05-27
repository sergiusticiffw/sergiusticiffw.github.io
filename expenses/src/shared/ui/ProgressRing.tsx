import React from 'react';
import { cn } from './cn';

export interface ProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
}

export function ProgressRing({
  value,
  max = 100,
  size = 56,
  strokeWidth = 4,
  className,
  label,
}: ProgressRingProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-app-accent)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-[var(--duration-slow)] motion-safe"
        />
      </svg>
      <span className="absolute text-caption font-semibold tabular-nums text-app-primary">
        {Math.round(pct)}%
      </span>
    </div>
  );
}
