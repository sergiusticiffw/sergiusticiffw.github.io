import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useRef,
  useEffect,
} from 'react';
import Notification from '@shared/components/Notification/Notification';
import { notificationType } from '@shared/utils/constants';

export interface NotificationAction {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary';
}

export interface NotificationOptions {
  duration?: number; // Auto-dismiss duration in ms (0 = persistent)
  persistent?: boolean; // If true, notification won't auto-dismiss
  actions?: NotificationAction[]; // Action buttons
  onClick?: () => void; // Click handler for entire notification
  sound?: boolean; // Play sound notification
  priority?: 'low' | 'normal' | 'high'; // Notification priority
  groupId?: string; // Group similar notifications
}

export interface NotificationItem {
  id: string;
  message: string;
  type: string;
  timestamp: number;
  options?: NotificationOptions;
}

interface NotificationContextProps {
  children: ReactNode;
}

interface NotificationContextType {
  showNotification: (
    message: string,
    type: string,
    options?: NotificationOptions
  ) => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  showNotification: () => {},
  removeNotification: () => {},
  clearAllNotifications: () => {},
});

export const useNotification = () => {
  const context = useContext(NotificationContext);
  return context.showNotification;
};

export const useNotificationManager = () => useContext(NotificationContext);

export const NotificationProvider = ({
  children,
}: NotificationContextProps) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const removeNotification = useCallback((id: string) => {
    // Clear timeout if exists
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }

    setNotifications((prev) =>
      prev.filter((notification) => notification.id !== id)
    );
  }, []);

  const clearAllNotifications = useCallback(() => {
    // Clear all timeouts
    timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    timeoutsRef.current.clear();
    setNotifications([]);
  }, []);

  const showNotification = useCallback(
    (message: string, type: string, options?: NotificationOptions) => {
      const id = Math.random().toString(36).substr(2, 9);
      const newNotification: NotificationItem = {
        id,
        message,
        type,
        timestamp: Date.now(),
        options,
      };

      setNotifications((prev) => {
        // If groupId is provided, remove previous notifications with same groupId
        if (options?.groupId) {
          return [
            ...prev.filter((n) => n.options?.groupId !== options.groupId),
            newNotification,
          ];
        }
        
        // For error notifications, remove previous error notifications with the same message
        // This prevents duplicate error notifications from accumulating
        const isError = type === notificationType.ERROR || type === 'error';
        if (isError) {
          // Remove previous error notifications with the same message
          const filtered = prev.filter(
            (n) => !(n.type === 'error' && n.message === message)
          );
          return [...filtered, newNotification];
        }
        
        return [...prev, newNotification];
      });

      // Play sound if enabled
      if (options?.sound) {
        try {
          const audio = new Audio('/notification-sound.mp3');
          audio.volume = 0.3;
          audio.play().catch(() => {
            // Ignore audio errors
          });
        } catch (error) {
          // Ignore audio errors
        }
      }

      // Auto-dismiss logic
      // Error notifications are persistent by default (require manual dismissal)
      const isError = type === notificationType.ERROR || type === 'error';
      // Session expired errors should auto-dismiss after 10 seconds
      const isSessionError = isError && message.includes('Session expired');
      const shouldBePersistent =
        options?.persistent !== undefined
          ? options.persistent
          : isError && !isSessionError; // Session errors auto-dismiss, other errors are persistent

      if (!shouldBePersistent && options?.duration !== 0) {
        let timeout = options?.duration;

        if (!timeout) {
          // Session errors auto-dismiss after 10 seconds
          if (isSessionError) {
            timeout = 10000; // 10 seconds for session errors
          } else {
            // Default timeouts based on type
            switch (type) {
              case 'success':
                timeout = 3000; // 3 seconds for success
                break;
              case 'warning':
                timeout = 5000; // 5 seconds for warnings
                break;
              default:
                timeout = 4000; // 4 seconds default
            }
          }
        }

        const timeoutId = setTimeout(() => {
          removeNotification(id);
        }, timeout);

        timeoutsRef.current.set(id, timeoutId);
      }
    },
    [removeNotification]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      timeoutsRef.current.clear();
    };
  }, []);

  return (
    <NotificationContext.Provider
      value={{ showNotification, removeNotification, clearAllNotifications }}
    >
      {children}
      <div className="fixed inset-0 pt-[calc(0.75rem+env(safe-area-inset-top,0))] pr-[calc(0.75rem+env(safe-area-inset-right,0))] pl-[calc(0.75rem+env(safe-area-inset-left,0))] pointer-events-none z-[9999] flex flex-col gap-2 md:pt-[calc(1rem+env(safe-area-inset-top,0))] md:pr-[calc(1.25rem+env(safe-area-inset-right,0))] md:pl-[env(safe-area-inset-left,0)] md:items-end">
        {notifications.map((notification, index) => (
          <div
            key={notification.id}
            className="pointer-events-auto w-full max-w-full md:max-w-[420px]"
            style={{ zIndex: index }}
          >
            <Notification
              message={notification.message}
              type={notification.type}
              options={notification.options}
              onClose={() => removeNotification(notification.id)}
              duration={notification.options?.duration}
              persistent={notification.options?.persistent}
            />
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};
