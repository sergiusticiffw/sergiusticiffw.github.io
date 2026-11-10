import React, { useState } from 'react';
import { IconType } from 'react-icons';
import { cn } from '@shared/ui';
import { formatNumber } from '@shared/utils/utils';

interface AmountFieldProps {
  id: string;
  name: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  currency: string;
  icon: IconType;
  required?: boolean;
  placeholder?: string;
  size?: 'lg' | 'md';
}

export function AmountField({
  id,
  name,
  label,
  hint,
  value,
  onChange,
  currency,
  icon: Icon,
  required = false,
  placeholder = '0',
  size = 'md',
}: AmountFieldProps) {
  const [focused, setFocused] = useState(false);
  const numeric = Number(value);
  const showPreview = Number.isFinite(numeric) && numeric > 0;

  return (
    <div>
      <label
        htmlFor={id}
        className="m-0 mb-2 flex items-center gap-2 text-micro font-semibold uppercase tracking-widest text-app-muted"
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--color-app-accent)_18%,transparent)] text-[var(--color-app-accent)]">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        {label}
      </label>
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border transition-all duration-200',
          'bg-gradient-to-br from-white/[0.09] via-white/[0.04] to-[color-mix(in_srgb,var(--color-app-accent)_10%,transparent)]',
          focused
            ? 'border-[var(--color-app-accent)] shadow-[0_0_0_3px_var(--color-input-focus-ring),0_12px_32px_var(--color-app-accent-shadow)]'
            : 'border-white/12 shadow-[0_8px_24px_rgba(0,0,0,0.2)]'
        )}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
          aria-hidden
        />
        <div
          className={cn(
            'flex items-end gap-3 px-4 sm:px-5',
            size === 'lg' ? 'pb-3.5 pt-4 sm:pb-4 sm:pt-5' : 'pb-3 pt-3.5 sm:pb-3.5 sm:pt-4'
          )}
        >
          <input
            id={id}
            name={name}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            required={required}
            value={value}
            placeholder={placeholder}
            aria-label={label}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              'min-w-0 flex-1 border-0 bg-transparent p-0 outline-none',
              'font-extrabold tabular-nums tracking-tight text-app-primary',
              'placeholder:text-white/25',
              '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
            )}
            style={{
              fontSize:
                size === 'lg'
                  ? 'clamp(1.75rem, 7vw, 2.35rem)'
                  : 'clamp(1.35rem, 5.5vw, 1.85rem)',
            }}
          />
          <span className="mb-1 shrink-0 text-sm font-semibold uppercase tracking-wide text-app-muted">
            {currency}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-2.5 sm:px-5">
          <span className="text-caption text-app-muted">{hint}</span>
          {showPreview && (
            <span className="text-caption tabular-nums text-app-secondary">
              {formatNumber(numeric)} {currency}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
