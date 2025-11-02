import React, { useEffect, useRef, ReactNode } from 'react';
import { FaTimes } from 'react-icons/fa';

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
}

const Modal = ({
  show,
  onClose,
  children,
  title,
  headerContent,
  topContent,
}: ModalProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const modalBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkIfClickedOutside = (e: MouseEvent) => {
      if (show && ref.current && !ref.current.contains(e.target as Node)) {
        onClose(
          e as unknown as React.MouseEvent<HTMLAnchorElement, MouseEvent>
        );
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (show && e.key === 'Escape') {
        onClose(e);
      }
    };

    // Auto-scroll to submit button when input receives focus on mobile
    const handleInputFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        // Only on mobile touch devices
        const isMobile = window.matchMedia('(max-width: 640px)').matches && 'ontouchstart' in window;
        if (isMobile) {
          // Wait for keyboard to fully open
          setTimeout(() => {
            const modalBody = modalBodyRef.current;
            if (modalBody) {
              const form = target.closest('form');
              if (form) {
                // Find submit button - try multiple selectors
                const submitButton = form.querySelector('button[type="submit"], .btn-submit, .form-actions-sticky button') as HTMLElement;
                if (submitButton && modalBody) {
                  // Get positions relative to viewport
                  const buttonRect = submitButton.getBoundingClientRect();
                  const bodyRect = modalBody.getBoundingClientRect();
                  const viewportHeight = window.innerHeight;
                  
                  // Check if button is below visible area (accounting for keyboard ~250px)
                  const visibleBottom = viewportHeight - 250; // Approximate keyboard height
                  
                  if (buttonRect.bottom > visibleBottom) {
                    // Calculate how much we need to scroll
                    const scrollAmount = buttonRect.bottom - visibleBottom + 120; // Extra padding
                    const currentScroll = modalBody.scrollTop;
                    
                    modalBody.scrollTo({
                      top: currentScroll + scrollAmount,
                      behavior: 'smooth',
                    });
                  }
                  
                  // Also try scrollIntoView as fallback
                  setTimeout(() => {
                    submitButton.scrollIntoView({
                      behavior: 'smooth',
                      block: 'end',
                      inline: 'nearest',
                    });
                  }, 100);
                }
              }
            }
          }, 400); // Wait a bit longer for keyboard animation
        }
      }
    };

    document.addEventListener('mousedown', checkIfClickedOutside);
    document.addEventListener('keydown', handleKeyDown);
    
    // Add focus listeners to all inputs in modal when it's shown
    if (show && ref.current) {
      const inputs = ref.current.querySelectorAll('input, textarea, select');
      inputs.forEach((input) => {
        input.addEventListener('focus', handleInputFocus);
      });
    }

    return () => {
      document.removeEventListener('mousedown', checkIfClickedOutside);
      document.removeEventListener('keydown', handleKeyDown);
      
      // Clean up focus listeners
      if (ref.current) {
        const inputs = ref.current.querySelectorAll('input, textarea, select');
        inputs.forEach((input) => {
          input.removeEventListener('focus', handleInputFocus);
        });
      }
    };
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div
      className="modal-window"
      onClick={onClose}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <div
        ref={ref}
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
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
                  onClick={onClose}
                  type="button"
                >
                  <FaTimes />
                </button>
              </>
            )}
          </div>
        )}

        {/* Top Content Section (for total, summary, etc.) */}
        {topContent && <div className="modal-top-content">{topContent}</div>}

        {/* Main Body */}
        <div ref={modalBodyRef} className="modal-body">{children}</div>

        {/* Close button for modals without header */}
        {!title && !headerContent && (
          <button className="modal-close" onClick={onClose} type="button">
            <FaTimes />
          </button>
        )}
      </div>
    </div>
  );
};

export default Modal;
