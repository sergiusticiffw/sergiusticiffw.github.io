import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, Info, X, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NotificationProps {
  message: string;
  type: string;
  onClose?: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
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
        return <CheckCircle className="w-5 h-5" />;
      case 'error':
        return <XCircle className="w-5 h-5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5" />;
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

  const getNotificationStyles = () => {
    switch (type) {
      case 'success':
        return {
          card: 'border-green-500/50 bg-green-500/5 shadow-green-500/10',
          icon: 'bg-green-500/10 text-green-500',
          title: 'text-green-600',
          progress: 'bg-green-500',
        };
      case 'error':
        return {
          card: 'border-destructive/50 bg-destructive/5 shadow-destructive/10',
          icon: 'bg-destructive/10 text-destructive',
          title: 'text-destructive',
          progress: 'bg-destructive',
        };
      case 'warning':
        return {
          card: 'border-yellow-500/50 bg-yellow-500/5 shadow-yellow-500/10',
          icon: 'bg-yellow-500/10 text-yellow-500',
          title: 'text-yellow-600',
          progress: 'bg-yellow-500',
        };
      default:
        return {
          card: 'border-primary/50 bg-primary/5 shadow-primary/10',
          icon: 'bg-primary/10 text-primary',
          title: 'text-primary',
          progress: 'bg-primary',
        };
    }
  };

  const styles = getNotificationStyles();

  return (
    <Card 
      className={cn(
        'w-full max-w-sm border-l-4 shadow-lg transition-all duration-300 ease-out',
        styles.card,
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
        isClosing ? 'translate-x-full opacity-0' : ''
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn('flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center', styles.icon)}>
            {getIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className={cn('text-sm font-semibold mb-1', styles.title)}>
              {getTitle()}
            </div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              {message}
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="flex-shrink-0 h-6 w-6 p-0 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
        
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 h-1 bg-muted rounded-b-lg overflow-hidden">
          <div 
            className={cn('h-full transition-all duration-300 ease-linear', styles.progress)}
            style={{
              animation: 'progress 4s linear forwards'
            }}
          />
        </div>
      </CardContent>
      

    </Card>
  );
};

export default Notification;
