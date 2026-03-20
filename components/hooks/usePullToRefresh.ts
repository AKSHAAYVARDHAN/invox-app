import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

type PullState = 'idle' | 'pulling' | 'ready' | 'refreshing';

// Constants for pull-to-refresh behavior
const PULL_THRESHOLD = 80; // Pixels the user needs to pull down to trigger the 'ready' state
const INDICATOR_HEIGHT = 60; // The height of the indicator when in the 'refreshing' state

/**
 * A custom hook to implement pull-to-refresh functionality on a scrollable element.
 * @param scrollElementRef A React ref to the scrollable HTML element.
 * @param onRefresh An async function to be called when a refresh is triggered.
 * @returns An object containing the current `state` of the pull gesture and the `pullDistance`.
 */
export const usePullToRefresh = (
  scrollElementRef: RefObject<HTMLElement>,
  onRefresh: () => Promise<void>
) => {
  const [state, setState] = useState<PullState>('idle');
  const [pullDistance, setPullDistance] = useState(0);
  const touchStart = useRef({ y: 0, x: 0 });
  const isDragging = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 1) {
      touchStart.current = { y: e.touches[0].clientY, x: e.touches[0].clientX };
      isDragging.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging.current || !scrollElementRef.current || e.touches.length !== 1) return;

    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const dy = currentY - touchStart.current.y;
    const dx = currentX - touchStart.current.x;

    if (scrollElementRef.current.scrollTop === 0 && dy > 0 && Math.abs(dx) < Math.abs(dy)) {
      e.preventDefault();

      const newPullDistance = Math.pow(dy, 0.85);
      setPullDistance(newPullDistance);

      if (state !== 'refreshing') {
        if (newPullDistance > PULL_THRESHOLD) {
          setState('ready');
        } else {
          setState('pulling');
        }
      }
    }
  }, [state, scrollElementRef]);

  const handleTouchEnd = useCallback(async () => {
    isDragging.current = false;

    if (state === 'ready') {
      setState('refreshing');
      setPullDistance(INDICATOR_HEIGHT);
      await onRefresh();
      setState('idle');
      setPullDistance(0);
    } else if (state !== 'refreshing') {
      setState('idle');
      setPullDistance(0);
    }
  }, [state, onRefresh]);

  const handleWheel = useCallback(async (e: WheelEvent) => {
    if (scrollElementRef.current?.scrollTop === 0 && e.deltaY < 0 && state !== 'refreshing') {
      e.preventDefault();
      setState('refreshing');
      setPullDistance(INDICATOR_HEIGHT);
      await onRefresh();
      setState('idle');
      setPullDistance(0);
    }
  }, [scrollElementRef, onRefresh, state]);

  useEffect(() => {
    const element = scrollElementRef.current;
    if (!element) return;

    const touchOptions = { passive: false };
    element.addEventListener('touchstart', handleTouchStart, touchOptions);
    element.addEventListener('touchmove', handleTouchMove, touchOptions);
    element.addEventListener('touchend', handleTouchEnd);
    element.addEventListener('touchcancel', handleTouchEnd);
    
    const wheelOptions = { passive: false };
    element.addEventListener('wheel', handleWheel, wheelOptions);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
      element.removeEventListener('wheel', handleWheel);
    };
  }, [scrollElementRef, handleTouchStart, handleTouchMove, handleTouchEnd, handleWheel]);

  return { state, pullDistance };
};
