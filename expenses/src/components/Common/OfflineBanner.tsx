import React, { useState, useEffect } from 'react';
import { useLocalization } from '@context/localization';
import { FiWifiOff } from 'react-icons/fi';
import './OfflineBanner.scss';

const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { t } = useLocalization();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div className="offline-banner">
      <FiWifiOff className="offline-banner__icon" />
      <span className="offline-banner__text">{t('offline.message')}</span>
    </div>
  );
};

export default OfflineBanner;
