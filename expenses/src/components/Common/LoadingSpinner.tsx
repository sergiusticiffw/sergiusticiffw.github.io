import React from 'react';
import './LoadingSpinner.scss';

interface LoadingSpinnerProps {
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ className = '' }) => {
  return (
    <div className={`loading-spinner ${className}`}>
      <div className="loader">
        <span className="loader__element"></span>
        <span className="loader__element"></span>
        <span className="loader__element"></span>
      </div>
    </div>
  );
};

export default LoadingSpinner;

