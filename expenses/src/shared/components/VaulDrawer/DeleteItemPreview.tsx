import React from 'react';
import { useLocalization } from '@shared/context/localization';
import {
  formatNumber,
  getLocale,
  getSuggestionTranslationKey,
} from '@shared/utils/utils';
import { getSuggestions, incomeSuggestions } from '@shared/utils/constants';
import { normalizeTag } from '@shared/hooks/useTags';
import TagDisplay from '@shared/components/Common/TagDisplay';
import { CategoryIcon, cn } from '@shared/ui';

export interface DeleteItemPreviewProps {
  variant?: 'expense' | 'income' | 'payment' | 'loan';
  dt: string;
  dsc?: string;
  sum: number | string;
  cat?: string;
  badge?: React.ReactNode;
}

const DeleteItemPreview: React.FC<DeleteItemPreviewProps> = ({
  variant = 'expense',
  dt,
  dsc = '',
  sum,
  cat,
  badge,
}) => {
  const { language, t } = useLocalization();
  const isPlain = variant === 'payment' || variant === 'loan';

  const date = new Date(dt);
  const hasValidDate = !Number.isNaN(date.getTime());
  const locale = getLocale(language);
  const day = hasValidDate ? date.getDate() : '';
  const month = hasValidDate
    ? date.toLocaleDateString(locale, { month: 'short' }).toUpperCase()
    : '';
  const year = hasValidDate ? date.getFullYear() : '';

  const showIcon = variant === 'expense';

  const suggestions =
    variant === 'income'
      ? incomeSuggestions
      : (() => {
          const all = getSuggestions();
          return all[cat as keyof typeof all] || [];
        })();

  const getTagLabel = (suggestion: string) => {
    if (variant === 'income') {
      const key = `income.tags.${suggestion}`;
      const translated = t(key);
      return translated !== key ? translated : suggestion;
    }
    const key = getSuggestionTranslationKey(suggestion, cat ?? '');
    const translated = t(key);
    return translated !== key ? translated : suggestion;
  };

  const amountPrefix =
    variant === 'expense' ? '−' : variant === 'income' ? '+' : null;

  return (
    <div className="mx-1 mb-4 flex items-center gap-3 rounded-2xl border border-white/8 bg-app-surface p-3 sm:p-4">
      {hasValidDate && (
        <div className="flex flex-col items-center justify-center min-w-[44px] shrink-0 leading-none">
          <div className="text-[1.35rem] font-bold tabular-nums text-app-primary">
            {day}
          </div>
          <div className="text-micro text-app-muted mt-1">{month}</div>
          <div className="text-micro text-app-muted">{year}</div>
        </div>
      )}

      {showIcon && <CategoryIcon categoryId={cat} size="md" />}

      <div className="flex-1 min-w-0">
        <div className="text-[0.9375rem] text-app-primary leading-snug break-words">
          {isPlain ? (
            <span className="inline-flex items-center gap-2 flex-wrap">
              <span>{dsc}</span>
              {badge}
            </span>
          ) : (
            <TagDisplay
              description={dsc}
              suggestions={suggestions}
              normalizeTag={variant === 'income' ? undefined : normalizeTag}
              getTagLabel={getTagLabel}
            />
          )}
        </div>
      </div>

      <div
        className={cn(
          'shrink-0 whitespace-nowrap font-bold tabular-nums text-base flex items-center gap-1',
          variant === 'income'
            ? 'text-[var(--color-income)]'
            : 'text-app-primary'
        )}
      >
        {amountPrefix != null && <span aria-hidden>{amountPrefix}</span>}
        {formatNumber(sum)}
      </div>
    </div>
  );
};

export default DeleteItemPreview;
