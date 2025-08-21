import React, { createContext, useContext, useState, ReactNode } from 'react';
import Notification from '@components/Notification/Notification';
import { notificationType, themeList } from '@utils/constants';
import { useAuthState } from '@context/context';
import { AuthState } from '@type/types';

interface NotificationItem {
  id: string;
  message: string;
  type: string;
  timestamp: number;
}

interface NotificationContextProps {
  children: ReactNode;
}

const NotificationContext = createContext<
  (message: string, type: string) => void
>(() => {});

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({
  children,
}: NotificationContextProps) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  
  // Add null check for auth state
  const authState = useAuthState() as AuthState | null;
  let theme = authState?.theme || 'blue-pink-gradient';
  theme = themeList[theme as keyof typeof themeList]
    ? theme
    : 'blue-pink-gradient';
  const gradientClass =
    theme === 'blue-pink-gradient' ? 'has-gradient-accent' : '';

  const showNotification = (message: string, type: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification: NotificationItem = {
      id,
      message,
      type,
      timestamp: Date.now(),
    };
    
    setNotifications(prev => [...prev, newNotification]);
    
    let timeout = 4000; // Default 4 seconds
    if (type === notificationType.ERROR) {
      timeout = 6000; // 6 seconds for errors
    } else if (type === 'success') {
      timeout = 3000; // 3 seconds for success
    } else if (type === 'warning') {
      timeout = 5000; // 5 seconds for warnings
    }

    // Auto-remove notification after timeout
    setTimeout(() => {
      removeNotification(id);
    }, timeout);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  return (
    <div className={`${theme} ${gradientClass}`}>
      <NotificationContext.Provider value={showNotification}>
        {children}
        {notifications.map((notification, index) => (
          <div
            key={notification.id}
            style={{
              position: 'fixed',
              top: `${20 + (index * 100)}px`,
              right: '20px',
              zIndex: 9999 + index,
            }}
          >
            <Notification
              message={notification.message}
              type={notification.type}
              onClose={() => removeNotification(notification.id)}
            />
          </div>
        ))}
      </NotificationContext.Provider>
    </div>
  );
};
