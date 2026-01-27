import React, { ReactNode, useEffect, useRef, useState } from 'react';
import ReactModal from 'react-modal';
import { FiX } from 'react-icons/fi';

interface ModalProps {
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

// Set app element for react-modal (for accessibility)
if (typeof window !== 'undefined' && document.getElementById('root')) {
  ReactModal.setAppElement('#root');
}

const Modal = ({
  show,
  onClose,
  children,
  title,
  headerContent,
  topContent,
  footer,
}: ModalProps) => {
  const modalBodyRef = useRef<HTMLDivElement>(null);
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
    if (!show || !modalBodyRef.current || !keyboardVisible) return;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        // Small delay to allow keyboard to appear
        setTimeout(() => {
          if (target && modalBodyRef.current) {
            // Scroll the input into view within the modal body
            const inputRect = target.getBoundingClientRect();
            const modalBodyRect = modalBodyRef.current.getBoundingClientRect();
            const footer =
              modalBodyRef.current.parentElement?.querySelector(
                '.modal-footer'
              );
            const footerHeight = footer
              ? footer.getBoundingClientRect().height
              : 0;

            // Check if input is below visible area (accounting for footer)
            if (inputRect.bottom > modalBodyRect.bottom - footerHeight) {
              // Scroll within modal-body to show the input
              const scrollOffset =
                inputRect.bottom - modalBodyRect.bottom + footerHeight + 20;
              modalBodyRef.current.scrollTop += scrollOffset;
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

  const handleRequestClose = (
    event: React.MouseEvent | React.KeyboardEvent
  ) => {
    onClose(
      event as unknown as React.MouseEvent<HTMLButtonElement, MouseEvent>
    );
  };

  return (
    <ReactModal
      isOpen={show}
      onRequestClose={handleRequestClose}
      className="modal-content"
      overlayClassName="modal-window"
      contentLabel={title || 'Modal'}
      shouldCloseOnOverlayClick={true}
      shouldCloseOnEsc={true}
    >
      {/* Header Section */}
      {(title || headerContent) && (
        <div className="modal-header">
          {headerContent ? (
            headerContent
          ) : (
            <>
              <h3>{title}</h3>
              <button
                className="modal-close-btn"
                onClick={handleRequestClose}
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
        ref={modalBodyRef}
        className={`modal-body ${keyboardVisible ? 'keyboard-visible' : ''}`}
      >
        {children}
      </div>

      {/* Footer Section */}
      {footer && <div className="modal-footer">{footer}</div>}

      {/* Close button for modals without header */}
      {!title && !headerContent && (
        <button
          className="modal-close"
          onClick={handleRequestClose}
          type="button"
          aria-label="Close"
        >
          <FiX />
        </button>
      )}
    </ReactModal>
  );
};

export default Modal;
