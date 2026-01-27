import React from 'react';
import { Drawer } from 'vaul';
import { FiEdit2, FiX } from 'react-icons/fi';
import TransactionForm from './TransactionForm';
import { useLocalization } from '@context/localization';
import './EditTransactionDrawer.scss';

interface EditTransactionDrawerProps {
  open: boolean;
  onClose: () => void;
  values: any;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
}

const EditTransactionDrawer: React.FC<EditTransactionDrawerProps> = ({
  open,
  onClose,
  values,
  isSubmitting,
  setIsSubmitting,
}) => {
  const { t } = useLocalization();

  const handleClose = () => {
    onClose();
  };

  return (
    <Drawer.Root open={open} onOpenChange={(next) => !next && handleClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="modal-window" />
        <Drawer.Content className="edit-transaction-drawer">
          <div className="edit-transaction-drawer__handle-wrap">
            <Drawer.Handle className="edit-transaction-drawer__handle" />
          </div>

          <div className="modal-header">
            <Drawer.Title asChild>
              <h3>{t('transactionForm.editTransaction')}</h3>
            </Drawer.Title>
            <button
              className="modal-close-btn"
              onClick={handleClose}
              type="button"
              aria-label={t('common.close')}
            >
              <FiX />
            </button>
          </div>

          <div className="modal-body">
            <TransactionForm
              formType="edit"
              values={values}
              hideSubmitButton={true}
              onFormReady={(_submitHandler, submitting) => {
                setIsSubmitting(submitting);
              }}
              onSuccess={handleClose}
            />
          </div>

          <div className="modal-footer">
            <button
              type="submit"
              form="transaction-form-edit"
              disabled={isSubmitting}
              className="btn-submit"
            >
              {isSubmitting ? (
                <div className="loader">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              ) : (
                <>
                  <FiEdit2 />
                  <span>{t('transactionForm.editTitle')}</span>
                </>
              )}
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};

export default EditTransactionDrawer;

