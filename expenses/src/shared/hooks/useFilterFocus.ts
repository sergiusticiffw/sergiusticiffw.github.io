import { useState, useCallback } from 'react';

/** Force mobile browsers to recalculate layout so fixed navbar repaints (iOS/Android keyboard close bug) */
export function nudgeViewportForFixedRepaint() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('resize'));
  if (window.visualViewport) {
    window.visualViewport.dispatchEvent(new Event('scroll'));
  }
}

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
    setTimeout(() => {
      setIsFilterFocused(false);
      nudgeViewportForFixedRepaint();
    }, 200);
  }, []);

  const handleChipClick = useCallback(() => {
    setIsFilterFocused(true);
  }, []);

  const handleSelection = useCallback(() => {
    setIsFilterFocused(false);
    nudgeViewportForFixedRepaint();
  }, []);

  return {
    isFilterFocused,
    handleFocus,
    handleBlur,
    handleChipClick,
    handleSelection,
  };
};
