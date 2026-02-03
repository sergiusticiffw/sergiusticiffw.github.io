import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  extractHashtags,
  addTagToText,
  removeTagFromText,
  hasTagInText,
} from '@shared/utils/utils';

interface UseTagsOptions {
  suggestions: string[];
  description: string;
  formType: 'add' | 'edit';
  normalizeTag?: (tag: string) => string;
}

interface UseTagsReturn {
  selectedTags: string[];
  handleTagClick: (tag: string) => string;
  isTagSelected: (tag: string) => boolean;
}

/**
 * Normalize tag name (convert to lowercase, replace spaces/special chars with hyphens)
 */
export const normalizeTag = (suggestion: string): string => {
  return suggestion
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

/**
 * Custom hook for managing tags in forms
 */
export const useTags = ({
  suggestions,
  description,
  formType,
  normalizeTag: customNormalizeTag,
}: UseTagsOptions): UseTagsReturn => {
  // Memoize normalize function to prevent recreation on every render
  const normalize = useMemo(
    () => customNormalizeTag || normalizeTag,
    [customNormalizeTag]
  );

  // Track selected tags for highlighting
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isManuallySelecting, setIsManuallySelecting] = useState(false);

  // Use refs to track previous values and suggestions to prevent unnecessary re-runs
  const prevSuggestionsRef = useRef<string>('');
  const prevDescriptionRef = useRef<string>('');
  const suggestionsRef = useRef<string[]>(suggestions);

  // Update suggestions ref when they actually change
  const suggestionsContent = suggestions.slice().sort().join('|');
  if (prevSuggestionsRef.current !== suggestionsContent) {
    suggestionsRef.current = suggestions;
    prevSuggestionsRef.current = suggestionsContent;
  }

  // Initialize selected tags when editing based on existing hashtags
  useEffect(() => {
    // Skip if user is manually selecting tags
    if (isManuallySelecting) {
      setIsManuallySelecting(false);
      return;
    }

    // Check if description actually changed
    const descriptionChanged = prevDescriptionRef.current !== description;

    // Only update if description changed or on initial mount
    if (
      !descriptionChanged &&
      formType === 'edit' &&
      prevDescriptionRef.current
    ) {
      return;
    }

    // Update description ref
    if (descriptionChanged) {
      prevDescriptionRef.current = description;
    }

    if (
      formType === 'edit' &&
      description &&
      suggestionsRef.current.length > 0
    ) {
      const existingTags = extractHashtags(description);
      // Normalize tags and filter to only include valid suggestions
      const validTags = existingTags
        .map((tag) => {
          const normalizedTag = normalize(tag);
          const matchingSuggestion = suggestionsRef.current.find((s) => {
            const normalizedSuggestion = normalize(s);
            return normalizedSuggestion === normalizedTag;
          });
          return matchingSuggestion ? normalize(matchingSuggestion) : null;
        })
        .filter((tag): tag is string => tag !== null);

      setSelectedTags(validTags);
    } else if (formType === 'add' || !description) {
      setSelectedTags([]);
      if (!description) {
        prevDescriptionRef.current = description;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formType, description, isManuallySelecting]);

  /**
   * Handle tag click - returns new description with tag added/removed
   */
  const handleTagClick = useCallback(
    (tag: string): string => {
      // Mark that we're manually selecting to prevent useEffect from overriding
      setIsManuallySelecting(true);

      const normalizedTag = normalize(tag);
      const tagExists = hasTagInText(description, normalizedTag);
      let newDescription: string;

      if (tagExists) {
        // Remove tag if it exists
        newDescription = removeTagFromText(description, normalizedTag);
        setSelectedTags((prev) => prev.filter((t) => t !== normalizedTag));
      } else {
        // Add tag if it doesn't exist (to the end)
        newDescription = addTagToText(description, normalizedTag);
        setSelectedTags((prev) => [...prev, normalizedTag]);
      }

      return newDescription;
    },
    [description, normalize]
  );

  /**
   * Check if a tag is selected
   */
  const isTagSelected = (tag: string): boolean => {
    const normalizedTag = normalize(tag);
    return (
      selectedTags.includes(normalizedTag) ||
      hasTagInText(description, normalizedTag)
    );
  };

  return {
    selectedTags,
    handleTagClick,
    isTagSelected,
  };
};
