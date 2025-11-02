import React, { memo } from 'react';
import './LoadingSpinner.scss';

interface LoadingSpinnerProps {
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = memo(({ className = '' }) => {
  return (
    <div className={`loading-spinner ${className}`}>
      <div className="loader">
        <span className="loader__element"></span>
        <span className="loader__element"></span>
        <span className="loader__element"></span>
      </div>
    </div>
  );
});

LoadingSpinner.displayName = 'LoadingSpinner';

export default LoadingSpinner;
