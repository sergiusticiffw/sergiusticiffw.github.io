import React, { ReactNode } from 'react';
import { Drawer } from 'vaul';
import { FiX } from 'react-icons/fi';
import './VaulDrawer.css';

interface VaulDrawerProps {
  show: boolean;
  onClose: (event?: React.MouseEvent | { preventDefault: () => void }) => void;
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
  return (
    <Drawer.Root
      open={show}
      onOpenChange={(open) => {
        if (!open) onClose({ preventDefault: () => {} });
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="modal-window" />

        <Drawer.Content className="vaul-drawer-content">
          {/* Handle */}
          <div className="vaul-drawer__handle-wrap">
            <Drawer.Handle className="vaul-drawer__handle" />
          </div>

          {/* Header */}
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
                    onClick={onClose}
                    type="button"
                    aria-label="Close"
                  >
                    <FiX />
                  </button>
                </>
              )}
            </div>
          )}

          {/* Optional top content */}
          {topContent && <div className="modal-top-content">{topContent}</div>}

          {/* Body */}
          <div className="modal-body">{children}</div>

          {/* Footer */}
          {footer && <div className="modal-footer">{footer}</div>}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};

export default VaulDrawer;
