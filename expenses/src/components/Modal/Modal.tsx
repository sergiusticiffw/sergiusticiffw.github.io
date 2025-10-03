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

    document.addEventListener('mousedown', checkIfClickedOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', checkIfClickedOutside);
      document.removeEventListener('keydown', handleKeyDown);
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
        <div className="modal-body">{children}</div>

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
