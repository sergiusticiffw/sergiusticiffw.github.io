import React, { createContext, useContext, useState, ReactNode } from 'react';
import Notification from '@components/Notification/Notification';
import { notificationType } from '@utils/constants';

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
    <>
      <NotificationContext.Provider value={showNotification}>
        {children}
      </NotificationContext.Provider>
      
      {/* Notification Container */}
      <div className="fixed top-4 right-4 z-[9999] space-y-3 pointer-events-none">
        {notifications.map((notification, index) => (
          <div
            key={notification.id}
            className="pointer-events-auto animate-in slide-in-from-right-full duration-300"
            style={{
              animationDelay: `${index * 100}ms`,
            }}
          >
            <Notification
              message={notification.message}
              type={notification.type}
              onClose={() => removeNotification(notification.id)}
            />
          </div>
        ))}
      </div>
    </>
  );
};
