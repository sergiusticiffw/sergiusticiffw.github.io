import React from 'react';
import Modal from '@components/deprecated/Modal/Modal';
import { FiTrash2 } from 'react-icons/fi';
import { useLocalization } from '@context/localization';

interface DeleteConfirmModalProps {
  show: boolean;
  onClose: (e: React.MouseEvent) => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  isSubmitting?: boolean;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  show,
  onClose,
  onConfirm,
  title,
  message,
  isSubmitting = false,
}) => {
  const { t } = useLocalization();

  return (
    <Modal show={show} onClose={onClose} title={title}>
      <p
        style={{
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.7)',
          marginBottom: '1.5rem',
        }}
      >
        {message || t('modal.deleteMessage')}
      </p>
      <button
        onClick={onConfirm}
        className="button danger wide"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <div className="loader">
            <span className="loader__element"></span>
            <span className="loader__element"></span>
            <span className="loader__element"></span>
          </div>
        ) : (
          <>
            <FiTrash2 />
            {t('common.delete')}
          </>
        )}
      </button>
    </Modal>
  );
};

export default DeleteConfirmModal;
