import React, { ReactNode, useRef, useState, useEffect } from 'react';
import { Drawer } from 'vaul';
import { FiX } from 'react-icons/fi';

interface VaulDrawerProps {
  show: boolean;
  onClose: (
    event?:
      | React.MouseEvent<HTMLAnchorElement | HTMLButtonElement, MouseEvent>
      | { preventDefault: () => void }
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

    const handleViewportChange = () => {
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        const isNowVisible = viewportHeight < windowHeight - 150;

        if (keyboardVisible && !isNowVisible) {
          // 1. Resetăm scroll-ul
          window.scrollTo(0, 0);

          // 2. FORȚĂM browserul să recalculeze dvh-ul
          // Trimitem un eveniment de resize fals care forțează CSS-ul să se actualizeze
          setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
          }, 100);
        }

        setKeyboardVisible(isNowVisible);
      }
    };

    window.visualViewport?.addEventListener('resize', handleViewportChange);
    return () =>
      window.visualViewport?.removeEventListener(
        'resize',
        handleViewportChange
      );
  }, [show, keyboardVisible]);

  // Scroll automat în interiorul drawer-ului când dai click pe un input
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
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, [show, keyboardVisible]);

  const handleClose = () => {
    onClose({ preventDefault: () => {} });
  };

  return (
    <Drawer.Root
      open={show}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <Drawer.Portal>
        {/* Overlay cu blur, exact ca în noul design */}
        <Drawer.Overlay className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-[6px] [-webkit-backdrop-filter:blur(6px)]" />

        <Drawer.Content
          className="fixed left-0 right-0 bottom-0 z-[10000] mx-auto flex flex-col overflow-hidden rounded-t-2xl bg-[var(--color-app-bg)] outline-none transition-[height] duration-300 ease-in-out"
          style={{
            height: keyboardVisible ? 'calc(100dvh - 20px)' : '75dvh',
            maxHeight: '94dvh',
            width: '100%',
            maxWidth: '640px',
          }}
        >
          {/* Handle bar */}
          <div className="flex shrink-0 justify-center py-2">
            <Drawer.Handle className="h-[5px] w-[42px] rounded-full bg-white/25" />
          </div>

          {/* Header */}
          {(title || headerContent) && (
            <div className="flex shrink-0 items-center justify-between border-b border-app-subtle px-5 py-4">
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
                    onClick={handleClose}
                    className="cursor-pointer rounded-full border-none bg-transparent p-2 text-xl text-app-muted transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <FiX />
                  </button>
                </>
              )}
            </div>
          )}

          {/* Top Content */}
          {topContent && (
            <div className="shrink-0 bg-app-surface px-5 py-4 text-app-secondary text-[0.95rem]">
              {topContent}
            </div>
          )}

          {/* Body cu scroll și clasele tale de Tailwind */}
          <div
            ref={drawerBodyRef}
            className="modal-body flex-1 overflow-y-auto px-5 py-5 max-[480px]:p-4
              [&>*:last-child]:mb-20
              [&_.form-group]:mb-4 [&_.form-group]:flex [&_.form-group]:flex-col [&_.form-group]:gap-2
              [&_.form-group_label]:relative [&_.form-group_label]:pl-3 [&_.form-group_label]:text-sm [&_.form-group_label]:font-semibold [&_.form-group_label]:text-app-secondary
              [&_.form-group.required_label]:before:absolute [&_.form-group.required_label]:before:left-0 [&_.form-group.required_label]:before:top-1/2 [&_.form-group.required_label]:before:-translate-y-1/2 [&_.form-group.required_label]:before:content-['*'] [&_.form-group.required_label]:before:font-bold [&_.form-group.required_label]:before:text-[0.9rem] [&_.form-group.required_label]:before:text-[var(--color-error)]
              [&_.form-input]:min-h-12 [&_.form-input]:w-full [&_.form-input]:rounded-lg [&_.form-input]:border [&_.form-input]:border-[var(--color-input-border)] [&_.form-input]:bg-[var(--color-input-bg)] [&_.form-input]:px-3 [&_.form-input]:py-3 [&_.form-input]:text-base [&_.form-input]:text-app-primary [&_.form-input]:outline-none
              [&_.form-textarea]:min-h-[90px] [&_.form-textarea]:w-full [&_.form-textarea]:rounded-lg [&_.form-textarea]:border [&_.form-textarea]:border-[var(--color-input-border)] [&_.form-textarea]:bg-[var(--color-input-bg)] [&_.form-textarea]:px-3 [&_.form-textarea]:py-3 [&_.form-textarea]:text-base [&_.form-textarea]:text-app-primary [&_.form-textarea]:outline-none"
          >
            {children}
          </div>

          {/* Footer Sticky */}
          {footer && (
            <div
              className="modal-footer sticky bottom-0 shrink-0 border-t border-app-subtle bg-[var(--color-app-bg)] px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-xl max-[480px]:px-4
                [&_.btn-submit]:inline-flex [&_.btn-submit]:min-h-12 [&_.btn-submit]:w-full [&_.btn-submit]:cursor-pointer [&_.btn-submit]:items-center [&_.btn-submit]:justify-center [&_.btn-submit]:rounded-lg [&_.btn-submit]:font-semibold [&_.btn-submit]:text-[var(--color-btn-on-accent)]
                [&_.btn-submit]:bg-[linear-gradient(135deg,var(--color-app-accent),var(--color-app-accent-hover))]"
            >
              {footer}
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};

export default VaulDrawer;
