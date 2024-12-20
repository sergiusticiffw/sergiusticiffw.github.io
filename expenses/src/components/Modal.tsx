import React, { useEffect, useRef, ReactNode } from 'react';
import { FaTimesCircle } from 'react-icons/fa';

interface ModalProps {
  show: boolean;
  onClose: (
    event?: React.MouseEvent<HTMLAnchorElement, MouseEvent> | KeyboardEvent
  ) => void;
  children: ReactNode;
}

const Modal = ({ show, onClose, children }: ModalProps) => {
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

  return (
    <>
      {show ? (
        <div className="modal-window">
          <div ref={ref} className="modal-content">
            <a href="/" onClick={onClose} title="Close" className="modal-close">
              <FaTimesCircle />
            </a>
            <div className="modal-body">{children}</div>
          </div>
        </div>
      ) : (
        ''
      )}
    </>
  );
};

export default Modal;
