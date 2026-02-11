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
        <Drawer.Overlay
          className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-[6px] [-webkit-backdrop-filter:blur(6px)]"
        />

        <Drawer.Content
          className="fixed left-0 right-0 bottom-0 z-[10000] mx-auto flex w-full max-w-[640px] flex-col overflow-hidden rounded-t-2xl outline-none h-[75dvh] max-h-[75dvh] bg-[var(--color-app-bg)] max-[480px]:rounded-t-[14px] vaul-drawer-content-fallback"
        >
          {/* Handle */}
          <div className="flex justify-center py-2">
            <Drawer.Handle className="h-[5px] w-[42px] rounded-full bg-white/25" />
          </div>

          {/* Header */}
          {(title || headerContent) && (
            <div className="flex items-center justify-between border-b border-app-subtle px-5 py-4">
              {headerContent ? (
                headerContent
              ) : (
                <>
                  <Drawer.Title asChild>
                    <h3 className="m-0 text-base font-semibold text-app-primary">
                      {title}
                    </h3>
                  </Drawer.Title>

                  <button
                    type="button"
                    aria-label="Close"
                    onClick={onClose}
                    className="cursor-pointer rounded-full border-none bg-transparent p-2 text-xl text-app-muted transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <FiX />
                  </button>
                </>
              )}
            </div>
          )}

          {/* Optional top content */}
          {topContent && (
            <div className="bg-app-surface px-5 py-4 text-app-secondary text-[0.95rem]">
              {topContent}
            </div>
          )}

          {/* Body */}
          <div className="modal-body flex flex-1 flex-col overflow-x-hidden overflow-y-auto px-5 py-5 overflow-touch max-[480px]:p-4 [&>*:last-child]:mb-20">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="modal-footer sticky bottom-0 border-t border-app-subtle bg-[var(--color-app-bg)] px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-xl [-webkit-backdrop-filter:blur(10px)] max-[480px]:px-4 max-[480px]:py-3 max-[480px]:pb-[calc(0.9rem+env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};

export default VaulDrawer;
