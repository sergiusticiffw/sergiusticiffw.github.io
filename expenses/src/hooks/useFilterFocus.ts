import { useState, useCallback } from 'react';

/**
 * Hook for managing filter focus state
 * Handles the delayed blur to allow chip clicks
 */
export const useFilterFocus = () => {
  const [isFilterFocused, setIsFilterFocused] = useState(false);

  const handleFocus = useCallback(() => {
    setIsFilterFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    // Delay to allow chip click
    setTimeout(() => setIsFilterFocused(false), 200);
  }, []);

  const handleChipClick = useCallback(() => {
    setIsFilterFocused(true);
  }, []);

  const handleSelection = useCallback(() => {
    setIsFilterFocused(false);
  }, []);

  return {
    isFilterFocused,
    handleFocus,
    handleBlur,
    handleChipClick,
    handleSelection,
  };
};


