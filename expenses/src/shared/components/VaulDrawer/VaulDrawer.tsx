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
}

const VaulDrawer: React.FC<VaulDrawerProps> = ({
  show,
  onClose,
  children,
  title,
  headerContent,
  topContent,
  footer,
}) => {
  const drawerBodyRef = useRef<HTMLDivElement>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (!show) {
      setKeyboardVisible(false);
      return;
    }

    // Handle visual viewport changes (when keyboard appears/disappears)
    const handleViewportChange = () => {
      if (window.visualViewport && window.innerHeight) {
        // Consider keyboard visible if viewport is significantly smaller than window
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        const threshold = 150; // Keyboard typically reduces height by ~200-300px

        setKeyboardVisible(viewportHeight < windowHeight - threshold);
      }
    };

    // Initial check
    if (window.visualViewport) {
      handleViewportChange();
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    }

    // Also handle window resize as fallback
    window.addEventListener('resize', handleViewportChange);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener(
          'resize',
          handleViewportChange
        );
        window.visualViewport.removeEventListener(
          'scroll',
          handleViewportChange
        );
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
        // Small delay to allow keyboard to appear
        setTimeout(() => {
          if (target && drawerBodyRef.current) {
            // Scroll the input into view within the drawer body
            const inputRect = target.getBoundingClientRect();
            const drawerBodyRect =
              drawerBodyRef.current.getBoundingClientRect();
            const footer =
              drawerBodyRef.current.parentElement?.querySelector(
                '.modal-footer'
              );
            const footerHeight = footer
              ? footer.getBoundingClientRect().height
              : 0;

            // Check if input is below visible area (accounting for footer)
            if (inputRect.bottom > drawerBodyRect.bottom - footerHeight) {
              // Scroll within modal-body to show the input
              const scrollOffset =
                inputRect.bottom - drawerBodyRect.bottom + footerHeight + 20;
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
    // Vaul's onOpenChange passes boolean, but our onClose expects event-like
    // Create a synthetic event for compatibility
    const syntheticEvent = {
      preventDefault: () => {},
    } as React.MouseEvent<HTMLButtonElement, MouseEvent>;
    onClose(syntheticEvent);
  };

  return (
    <Drawer.Root open={show} onOpenChange={(open) => !open && handleClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="modal-window" />
        <Drawer.Content
          className="vaul-drawer-content"
          aria-describedby={undefined}
        >
          <div className="vaul-drawer__handle-wrap">
            <Drawer.Handle className="vaul-drawer__handle" />
          </div>

          {/* Header Section */}
          {(title || headerContent) && (
            <div className="modal-header">
              {headerContent ? (
                headerContent
              ) : (
                <>
                  <Drawer.Title asChild>
                    <h3>{title}</h3>
                  </Drawer.Title>
                  <button
                    className="modal-close-btn"
                    onClick={handleClose}
                    type="button"
                    aria-label="Close"
                  >
                    <FiX />
                  </button>
                </>
              )}
            </div>
          )}

          {/* Top Content Section */}
          {topContent && <div className="modal-top-content">{topContent}</div>}

          {/* Main Body */}
          <div
            ref={drawerBodyRef}
            className={`modal-body ${keyboardVisible ? 'keyboard-visible' : ''}`}
          >
            {children}
          </div>

          {/* Footer Section */}
          {footer && <div className="modal-footer">{footer}</div>}

          {/* Close button for drawers without header */}
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
