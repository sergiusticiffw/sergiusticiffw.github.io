import React, { useEffect, useRef, ReactNode } from 'react';
import { MdClose } from 'react-icons/md';

interface ModalProps {
  show: boolean;
  onClose: (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
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
    document.addEventListener('mousedown', checkIfClickedOutside);
    return () => {
      document.removeEventListener('mousedown', checkIfClickedOutside);
    };
  }, [show, onClose]);

  return (
    <>
      {show ? (
        <div className="modal-window">
          <div ref={ref} className="modal-content">
            <a href="/" onClick={onClose} title="Close" className="modal-close">
              <MdClose />
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
