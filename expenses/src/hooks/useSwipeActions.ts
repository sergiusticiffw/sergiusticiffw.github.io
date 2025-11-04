import { useState, useRef } from 'react';

interface SwipeActions {
  startX: number | null;
  startY: number | null;
  swipedItemId: string | null;
  deleteVisible: boolean;
  editVisible: boolean;
  extraRowStyle: React.CSSProperties;
  isSwiping: boolean | null;
  handleTouchStart: (
    e: React.TouchEvent<HTMLDivElement>,
    id: string,
    containerRef: React.RefObject<HTMLElement>
  ) => void;
  handleTouchMove: (
    e: React.TouchEvent<HTMLDivElement>,
    containerRef: React.RefObject<HTMLElement>
  ) => void;
  handleTouchEnd: (
    e: React.TouchEvent<HTMLDivElement>,
    containerRef: React.RefObject<HTMLElement>,
    id: string,
    handleEdit: (id: string) => void,
    setShowDeleteModal: (id: string) => void
  ) => void;
}

const useSwipeActions = (): SwipeActions => {
  const [startX, setStartX] = useState<number | null>(null);
  const [startY, setStartY] = useState<number | null>(null);
  const [swipedItemId, setSwipedItemId] = useState<string | null>(null);
  const [deleteVisible, setDeleteVisible] = useState<boolean>(false);
  const [editVisible, setEditVisible] = useState<boolean>(false);
  const [extraRowStyle, setExtraRowStyle] = useState<React.CSSProperties>({});
  const [isSwiping, setIsSwiping] = useState<boolean | null>(null);
  // Store scroll position to restore after position: fixed
  const scrollPositionRef = useRef<number>(0);
  const isFixedRef = useRef<boolean>(false);
  
  // Detect Safari iOS
  const isSafariIOS = useRef<boolean>(
    typeof window !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as any).MSStream
  );

  const handleTouchStart = (
    e: React.TouchEvent<HTMLDivElement>,
    id: string,
    containerRef: React.RefObject<HTMLElement>
  ) => {
    const touch = e.touches[0];
    if (touch) {
      setStartX(touch.clientX);
      setStartY(touch.clientY);
      setSwipedItemId(id);

      const trElement = containerRef.current?.querySelector(
        `[data-id="${id}"]`
      ) as HTMLElement;
      if (trElement) {
        trElement.style.transition = 'transform 0s';
        const rect = trElement.getBoundingClientRect();
        setExtraRowStyle({
          position: 'fixed',
          zIndex: '1',
          top: `${rect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
        });
      }
    }
  };

  const handleTouchMove = (
    e: React.TouchEvent<HTMLDivElement>,
    containerRef: React.RefObject<HTMLElement>
  ) => {
    if (isSwiping === null) {
      const touch = e.touches[0];
      if (touch && startX !== null && startY !== null) {
        const distanceX = startX - touch.clientX;
        const distanceY = startY - touch.clientY;
        const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);
        setIsSwiping(isHorizontalSwipe);
      }
    } else if (isSwiping) {
      // Prevent body scroll when swiping horizontally
      if (!isFixedRef.current) {
        isFixedRef.current = true;
        
        if (isSafariIOS.current) {
          // For Safari iOS, use a less aggressive approach to avoid flickering
          // But still prevent horizontal scroll effectively
          if (containerRef.current) {
            containerRef.current.style.overflowX = 'hidden';
            containerRef.current.style.overflowY = 'auto'; // Allow vertical scroll
            containerRef.current.style.webkitOverflowScrolling = 'auto';
            containerRef.current.style.willChange = 'transform';
            containerRef.current.style.overscrollBehaviorX = 'contain'; // Prevent horizontal overscroll
            containerRef.current.style.overscrollBehaviorY = 'contain';
            // Prevent touch events from propagating
            containerRef.current.style.pointerEvents = 'auto';
            // Force no horizontal scroll
            containerRef.current.style.touchAction = 'pan-y pinch-zoom'; // Only vertical panning
          }
          // Use touch-action on body to prevent horizontal scroll
          document.body.style.touchAction = 'pan-y'; // Only allow vertical panning
          document.body.style.overscrollBehaviorX = 'contain'; // Prevent horizontal overscroll
          
          // Also prevent scroll on document.documentElement for Safari
          document.documentElement.style.overflowX = 'hidden';
          document.documentElement.style.touchAction = 'pan-y';
        } else {
          // For Chrome and other browsers, use position: fixed
          scrollPositionRef.current = window.pageYOffset || document.documentElement.scrollTop || 0;
          document.body.style.overflow = 'hidden';
          document.body.style.touchAction = 'none';
          document.body.style.position = 'fixed';
          document.body.style.top = `-${scrollPositionRef.current}px`;
          document.body.style.width = '100%';
          document.body.style.left = '0';
          document.body.style.right = '0';
          
          // Also prevent scroll on container
          if (containerRef.current) {
            containerRef.current.style.overflowX = 'hidden';
            containerRef.current.style.overflowY = 'hidden';
          }
        }
      }

      const diff = e.touches[0].clientX - (startX ?? 0);
      const trElement = containerRef.current?.querySelector(
        `[data-id="${swipedItemId}"]`
      ) as HTMLElement;
      if (trElement) {
        trElement.style.transform = `translateX(${diff}px)`;
        const trWidth = trElement.getBoundingClientRect().width;
        const absDiff = Math.abs(e.touches[0].clientX - (startX ?? 0));
        const diffPercentage = (absDiff / trWidth) * 100;
        if (diffPercentage > 40) {
          const body = document.querySelector('body');
          if (body) {
            body.classList.add('action-active');
          }
        } else {
          const body = document.querySelector('body');
          if (body) {
            body.classList.remove('action-active');
          }
        }

        const isSwipingRight = diff > 0;
        setDeleteVisible(isSwipingRight);
        setEditVisible(!isSwipingRight);
      }
    }
  };

  const handleTouchEnd = (
    e: React.TouchEvent<HTMLDivElement>,
    containerRef: React.RefObject<HTMLElement>,
    id: string,
    handleEdit: (id: string) => void,
    setShowDeleteModal: (id: string) => void
  ) => {
    // Restore body scroll and scroll position
    if (isFixedRef.current) {
      if (isSafariIOS.current) {
        // Restore Safari iOS styles
        document.body.style.touchAction = '';
        document.body.style.overscrollBehaviorX = '';
        
        // Restore documentElement styles
        document.documentElement.style.overflowX = '';
        document.documentElement.style.touchAction = '';
        
        // Restore container scroll
        if (containerRef.current) {
          containerRef.current.style.overflowX = '';
          containerRef.current.style.overflowY = '';
          containerRef.current.style.webkitOverflowScrolling = 'touch';
          containerRef.current.style.willChange = '';
          containerRef.current.style.pointerEvents = '';
          containerRef.current.style.overscrollBehaviorX = '';
          containerRef.current.style.overscrollBehaviorY = '';
          containerRef.current.style.touchAction = '';
        }
      } else {
        // Restore body styles for other browsers
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.left = '';
        document.body.style.right = '';
        
        // Restore scroll position
        window.scrollTo(0, scrollPositionRef.current);
        
        // Restore container scroll
        if (containerRef.current) {
          containerRef.current.style.overflowX = '';
          containerRef.current.style.overflowY = '';
        }
      }
      
      isFixedRef.current = false;
    }

    const touch = e.changedTouches[0];
    if (touch && startX !== null) {
      const endX = touch.clientX;
      const trElement = containerRef.current?.querySelector(
        `[data-id="${id}"]`
      ) as HTMLElement;

      if (isSwiping) {
        const diff = Math.abs(endX - startX);
        const trWidth = trElement.getBoundingClientRect().width;
        const diffPercentage = (diff / trWidth) * 100;
        if (diffPercentage > 40) {
          if (endX > startX) {
            setShowDeleteModal(id);
          } else {
            handleEdit(id);
          }
        }
      }

      if (trElement) {
        trElement.style.transition = 'all .3s ease';
        trElement.style.transform = 'translateX(0)';
      }

      setStartX(null);
      setSwipedItemId(null);
      setDeleteVisible(false);
      setEditVisible(false);
      setExtraRowStyle({});
      setIsSwiping(null);
    }
  };

  return {
    startX,
    startY,
    swipedItemId,
    deleteVisible,
    editVisible,
    extraRowStyle,
    isSwiping,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
};

export default useSwipeActions;
