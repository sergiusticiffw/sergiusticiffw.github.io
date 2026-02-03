import React, { useEffect, useState, useRef, FC } from 'react';
import {
  FiCheckCircle,
  FiAlertTriangle,
  FiInfo,
  FiX,
  FiXCircle,
} from 'react-icons/fi';
import { NotificationOptions } from '@shared/context/notification';
import './Notification.scss';

interface NotificationProps {
  message: string;
  type: string;
  onClose?: () => void;
  options?: NotificationOptions;
  duration?: number;
  persistent?: boolean;
}

const Notification: FC<NotificationProps> = ({
  message,
  type,
  onClose,
  options,
  duration,
  persistent,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const startTimeRef = useRef<number>(Date.now());
  const pausedTimeRef = useRef<number>(0);

  // Determine if notification should be persistent
  const isError = type === 'error';
  const isPersistent = persistent !== undefined ? persistent : isError;
  const actualDuration = duration || (isPersistent ? 0 : 4000);

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Progress bar animation
  useEffect(() => {
    if (isPersistent || actualDuration === 0) {
      return;
    }

    const updateProgress = () => {
      if (isPaused) return;

      const elapsed = Date.now() - startTimeRef.current - pausedTimeRef.current;
      const remaining = Math.max(0, 100 - (elapsed / actualDuration) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        handleClose();
      }
    };

    progressIntervalRef.current = setInterval(updateProgress, 50);
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [actualDuration, persistent, isPaused]);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    setTimeout(() => {
      onClose?.();
    }, 300);
  };

  const handlePause = () => {
    if (!isPaused) {
      pausedTimeRef.current += Date.now() - startTimeRef.current;
      startTimeRef.current = Date.now();
    } else {
      startTimeRef.current = Date.now();
    }
    setIsPaused(!isPaused);
  };

  const handleClick = () => {
    if (options?.onClick) {
      options.onClick();
    }
  };

  // Swipe to dismiss for mobile
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [swipeDistance, setSwipeDistance] = useState(0);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStart === null) return;
    const currentX = e.targetTouches[0].clientX;
    const distance = touchStart - currentX;
    setSwipeDistance(distance);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe || isRightSwipe) {
      handleClose();
    }

    setTouchStart(null);
    setTouchEnd(null);
    setSwipeDistance(0);
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <FiCheckCircle />;
      case 'error':
        return <FiXCircle />;
      case 'warning':
        return <FiAlertTriangle />;
      default:
        return <FiInfo />;
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'success':
        return 'Success';
      case 'error':
        return 'Error';
      case 'warning':
        return 'Warning';
      default:
        return 'Info';
    }
  };

  const hasActions = options?.actions && options.actions.length > 0;
  const isClickable = options?.onClick || hasActions;

  return (
    <div
      ref={notificationRef}
      className={`notification ${type} ${isVisible ? 'visible' : ''} ${isClosing ? 'closing' : ''} ${isClickable ? 'clickable' : ''} ${isPaused ? 'paused' : ''}`}
      onMouseEnter={handlePause}
      onMouseLeave={handlePause}
      onClick={handleClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        transform:
          swipeDistance !== 0 ? `translateX(${-swipeDistance}px)` : undefined,
        opacity:
          swipeDistance !== 0 ? 1 - Math.abs(swipeDistance) / 200 : undefined,
      }}
    >
      <div className="notification-content">
        <div className="notification-icon">{getIcon()}</div>
        <div className="notification-body">
          <div className="notification-title">{getTitle()}</div>
          <div className="notification-message">{message}</div>
          {hasActions && (
            <div className="notification-actions">
              {options.actions!.map((action, index) => (
                <button
                  key={index}
                  className={`notification-action ${action.style || 'secondary'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.action();
                    if (!action.style || action.style === 'primary') {
                      handleClose();
                    }
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          className="notification-close"
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          aria-label="Close notification"
        >
          <FiX />
        </button>
      </div>
      {!isPersistent && actualDuration > 0 && (
        <div className="notification-progress">
          <div
            className="notification-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default Notification;
