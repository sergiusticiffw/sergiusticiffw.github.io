import React from 'react';
import { Drawer } from 'vaul';
import { FiTrash2, FiX } from 'react-icons/fi';
import { useLocalization } from '@context/localization';
import './DeleteConfirmDrawer.scss';

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
        <Drawer.Overlay className="delete-drawer__overlay" />
        <Drawer.Content className="delete-drawer__content" aria-label={title}>
          <div className="delete-drawer__handle-wrap">
            <Drawer.Handle className="delete-drawer__handle" />
          </div>

          <div className="delete-drawer__header">
            <Drawer.Title className="delete-drawer__title">{title}</Drawer.Title>
            <button
              type="button"
              className="delete-drawer__close"
              onClick={onClose}
              aria-label={t('common.close') || 'Close'}
              disabled={isSubmitting}
            >
              <FiX />
            </button>
          </div>

          <Drawer.Description className="delete-drawer__description">
            {message || t('modal.deleteMessage') || t('modal.deleteTransaction')}
          </Drawer.Description>

          <div className="delete-drawer__actions">
            <button
              type="button"
              className="delete-drawer__btn delete-drawer__btn--cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </button>

            <button
              type="button"
              className="delete-drawer__btn delete-drawer__btn--danger"
              onClick={onConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="delete-drawer__loader" aria-label="Loading">
                  <span className="delete-drawer__loaderDot" />
                  <span className="delete-drawer__loaderDot" />
                  <span className="delete-drawer__loaderDot" />
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

