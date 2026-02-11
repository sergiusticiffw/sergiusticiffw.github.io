import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { Drawer } from 'vaul';
import { FiX } from 'react-icons/fi';

interface VaulDrawerProps {
  show: boolean;
  onClose: (
    event?:
      | React.MouseEvent<HTMLAnchorElement | HTMLButtonElement, MouseEvent>
      | KeyboardEvent
  ) => void;
  children: ReactNode;
  title?: string;
  headerContent?: ReactNode;
  topContent?: ReactNode;
  footer?: ReactNode;
  /** Ascunde butonul X din header (ex. Quick Add) */
  hideCloseButton?: boolean;
}

const VaulDrawer: React.FC<VaulDrawerProps> = ({
  show,
  onClose,
  children,
  title,
  headerContent,
  topContent,
  footer,
  hideCloseButton = false,
}) => {
  const drawerBodyRef = useRef<HTMLDivElement>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [viewportRect, setViewportRect] = useState<{ top: number; height: number }>({ top: 0, height: 0 });

  useEffect(() => {
    if (!show) {
      setKeyboardVisible(false);
      return;
    }

    const handleViewportChange = () => {
      if (!window.visualViewport || !window.innerHeight) return;
      const vv = window.visualViewport;
      const viewportHeight = vv.height;
      const windowHeight = window.innerHeight;
      const threshold = 150;
      const keyboardOpen = viewportHeight < windowHeight - threshold;
      setKeyboardVisible(keyboardOpen);
      if (keyboardOpen) {
        setViewportRect({ top: vv.offsetTop, height: viewportHeight });
      }
    };

    if (window.visualViewport) {
      handleViewportChange();
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    }
    window.addEventListener('resize', handleViewportChange);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      }
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [show]);

  // Scroll to active input when keyboard appears
  useEffect(() => {
    if (!show || !drawerBodyRef.current || !keyboardVisible) return;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        setTimeout(() => {
          if (target && drawerBodyRef.current) {
            const inputRect = target.getBoundingClientRect();
            const drawerBodyRect = drawerBodyRef.current.getBoundingClientRect();
            const footerEl = drawerBodyRef.current.parentElement?.querySelector('.modal-footer');
            const footerHeight = footerEl ? (footerEl as HTMLElement).getBoundingClientRect().height : 0;
            if (inputRect.bottom > drawerBodyRect.bottom - footerHeight) {
              const scrollOffset = inputRect.bottom - drawerBodyRect.bottom + footerHeight + 20;
              drawerBodyRef.current.scrollTop += scrollOffset;
            }
          }
        }, 300);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [show, keyboardVisible]);

  const handleClose = () => {
    const syntheticEvent = {
      preventDefault: () => {},
    } as React.MouseEvent<HTMLButtonElement, MouseEvent>;
    onClose(syntheticEvent);
  };

  const footerBottomPx =
    typeof window !== 'undefined' && keyboardVisible
      ? window.innerHeight - viewportRect.top - viewportRect.height
      : 0;

  const drawerContentStyle: React.CSSProperties | undefined = keyboardVisible
    ? {
        position: 'fixed',
        top: `${viewportRect.top}px`,
        height: `${Math.round(viewportRect.height * 0.92)}px`,
        maxHeight: 'none',
        bottom: 'auto',
        left: 0,
        right: 0,
        ['--footer-bottom' as string]: `${footerBottomPx}px`,
      }
    : undefined;

  return (
    <Drawer.Root open={show} onOpenChange={(open) => !open && handleClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="modal-window" />
        <Drawer.Content
          className={`vaul-drawer-content${keyboardVisible ? ' keyboard-visible' : ''}`}
          aria-describedby={undefined}
          style={drawerContentStyle}
        >
          <div className="vaul-drawer__handle-wrap">
            <Drawer.Handle className="vaul-drawer__handle" />
          </div>

          {(title || headerContent) && (
            <div className="modal-header">
              {headerContent ? (
                headerContent
              ) : (
                <>
                  <Drawer.Title asChild>
                    <h3>{title}</h3>
                  </Drawer.Title>
                  {!hideCloseButton && (
                    <button
                      className="modal-close-btn"
                      onClick={handleClose}
                      type="button"
                      aria-label="Close"
                    >
                      <FiX />
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {topContent && <div className="modal-top-content">{topContent}</div>}

          <div
            ref={drawerBodyRef}
            className={`modal-body ${keyboardVisible ? 'keyboard-visible' : ''}`}
          >
            {children}
          </div>

          {footer && <div className="modal-footer">{footer}</div>}

          {!title && !headerContent && (
            <button
              className="modal-close"
              onClick={handleClose}
              type="button"
              aria-label="Close"
            >
              <FiX />
            </button>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};

export default VaulDrawer;
