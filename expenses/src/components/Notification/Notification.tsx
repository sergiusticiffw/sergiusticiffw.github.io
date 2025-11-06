import React, { useEffect, useState } from 'react';
import {
  FiCheckCircle,
  FiAlertTriangle,
  FiInfo,
  FiX,
  FiXCircle,
} from 'react-icons/fi';
import './Notification.scss';

interface NotificationProps {
  message: string;
  type: string;
  onClose?: () => void;
}

const Notification: React.FC<NotificationProps> = ({
  message,
  type,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose?.();
    }, 300);
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

  return (
    <div
      className={`notification ${type} ${isVisible ? 'visible' : ''} ${isClosing ? 'closing' : ''}`}
    >
      <div className="notification-content">
        <div className="notification-icon">{getIcon()}</div>
        <div className="notification-body">
          <div className="notification-title">{getTitle()}</div>
          <div className="notification-message">{message}</div>
        </div>
        <button className="notification-close" onClick={handleClose}>
          <FiX />
        </button>
      </div>
      <div className="notification-progress"></div>
    </div>
  );
};

export default Notification;
