import React from 'react';
import { ArrowUpIcon } from './Icons';

type PullState = 'idle' | 'pulling' | 'ready' | 'refreshing';

interface PullToRefreshIndicatorProps {
  state: PullState;
  distance: number;
}

const PULL_THRESHOLD = 80; // Should match the value in the hook

const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({ state, distance }) => {
  const isVisible = state !== 'idle' || distance > 0;
  // FIX: Use Tailwind classes for rotation instead of an inline style for better maintainability.
  const rotationClass = state === 'ready' || state === 'refreshing' ? 'rotate-0' : 'rotate-180';
  const opacity = Math.min(distance / (PULL_THRESHOLD * 0.8), 1);

  return (
    <div
      className="absolute -top-14 left-0 right-0 flex justify-center items-start pt-2 pointer-events-none z-20"
      style={{
        transform: `translateY(${distance}px)`,
        opacity: isVisible ? 1 : 0,
        transition: state === 'idle' || state === 'pulling' ? 'transform 0.2s, opacity 0.2s' : 'transform 0.2s',
      }}
      aria-hidden="true"
    >
      <div className="bg-invox-dark-accent p-3 rounded-full shadow-lg border border-gray-700 flex items-center justify-center">
        {state === 'refreshing' ? (
          <div className="w-6 h-6 border-2 border-gray-600 border-t-white rounded-full animate-spin"></div>
        ) : (
          <div style={{ opacity }}>
            {/* FIX: Removed unsupported 'style' prop and applied rotation via className. */}
            <ArrowUpIcon
              className={`w-6 h-6 text-invox-light-gray transition-transform duration-300 ${rotationClass}`}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PullToRefreshIndicator;