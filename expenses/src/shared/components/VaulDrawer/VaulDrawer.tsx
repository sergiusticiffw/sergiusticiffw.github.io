import React, { ReactNode } from 'react';
import { Drawer } from 'vaul';
import { FiX } from 'react-icons/fi';

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
          className="vaul-drawer-content-fallback fixed left-0 right-0 bottom-0 z-[10000] mx-auto flex h-[75dvh] max-h-[75dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-2xl bg-[var(--color-app-bg)] outline-none max-[480px]:rounded-t-[14px]"
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

          {/* Body + form styles via Tailwind arbitrary variants */}
          <div
            className="modal-body flex flex-1 flex-col overflow-x-hidden overflow-y-auto overflow-touch px-5 py-5 max-[480px]:p-4 [&>*:last-child]:mb-20
              [&_.form-group]:mb-4 [&_.form-group]:flex [&_.form-group]:flex-col [&_.form-group]:gap-2
              [&_.form-group_label]:relative [&_.form-group_label]:pl-3 [&_.form-group_label]:text-sm [&_.form-group_label]:font-semibold [&_.form-group_label]:text-app-secondary
              [&_.form-group.required_label]:before:absolute [&_.form-group.required_label]:before:left-0 [&_.form-group.required_label]:before:top-1/2 [&_.form-group.required_label]:before:-translate-y-1/2 [&_.form-group.required_label]:before:content-['*'] [&_.form-group.required_label]:before:font-bold [&_.form-group.required_label]:before:text-[0.9rem] [&_.form-group.required_label]:before:text-[var(--color-error)]
              [&_.form-input]:min-h-12 [&_.form-input]:w-full [&_.form-input]:rounded-lg [&_.form-input]:border [&_.form-input]:border-[var(--color-input-border)] [&_.form-input]:bg-[var(--color-input-bg)] [&_.form-input]:px-3 [&_.form-input]:py-3 [&_.form-input]:text-base [&_.form-input]:text-app-primary [&_.form-input]:transition-[border-color,box-shadow] [&_.form-input]:outline-none
              [&_.form-input:focus]:border-[var(--color-app-accent)] [&_.form-input:focus]:shadow-[0_0_0_3px_var(--color-input-focus-ring)]
              [&_.form-textarea]:min-h-[90px] [&_.form-textarea]:resize-y [&_.form-textarea]:w-full [&_.form-textarea]:rounded-lg [&_.form-textarea]:border [&_.form-textarea]:border-[var(--color-input-border)] [&_.form-textarea]:bg-[var(--color-input-bg)] [&_.form-textarea]:px-3 [&_.form-textarea]:py-3 [&_.form-textarea]:text-base [&_.form-textarea]:text-app-primary [&_.form-textarea]:transition-[border-color,box-shadow] [&_.form-textarea]:outline-none
              [&_.form-textarea:focus]:border-[var(--color-app-accent)] [&_.form-textarea:focus]:shadow-[0_0_0_3px_var(--color-input-focus-ring)]
              [&_select.form-input]:min-h-12 [&_select.form-input]:w-full [&_select.form-input]:rounded-lg [&_select.form-input]:border [&_select.form-input]:border-[var(--color-input-border)] [&_select.form-input]:bg-[var(--color-input-bg)] [&_select.form-input]:px-3 [&_select.form-input]:py-3 [&_select.form-input]:text-base [&_select.form-input]:text-app-primary [&_select.form-input]:cursor-pointer [&_select.form-input]:outline-none
              [&_select.form-input:focus]:border-[var(--color-app-accent)] [&_select.form-input:focus]:shadow-[0_0_0_3px_var(--color-input-focus-ring)]"
          >
            {children}
          </div>

          {/* Footer + submit button styles via Tailwind */}
          {footer && (
            <div
              className="modal-footer sticky bottom-0 border-t border-app-subtle bg-[var(--color-app-bg)] px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-xl [-webkit-backdrop-filter:blur(10px)] max-[480px]:px-4 max-[480px]:py-3 max-[480px]:pb-[calc(0.9rem+env(safe-area-inset-bottom))]
                [&_.btn-submit]:inline-flex [&_.btn-submit]:min-h-12 [&_.btn-submit]:w-full [&_.btn-submit]:cursor-pointer [&_.btn-submit]:items-center [&_.btn-submit]:justify-center [&_.btn-submit]:gap-2 [&_.btn-submit]:rounded-lg [&_.btn-submit]:border-none [&_.btn-submit]:font-semibold [&_.btn-submit]:text-[0.95rem] [&_.btn-submit]:text-[var(--color-btn-on-accent)] [&_.btn-submit]:shadow-[0_4px_14px_var(--color-app-accent-shadow)] [&_.btn-submit]:transition-[transform,box-shadow]
                [&_.btn-submit]:bg-[linear-gradient(135deg,var(--color-app-accent),var(--color-app-accent-hover))]
                [&_.btn-submit:hover:not(:disabled)]:-translate-y-0.5 [&_.btn-submit:hover:not(:disabled)]:shadow-[0_6px_20px_var(--color-app-accent-shadow)]
                [&_.btn-submit:active:not(:disabled)]:translate-y-0 [&_.btn-submit:active:not(:disabled)]:shadow-[0_3px_10px_var(--color-app-accent-shadow)]
                [&_.btn-submit:disabled]:cursor-not-allowed [&_.btn-submit:disabled]:translate-y-0 [&_.btn-submit:disabled]:opacity-60 [&_.btn-submit:disabled]:shadow-none"
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
