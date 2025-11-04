import React, { ReactNode } from 'react';
import ReactModal from 'react-modal';
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
  const handleRequestClose = (
    event: React.MouseEvent | React.KeyboardEvent
  ) => {
    onClose(event as unknown as React.MouseEvent<HTMLButtonElement, MouseEvent>);
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
                <FaTimes />
              </button>
            </>
          )}
        </div>
      )}

      {/* Top Content Section */}
      {topContent && <div className="modal-top-content">{topContent}</div>}

      {/* Main Body */}
      <div className="modal-body">{children}</div>

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
          <FaTimes />
        </button>
      )}
    </ReactModal>
  );
};

export default Modal;
