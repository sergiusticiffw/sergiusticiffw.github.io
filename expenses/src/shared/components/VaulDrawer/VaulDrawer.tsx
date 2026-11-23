import React, { ReactNode, useRef, useState, useEffect } from 'react';
import { Drawer } from 'vaul';
import { FiX } from 'react-icons/fi';
import { useLocalization } from '@shared/context/localization';
import { FORM_SURFACE_CLASS } from '@shared/utils/layoutClasses';

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
  const { t } = useLocalization();
  const drawerBodyRef = useRef<HTMLDivElement>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  /* Clasa pe <html> pentru blocare scroll doar când drawer e deschis (permite refresh când e închis) */
  useEffect(() => {
    if (show) {
      document.documentElement.classList.add('vaul-drawer-open');
    } else {
      document.documentElement.classList.remove('vaul-drawer-open');
    }
    return () => document.documentElement.classList.remove('vaul-drawer-open');
  }, [show]);

  /* Când tastatura se închide: curăță height/bottom setate de Vaul ca drawer-ul să revină la 85dvh */
  useEffect(() => {
    if (!show || keyboardVisible) return;
    const raf = requestAnimationFrame(() => {
      document.querySelectorAll('[data-vaul-drawer]').forEach((el) => {
        (el as HTMLElement).style.removeProperty('height');
        (el as HTMLElement).style.removeProperty('bottom');
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [show, keyboardVisible]);

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
      repositionInputs={false}
    >
      <Drawer.Portal>
        {/* Overlay cu blur, exact ca în noul design */}
        <Drawer.Overlay className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-[6px] [-webkit-backdrop-filter:blur(6px)]" />

        <Drawer.Content
          className="vaul-drawer-content-fallback fixed left-0 right-0 bottom-0 z-[10000] mx-auto flex h-[85dvh] max-h-[94dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-2xl bg-[var(--color-app-bg)] outline-none transition-[height] duration-300 ease-in-out"
          style={
            keyboardVisible
              ? { height: 'calc(100dvh - 20px)', maxHeight: '94dvh' }
              : undefined
          }
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
                    aria-label={t('common.close')}
                    className="flex size-11 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-xl text-app-muted transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-[var(--color-app-accent)]"
                  >
                    <FiX aria-hidden="true" />
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
            className={`modal-body flex-1 overflow-y-auto px-5 py-5 max-[480px]:p-4 [&>*:last-child]:mb-20 ${FORM_SURFACE_CLASS}`}
          >
            {children}
          </div>

          {/* Footer Sticky */}
          {footer && (
            <div
              className="modal-footer sticky bottom-0 shrink-0 border-t border-app-subtle bg-[var(--color-app-bg)] px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-xl max-[480px]:px-4"
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
