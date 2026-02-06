import React, { memo } from 'react';

interface LoadingSpinnerProps {
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = memo(
  ({ className = '' }) => {
    return (
      <div className={`flex justify-center items-center py-12 min-h-[60vh] ${className}`}>
        <div className="relative flex items-center justify-center gap-3">
          <span className="inline-block w-[18px] h-[18px] rounded-full bg-[var(--color-app-accent)]" style={{ animation: 'loader-bounce 1.4s ease-in-out infinite both', animationDelay: '-0.32s' }} />
          <span className="inline-block w-[18px] h-[18px] rounded-full bg-[var(--color-app-accent)]" style={{ animation: 'loader-bounce 1.4s ease-in-out infinite both', animationDelay: '-0.16s' }} />
          <span className="inline-block w-[18px] h-[18px] rounded-full bg-[var(--color-app-accent)]" style={{ animation: 'loader-bounce 1.4s ease-in-out infinite both' }} />
        </div>
      </div>
    );
  }
);

LoadingSpinner.displayName = 'LoadingSpinner';

export default LoadingSpinner;
