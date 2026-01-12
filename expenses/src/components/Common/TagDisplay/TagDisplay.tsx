import React from 'react';
import { useLocalization } from '@context/localization';
import { extractHashtags } from '@utils/utils';
import { normalizeTag } from '@hooks/useTags';
import './TagDisplay.scss';

interface TagDisplayProps {
  description: string;
  suggestions: string[];
  normalizeTag?: (tag: string) => string;
  getTagLabel?: (tag: string) => string;
  translationKey?: string;
  className?: string;
}

/**
 * Reusable component for displaying tags inline with description in tables
 */
const TagDisplay: React.FC<TagDisplayProps> = ({
  description,
  suggestions,
  normalizeTag: customNormalizeTag,
  getTagLabel,
  translationKey,
  className = '',
}) => {
  const { t } = useLocalization();
  const normalize = customNormalizeTag || normalizeTag;

  if (!description) {
    return null;
  }

  // Extract description without tags
  let cleanDescription = description;
  const foundTags: string[] = [];
  
  // Get normalized suggestions for matching
  const normalizedSuggestions = suggestions.map(s => ({
    original: s,
    normalized: normalize(s),
  }));

  // Extract tags from description
  normalizedSuggestions.forEach(({ original, normalized }) => {
    const tagPattern = new RegExp(`#${normalized}\\b`, 'gi');
    if (tagPattern.test(description)) {
      foundTags.push(normalized);
      // Remove tag from description
      cleanDescription = cleanDescription.replace(tagPattern, '').trim();
    }
  });

  // Remove multiple spaces
  cleanDescription = cleanDescription.replace(/\s+/g, ' ').trim();

  // Create display map
  const tagDisplayMap: Record<string, string> = {};
  normalizedSuggestions.forEach(({ original, normalized }) => {
    tagDisplayMap[normalized] = original;
  });

  return (
    <span className={`tag-display ${className}`}>
      {cleanDescription && (
        <span className="description-text">
          {cleanDescription}
          {foundTags.length > 0 && (
            <span className="tags-inline">
              {foundTags.map((tag) => {
                const displayText = getTagLabel
                  ? getTagLabel(tagDisplayMap[tag] || tag)
                  : (translationKey 
                      ? t(`${translationKey}.${tagDisplayMap[tag] || tag}`) 
                      : (tagDisplayMap[tag] || tag));
                return (
                  <span key={tag} className="tag-inline">
                    {displayText}
                  </span>
                );
              })}
            </span>
          )}
        </span>
      )}
      {!cleanDescription && foundTags.length > 0 && (
        <span className="tags-inline">
          {foundTags.map((tag) => {
            const displayText = getTagLabel
              ? getTagLabel(tagDisplayMap[tag] || tag)
              : (translationKey 
                  ? t(`${translationKey}.${tagDisplayMap[tag] || tag}`) 
                  : (tagDisplayMap[tag] || tag));
            return (
              <span key={tag} className="tag-inline">
                {displayText}
              </span>
            );
          })}
        </span>
      )}
    </span>
  );
};

export default TagDisplay;
