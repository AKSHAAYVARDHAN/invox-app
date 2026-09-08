import { RefObject } from 'react';

type PullState = 'idle' | 'pulling' | 'ready' | 'refreshing';

/**
 * Hook interface preserved for application compatibility.
 * Accidental pull-to-refresh and wheel/touch interception have been removed
 * to ensure scrolling remains 100% natural and never triggers unexpected page reloads.
 */
export const usePullToRefresh = (
  _scrollElementRef?: RefObject<HTMLElement>,
  _onRefresh?: () => Promise<void>
) => {
  return { state: 'idle' as PullState, pullDistance: 0 };
};

