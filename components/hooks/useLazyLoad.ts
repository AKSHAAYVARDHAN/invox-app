import { useEffect, useRef, useState, RefObject } from 'react';

interface LazyLoadOptions {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
}

/**
 * A hook to detect when an element is visible in the viewport.
 * @param options IntersectionObserver options.
 * @returns A ref to attach to the element and a boolean indicating if it's visible.
 */
export const useLazyLoad = <T extends HTMLElement>(options: LazyLoadOptions = {}): [RefObject<T>, boolean] => {
  const [isIntersecting, setIntersecting] = useState(false);
  const elementRef = useRef<T>(null);

  useEffect(() => {
    // Fallback for environments where IntersectionObserver is not available (e.g., some test environments)
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
        setIntersecting(true);
        return;
    }
      
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Trigger once when the element comes into view
        if (entry.isIntersecting) {
          setIntersecting(true);
          observer.disconnect();
        }
      },
      {
        root: options.root || null,
        rootMargin: options.rootMargin || '200px 0px', // Start loading when the element is 200px away from the viewport
        threshold: options.threshold || 0.01, // Trigger as soon as a small part is visible
      }
    );

    const currentElement = elementRef.current;
    if (currentElement) {
      observer.observe(currentElement);
    }

    return () => {
      if (currentElement) {
        observer.unobserve(currentElement);
      }
    };
  }, [options.root, options.rootMargin, options.threshold]);

  return [elementRef, isIntersecting];
};
