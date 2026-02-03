import React from 'react';
import { useLocalization } from '@shared/context/localization';
import './TagChips.scss';

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

  return (
    <div className="form-group">
      <label>{translationKey ? t(translationKey) : 'Tags'}</label>
      <div className="tags-container">
        {suggestions.map((suggestion) => {
          const normalizedTag = normalizeTag
            ? normalizeTag(suggestion)
            : suggestion;
          const isSelected = isTagSelected(normalizedTag);
          const label = getTagLabel
            ? getTagLabel(suggestion)
            : translationKey
              ? t(`${translationKey}.${suggestion}`)
              : suggestion;

          return (
            <button
              key={suggestion}
              type="button"
              onClick={() => onTagClick(normalizedTag)}
              className={`tag-chip ${isSelected ? 'selected' : ''}`}
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
