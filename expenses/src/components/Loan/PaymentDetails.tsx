import React, { useRef, useState } from 'react';
import { useAuthDispatch, useAuthState } from '@context/context';
import { useNotification } from '@context/notification';
import { useLocalization } from '@context/localization';
import { AuthState } from '@type/types';
import useSwipeActions from '@hooks/useSwipeActions';
import {
  FiEdit2,
  FiTrash2,
  FiChevronDown,
  FiDollarSign,
  FiMove,
  FiArrowUp,
  FiArrowDown,
} from 'react-icons/fi';
import { deleteNode, fetchLoans, formatNumber, getLocale } from '@utils/utils';
import { notificationType } from '@utils/constants';
import Modal from '@components/Modal/Modal';
import PaymentForm from '@components/Loan/PaymentForm';
import { useLoan } from '@context/loan';
import './PaymentDetails.scss';

type SortField = 'date' | 'amount' | null;
type SortDirection = 'asc' | 'desc';

const PaymentDetails = (props) => {
  const payments = props?.payments ?? [];
  const loan = props?.loan ?? {};
  const listRef = useRef<any>(null);
  const showNotification = useNotification();
  const { t, language } = useLocalization();
  const [showEditModal, setShowEditModal] = useState(false);
  const [isNewModal, setIsNewModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentFormSubmitting, setPaymentFormSubmitting] = useState(false);
  const { dataDispatch } = useLoan();
  const { token } = useAuthState() as AuthState;
  const dispatch = useAuthDispatch();
  const [nrOfItemsToShow, setNrOfItemsToShow] = useState(10);
  const [deleteModalId, setDeleteModalId] = useState<string | false>(false);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    deleteVisible,
    editVisible,
    swipedItemId,
  } = useSwipeActions();

  const [focusedItem, setFocusedItem] = useState({
    nid: '',
    title: '',
    field_date: new Date().toISOString().slice(0, 10),
    field_rate: undefined as number | undefined,
    field_pay_installment: undefined as number | undefined,
    field_pay_single_fee: undefined as number | undefined,
    field_new_recurring_amount: undefined as number | undefined,
    field_is_simulated_payment: false,
  });

  const handleEdit = (nid: string) => {
    const item = payments?.find((item) => item.id === nid);
    setFocusedItem({
      nid: item.id,
      title: item.title,
      field_date: item.fdt,
      field_rate: item.fr ? Number(item.fr) : undefined,
      field_pay_installment: item.fpi ? Number(item.fpi) : undefined,
      field_pay_single_fee: item.fpsf ? Number(item.fpsf) : undefined,
      field_new_recurring_amount: item.fnra ? Number(item.fnra) : undefined,
      field_is_simulated_payment: Boolean(Number(item.fisp)),
    });
    setShowEditModal(true);
  };

  const handleDelete = (paymentId: string, token: string) => {
    setIsSubmitting(true);
    deleteNode(paymentId, token, (response) => {
      if (response.ok) {
        showNotification(
          t('notification.paymentDeleted'),
          notificationType.SUCCESS
        );
        setIsSubmitting(false);
      } else {
        showNotification(t('error.unknown'), notificationType.ERROR);
        setIsSubmitting(false);
      }
      setDeleteModalId(false);
      fetchLoans(token, dataDispatch, dispatch);
    });
  };

  const handleDeleteClick = (paymentId: string) => {
    setDeleteModalId(paymentId);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sort payments
  const sortedPayments = [...payments].sort((a, b) => {
    if (!sortField) {
      return new Date(b.fdt).getTime() - new Date(a.fdt).getTime();
    }

    if (sortField === 'date') {
      const dateA = new Date(a.fdt).getTime();
      const dateB = new Date(b.fdt).getTime();
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    }

    if (sortField === 'amount') {
      const amountA = parseFloat(a.fpi || '0');
      const amountB = parseFloat(b.fpi || '0');
      return sortDirection === 'asc' ? amountA - amountB : amountB - amountA;
    }

    return 0;
  });

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <FiMove />;
    return sortDirection === 'asc' ? <FiArrowUp /> : <FiArrowDown />;
  };

  return (
    <div className="payment-history">
      {/* Delete Modal */}
      <Modal
        show={!!deleteModalId}
        onClose={(e) => {
          e.preventDefault();
          setDeleteModalId(false);
        }}
        title={t('payment.deletePayment')}
      >
        <p
          style={{
            textAlign: 'center',
            color: 'rgba(255, 255, 255, 0.7)',
            marginBottom: '1.5rem',
          }}
        >
          {t('modal.deleteMessage')}
        </p>
        <button
          onClick={() => handleDelete(deleteModalId as string, token)}
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

      {/* Edit Modal */}
      <Modal
        show={showEditModal}
        onClose={(e) => {
          e.preventDefault();
          setShowEditModal(false);
          setIsNewModal(false);
        }}
        title={!isNewModal ? t('payment.editPayment') : t('payment.addPayment')}
        footer={
          <button
            type="submit"
            form={`payment-form-${!isNewModal ? 'edit' : 'add'}`}
            disabled={paymentFormSubmitting}
            className="btn-submit"
          >
            {paymentFormSubmitting ? (
              <div className="loader">
                <span className="loader__element"></span>
                <span className="loader__element"></span>
                <span className="loader__element"></span>
              </div>
            ) : !isNewModal ? (
              t('common.save')
            ) : (
              t('common.add')
            )}
          </button>
        }
      >
        <PaymentForm
          formType={!isNewModal ? 'edit' : 'add'}
          values={focusedItem}
          startDate={loan.sdt}
          endDate={loan.edt}
          hideSubmitButton={true}
          onFormReady={(submitHandler, isSubmitting) => {
            setPaymentFormSubmitting(isSubmitting);
          }}
          onSuccess={() => {
            setIsNewModal(false);
            setShowEditModal(false);
            fetchLoans(token, dataDispatch, dispatch);
          }}
        />
      </Modal>

      {/* Payment List */}
      {payments.length ? (
        <div className="payment-list-component" ref={listRef}>
          {/* Header with count */}
          <div className="payment-list-header">
            <p className="payment-count">
              {Math.min(nrOfItemsToShow, payments.length)} of {payments.length}{' '}
              payments
            </p>
          </div>

          {/* Sort Controls */}
          <div className="sort-controls">
            <button
              className={`sort-button ${sortField === 'date' ? 'active' : ''}`}
              onClick={() => handleSort('date')}
            >
              Date {getSortIcon('date')}
            </button>
            <button
              className={`sort-button ${sortField === 'amount' ? 'active' : ''}`}
              onClick={() => handleSort('amount')}
            >
              Amount {getSortIcon('amount')}
            </button>
          </div>

          {/* Payment Items */}
          <div className="payment-list-items">
            {sortedPayments.slice(0, nrOfItemsToShow).map((payment) => {
              const isSimulated = Number(payment.fisp) === 1;
              const date = new Date(payment.fdt);
              const day = date.getDate();
              // Use user's language for month formatting
              const locale = getLocale(language);
              const month = date
                .toLocaleDateString(locale, { month: 'short' })
                .toUpperCase();
              const year = date.getFullYear();

              const isThisItemSwiped = swipedItemId === payment.id;

              return (
                <div
                  key={payment.id}
                  className={`payment-item-wrapper ${isSimulated ? 'simulated' : ''}`}
                >
                  {/* Swipe Actions Background */}
                  <div
                    className={`swipe-actions-background ${isThisItemSwiped && (deleteVisible || editVisible) ? 'visible' : ''}`}
                  >
                    {isThisItemSwiped && deleteVisible && (
                      <div className="delete-action-bg">
                        <FiTrash2 />
                      </div>
                    )}
                    {isThisItemSwiped && editVisible && (
                      <div className="edit-action-bg">
                        <FiEdit2 />
                      </div>
                    )}
                  </div>

                  {/* Payment Item */}
                  <div
                    data-id={payment.id}
                    className="payment-list-item"
                    onTouchStart={(e) =>
                      handleTouchStart(e, payment.id, listRef)
                    }
                    onTouchMove={(e) => handleTouchMove(e, listRef)}
                    onTouchEnd={(e) =>
                      handleTouchEnd(
                        e,
                        listRef,
                        payment.id,
                        handleEdit,
                        handleDeleteClick
                      )
                    }
                  >
                    {/* Date Box */}
                    <div className="payment-date-box">
                      <div className="date-day">{day}</div>
                      <div className="date-month">{month}</div>
                      <div className="date-year">{year}</div>
                    </div>

                    {/* Content */}
                    <div className="payment-content">
                      <div className="payment-title">
                        {payment.title}
                        {isSimulated && (
                          <span className="simulated-badge">
                            {t('payment.simulated')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="payment-amount">
                      {formatNumber(payment.fpi)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More */}
          {payments.length > nrOfItemsToShow && (
            <div className="load-more">
              <button
                onClick={() => setNrOfItemsToShow(nrOfItemsToShow + 10)}
                className="load-more-btn"
              >
                <FiChevronDown />
                <span>
                  {t('common.loadMore')} ({payments.length - nrOfItemsToShow}{' '}
                  {t('common.remaining')})
                </span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="no-payments">
          <FiDollarSign />
          <h3>{t('payment.noPaymentsYet')}</h3>
          <p>{t('payment.noPaymentsDesc')}</p>
        </div>
      )}
    </div>
  );
};

export default PaymentDetails;
