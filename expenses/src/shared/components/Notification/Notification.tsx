import React, { useEffect, useState, useRef, FC } from 'react';
import {
  FiCheckCircle,
  FiAlertTriangle,
  FiInfo,
  FiX,
  FiXCircle,
} from 'react-icons/fi';
import { NotificationOptions } from '@shared/context/notification';

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

  const typeStyles = {
    success: 'border-l-4 border-l-emerald-500 [&_.notification-icon-box]:bg-emerald-500/10 [&_.notification-icon-box]:text-emerald-500 [&_.notification-title-box]:text-emerald-600 dark:[&_.notification-title-box]:text-emerald-400 [&_.notification-progress-bar]:bg-gradient-to-r [&_.notification-progress-bar]:from-emerald-500 [&_.notification-progress-bar]:to-emerald-400',
    error: 'border-l-4 border-l-red-500 [&_.notification-icon-box]:bg-red-500/10 [&_.notification-icon-box]:text-red-500 [&_.notification-title-box]:text-red-600 dark:[&_.notification-title-box]:text-red-400 [&_.notification-progress-bar]:bg-gradient-to-r [&_.notification-progress-bar]:from-red-500 [&_.notification-progress-bar]:to-red-400',
    warning: 'border-l-4 border-l-amber-500 [&_.notification-icon-box]:bg-amber-500/10 [&_.notification-icon-box]:text-amber-500 [&_.notification-title-box]:text-amber-600 dark:[&_.notification-title-box]:text-amber-400 [&_.notification-progress-bar]:bg-gradient-to-r [&_.notification-progress-bar]:from-amber-500 [&_.notification-progress-bar]:to-amber-400',
    info: 'border-l-4 border-l-blue-500 [&_.notification-icon-box]:bg-blue-500/10 [&_.notification-icon-box]:text-blue-500 [&_.notification-title-box]:text-blue-600 dark:[&_.notification-title-box]:text-blue-400 [&_.notification-progress-bar]:bg-gradient-to-r [&_.notification-progress-bar]:from-blue-500 [&_.notification-progress-bar]:to-blue-400',
  };

  const cardBase =
    'w-full bg-white/[0.98] backdrop-blur-[20px] border border-black/[0.08] rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden relative cursor-default transition-all duration-[0.4s] ease-[cubic-bezier(0.16,1,0.3,1)] dark:bg-[rgba(26,26,26,0.95)] dark:border-white/10 dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)]';
  const visibleClass = isVisible ? 'translate-x-0 opacity-100' : 'translate-x-[calc(100%+24px)] opacity-0';
  const closingClass = isClosing ? 'translate-x-[calc(100%+24px)] opacity-0 pointer-events-none' : '';
  const clickableClass = isClickable ? 'cursor-pointer hover:translate-x-0 hover:scale-[1.02] hover:shadow-[0_12px_48px_rgba(0,0,0,0.15)] active:scale-[0.98]' : '';
  const pausedClass = isPaused ? '[&_.notification-progress-bar]:[animation-play-state:paused]' : '';

  return (
    <div
      ref={notificationRef}
      className={`${cardBase} ${typeStyles[type as keyof typeof typeStyles] || typeStyles.info} ${visibleClass} ${closingClass} ${clickableClass} ${pausedClass}`}
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
      <div className="flex items-start gap-3.5 p-4 pt-5 relative md:p-4 md:pt-5">
        <div className="notification-icon-box shrink-0 w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl [&_svg]:w-5 [&_svg]:h-5 [&_svg]:[stroke-width:2.5]">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="notification-title-box text-xs font-semibold uppercase tracking-wider leading-tight">
            {getTitle()}
          </div>
          <div className="text-[0.9375rem] font-normal leading-normal text-black/85 break-words dark:text-white/90">
            {message}
          </div>
          {hasActions && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {options.actions!.map((action, index) => (
                <button
                  key={index}
                  className={`px-3.5 py-1.5 rounded-lg text-[0.8125rem] font-medium border cursor-pointer transition-all ${
                    action.style === 'primary'
                      ? 'bg-black/10 text-black/90 dark:bg-white/15 dark:text-white/95 hover:bg-black/12 dark:hover:bg-white/20'
                      : 'bg-transparent text-black/60 border-black/20 dark:text-white/70 dark:border-white/20 hover:bg-black/5 hover:text-black/80 dark:hover:bg-white/10 dark:hover:text-white/90'
                  }`}
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
          className="shrink-0 w-8 h-8 md:w-[32px] md:h-[32px] bg-black/5 border border-black/8 rounded-lg text-black/50 flex items-center justify-center p-0 transition-all hover:bg-black/10 hover:text-black/80 dark:bg-white/10 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/15 dark:hover:text-white/90 [&_svg]:w-4 [&_svg]:h-4"
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
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/5 dark:bg-white/5 overflow-hidden">
          <div
            className="notification-progress-bar h-full transition-[width] duration-100 linear rounded-b-2xl"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default Notification;
