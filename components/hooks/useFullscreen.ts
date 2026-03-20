import { useState, useEffect, useCallback, RefObject } from 'react';
import {
  requestFullscreen,
  exitFullscreen,
  getFullscreenElement,
  addFullscreenListener,
  removeFullscreenListener,
} from '../utils/fullscreenUtils';

/**
 * A hook to manage fullscreen state for a given element.
 * It attempts to use the native Fullscreen API and falls back to a CSS-based "pseudo-fullscreen" mode.
 * @param elementRef A React ref to the HTML element to be made "fullscreen".
 * @returns an object with `isFullscreen` boolean and a `toggleFullscreen` function.
 */
export const useFullscreen = (elementRef: RefObject<HTMLElement>) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // This function is the source of truth for the fullscreen state
  const updateState = useCallback(() => {
    if (!elementRef.current) {
        setIsFullscreen(false);
        return;
    }
    const isElementFullscreen = getFullscreenElement() === elementRef.current;
    const isElementPseudoFullscreen = elementRef.current.classList.contains('pseudo-fullscreen');
    setIsFullscreen(isElementFullscreen || isElementPseudoFullscreen);
  }, [elementRef]);
  
  const toggleFullscreen = useCallback(async () => {
    if (!elementRef.current) return;

    const isCurrentlyFullscreen = getFullscreenElement() === elementRef.current;
    const isCurrentlyPseudoFullscreen = elementRef.current.classList.contains('pseudo-fullscreen');

    if (isCurrentlyFullscreen) {
      await exitFullscreen().catch(console.error);
      // State will be updated by the event listener
    } else if (isCurrentlyPseudoFullscreen) {
      elementRef.current.classList.remove('pseudo-fullscreen');
      updateState();
    } else {
      try {
        await requestFullscreen(elementRef.current);
        // State will be updated by the event listener
      } catch (error) {
        console.warn('Native fullscreen failed, falling back to pseudo-fullscreen.', error);
        elementRef.current.classList.add('pseudo-fullscreen');
        updateState();
      }
    }
  }, [elementRef, updateState]);
  
  useEffect(() => {
    // Sync state with native fullscreen changes
    const handleFullscreenChange = () => {
      updateState();
    };
    
    addFullscreenListener(handleFullscreenChange);
    
    return () => {
      removeFullscreenListener(handleFullscreenChange);
    };
  }, [updateState]);

  useEffect(() => {
    // Handle escape key for pseudo-fullscreen
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && elementRef.current?.classList.contains('pseudo-fullscreen')) {
        elementRef.current.classList.remove('pseudo-fullscreen');
        updateState();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [elementRef, updateState]);
  
  return { isFullscreen, toggleFullscreen };
};
