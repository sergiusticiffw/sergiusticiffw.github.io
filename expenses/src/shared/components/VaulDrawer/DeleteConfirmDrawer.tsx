import React from 'react';
import { Drawer } from 'vaul';
import { FiTrash2, FiX } from 'react-icons/fi';
import { useLocalization } from '@shared/context/localization';

interface DeleteConfirmDrawerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  isSubmitting?: boolean;
}

const DeleteConfirmDrawer: React.FC<DeleteConfirmDrawerProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  isSubmitting = false,
}) => {
  const { t } = useLocalization();

  return (
    <Drawer.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-[4px] z-[9999]" />
        <Drawer.Content
          className="fixed left-0 right-0 bottom-0 z-[10000] bg-[rgba(26,26,26,0.98)] rounded-t-2xl shadow-[0_-8px_32px_rgba(0,0,0,0.5)] p-2 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom,0))] max-h-[min(85svh,520px)] overflow-auto outline-none"
          aria-label={title}
        >
          <div className="flex justify-center pt-1.5 pb-2">
            <Drawer.Handle className="w-12 h-1.5 rounded-full bg-white/[0.18]" />
          </div>

          <div className="flex items-center justify-between gap-3 px-2 pt-2 pb-1">
            <Drawer.Title className="m-0 text-white text-[1.05rem] font-semibold text-left">
              {title}
            </Drawer.Title>
            <button
              type="button"
              className="border-none bg-transparent text-white/70 p-1.5 rounded-full inline-flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onClose}
              aria-label={t('common.close') || 'Close'}
              disabled={isSubmitting}
            >
              <FiX />
            </button>
          </div>

          <Drawer.Description className="my-1.5 mx-0 mb-4 px-1 text-white/70 text-[0.95rem] leading-snug text-left">
            {message ||
              t('modal.deleteMessage') ||
              t('modal.deleteTransaction')}
          </Drawer.Description>

          <div className="grid grid-cols-2 gap-3 p-1 max-[520px]:grid-cols-1">
            <button
              type="button"
              className="w-full border-none rounded-[10px] py-3.5 px-4 min-h-12 text-[0.95rem] font-semibold cursor-pointer inline-flex items-center justify-center gap-2 transition-all duration-150 select-none [-webkit-tap-highlight-color:transparent] bg-white/[0.08] border border-white/[0.12] text-white active:not(:disabled):translate-y-px disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </button>

            <button
              type="button"
              className="w-full border-none rounded-[10px] py-3.5 px-4 min-h-12 text-[0.95rem] font-semibold cursor-pointer inline-flex items-center justify-center gap-2 transition-all duration-150 select-none [-webkit-tap-highlight-color:transparent] bg-gradient-to-br from-red-500 to-red-600 text-white active:not(:disabled):translate-y-px disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
              onClick={onConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="inline-flex gap-1" aria-label="Loading">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-white animate-[loader-bounce_1.4s_ease-in-out_infinite_both]"
                    style={{ animationDelay: '-0.32s' }}
                  />
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-white animate-[loader-bounce_1.4s_ease-in-out_infinite_both]"
                    style={{ animationDelay: '-0.16s' }}
                  />
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-[loader-bounce_1.4s_ease-in-out_infinite_both]" />
                </div>
              ) : (
                <>
                  <FiTrash2 />
                  {t('common.delete')}
                </>
              )}
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};

export default DeleteConfirmDrawer;
