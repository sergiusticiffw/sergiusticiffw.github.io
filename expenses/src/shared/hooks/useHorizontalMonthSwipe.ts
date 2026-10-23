import { useCallback, useRef, type TouchEvent } from 'react';

type MonthDirection = 'prev' | 'next';

/**
 * Horizontal swipe → previous/next month.
 * Attach the returned handlers to a container that should accept the gesture
 * (e.g. the whole calendar view page, including Budget Rings above the grid).
 */
export function useHorizontalMonthSwipe(
  onMonthChange: (direction: MonthDirection) => void,
  enabled = true
) {
  const startX = useRef(0);
  const endX = useRef(0);
  const swiping = useRef(false);
  const tracking = useRef(false);

  const onTouchStart = useCallback(
    (event: TouchEvent) => {
      if (!enabled) return;
      const target = event.target as HTMLElement | null;
      // Don't steal swipes from text inputs / range controls.
      if (target?.closest('input, textarea, select, [data-no-month-swipe]')) {
        tracking.current = false;
        return;
      }
      tracking.current = true;
      startX.current = event.touches[0].clientX;
      endX.current = startX.current;
      swiping.current = false;
    },
    [enabled]
  );

  const onTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!enabled || !tracking.current) return;
      endX.current = event.touches[0].clientX;
      swiping.current = true;
    },
    [enabled]
  );

  const onTouchEnd = useCallback(() => {
    if (!enabled || !tracking.current || !swiping.current) {
      tracking.current = false;
      swiping.current = false;
      return;
    }
    const deltaX = endX.current - startX.current;
    const threshold = window.innerWidth * 0.25;
    if (Math.abs(deltaX) > threshold) {
      onMonthChange(deltaX > 0 ? 'prev' : 'next');
    }
    tracking.current = false;
    swiping.current = false;
  }, [enabled, onMonthChange]);

  if (!enabled) {
    return {};
  }

  return { onTouchStart, onTouchMove, onTouchEnd };
}
