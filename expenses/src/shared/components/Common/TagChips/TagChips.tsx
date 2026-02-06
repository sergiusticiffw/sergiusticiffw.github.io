import React from 'react';
import { useLocalization } from '@shared/context/localization';

interface TagChipsProps {
  suggestions: string[];
  selectedTags: string[];
  onTagClick: (tag: string) => void;
  isTagSelected: (tag: string) => boolean;
  getTagLabel?: (tag: string) => string;
  normalizeTag?: (tag: string) => string;
  translationKey?: string;
}

/**
 * Reusable component for displaying tag chips in forms
 */
const TagChips: React.FC<TagChipsProps> = ({
  suggestions,
  selectedTags,
  onTagClick,
  isTagSelected,
  getTagLabel,
  normalizeTag,
  translationKey,
}) => {
  const { t } = useLocalization();

  if (suggestions.length === 0) {
    return null;
  }

  const baseChip =
    'rounded-2xl py-2 px-4 text-white/70 text-sm font-medium cursor-pointer transition-all duration-200 whitespace-nowrap relative overflow-hidden select-none border';
  const unselectedChip =
    'bg-white/[0.05] border-white/10 hover:bg-white/10 hover:border-white/20 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0';
  const selectedChip =
    'bg-gradient-to-br from-[var(--color-app-accent)] to-[var(--color-app-accent-hover)] border-[var(--color-app-accent)] text-white shadow-[0_2px_8px_var(--color-app-accent-shadow)] hover:opacity-90 hover:shadow-[0_4px_12px_var(--color-app-accent-shadow)] hover:-translate-y-0.5';

  return (
    <div className="form-group">
      <label>{translationKey ? t(translationKey) : 'Tags'}</label>
      <div className="flex flex-wrap gap-2 mt-2 overflow-x-hidden w-full max-w-full sm:gap-2">
        {suggestions.map((suggestion) => {
          const normalizedTag = normalizeTag ? normalizeTag(suggestion) : suggestion;
          const isSelected = isTagSelected(normalizedTag);
          const label = getTagLabel 
            ? getTagLabel(suggestion) 
            : (translationKey ? t(`${translationKey}.${suggestion}`) : suggestion);
          
          return (
            <button
              key={suggestion}
              type="button"
              onClick={() => onTagClick(normalizedTag)}
              className={`${baseChip} ${isSelected ? selectedChip : unselectedChip}`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TagChips;
