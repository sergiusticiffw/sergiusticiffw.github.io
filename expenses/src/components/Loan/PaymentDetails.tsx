import React, { useRef, useState } from 'react';
import { useAuthDispatch, useAuthState } from '@context/context';
import { useNotification } from '@context/notification';
import { useLocalization } from '@context/localization';
import { AuthState } from '@type/types';
import useSwipeActions from '@hooks/useSwipeActions';
import {
  FaPen,
  FaTrash,
  FaCaretDown,
  FaMoneyBillWave,
  FaCalendarAlt,
  FaChartLine,
  FaPlus,
} from 'react-icons/fa';
import { deleteNode, fetchLoans, formatNumber } from '@utils/utils';
import { notificationType } from '@utils/constants';
import Modal from '@components/Modal/Modal';
import PaymentForm from '@components/Loan/PaymentForm';
import { useLoan } from '@context/loan';
import './PaymentDetails.scss';

const PaymentDetails = (props) => {
  const payments = props?.payments ?? [];
  const loan = props?.loan ?? {};
  const tableRef = useRef(null);
  const showNotification = useNotification();
  const { t } = useLocalization();
  const [showEditModal, setShowEditModal] = useState(false);
  const [isNewModal, setIsNewModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { dataDispatch } = useLoan();
  const { token } = useAuthState() as AuthState;
  const dispatch = useAuthDispatch();
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
  const [nrOfItemsToShow, setNrOfItemsToShow] = useState(6);
  const [deleteModalId, setDeleteModalId] = useState<string | false>(false);

  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    deleteVisible,
    editVisible,
    extraRowStyle,
  } = useSwipeActions();

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

  // Calculate payment statistics
  const totalPayments = payments.length;
  const totalPaymentsInstallment = payments?.filter((item) => item.fpi)?.length;
  const totalAmount = payments.reduce(
    (sum, payment) => sum + parseFloat(payment.fpi || 0),
    0
  );
  const averagePayment =
    totalPayments > 0 ? totalAmount / totalPaymentsInstallment : 0;

  return (
    <div className="payment-history">
      {/* Add Payment Button */}
      <div className="btns-actions">
        <button
          onClick={() => {
            setShowEditModal(true);
            setIsNewModal(true);
          }}
          className="action-btn"
        >
          <FaPlus />
          <span>{t('payment.addNewPayment')}</span>
        </button>
      </div>

      {/* Modals */}
      <Modal
        show={!!deleteModalId}
        onClose={(e) => {
          e.preventDefault();
          setDeleteModalId(false);
        }}
      >
                          <h3>{t('modal.deletePayment')}</h3>
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
              <FaTrash />
              {t('common.delete')}
            </>
          )}
        </button>
      </Modal>

      <Modal
        show={showEditModal}
        onClose={(e) => {
          e.preventDefault();
          setShowEditModal(false);
          setIsNewModal(false);
        }}
      >
        <PaymentForm
          formType={!isNewModal ? 'edit' : 'add'}
          values={focusedItem}
          startDate={loan.sdt}
          onSuccess={() => {
            setIsNewModal(false);
            setShowEditModal(false);
            fetchLoans(token, dataDispatch, dispatch);
          }}
        />
      </Modal>

      {/* Payment History Table */}
      {payments.length ? (
        <div className="income-table-container">
          <div className="table-header">
            <div className="table-subtitle">
              {t('payment.showingPayments')} {Math.min(nrOfItemsToShow, payments.length)} {t('payment.of')} {payments.length} {t('payment.payments')}
            </div>
          </div>

          <div className="table-wrapper">
            <table
              className="income-table payment-table"
              cellSpacing="0"
              cellPadding="0"
            >
              <thead>
                <tr>
                  <th>{t('common.date')}</th>
                  <th>{t('payment.title')}</th>
                  <th>{t('payment.installment')}</th>
                  <th className="desktop-only">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody ref={tableRef}>
                {payments?.slice(0, nrOfItemsToShow)?.map((payment, index) => {
                  const isSimulated = Number(payment.fisp) === 1;
                  return (
                    <tr
                      key={payment.id}
                      className={`transaction-item ${isSimulated ? 'simulated-payment' : ''}`}
                      data-id={payment.id}
                      onTouchStart={(e) =>
                        handleTouchStart(e, payment.id, tableRef)
                      }
                      onTouchMove={(e) => handleTouchMove(e, tableRef)}
                      onTouchEnd={(e) =>
                        handleTouchEnd(
                          e,
                          tableRef,
                          payment.id,
                          handleEdit,
                          handleDeleteClick
                        )
                      }
                    >
                      <td className="income-date">
                        <div className="date-content">
                          <div className="date-day">
                            {new Date(payment.fdt).getDate()}
                          </div>
                          <div className="date-month">
                            {new Date(payment.fdt).toLocaleDateString(
                              localStorage.getItem('language') === 'ro' ? 'ro-RO' : 'en-US', 
                              { month: 'short' }
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="income-description">
                        <div className="title-content">
                          <div className="title-text">{payment.title}</div>
                          {isSimulated && (
                            <span className="simulated-badge">{t('payment.simulated')}</span>
                          )}
                        </div>
                      </td>
                      <td className="income-amount">
                        <div className="amount-value">
                          {formatNumber(payment.fpi)}
                        </div>
                      </td>
                      <td className="desktop-only income-actions-cell">
                        <div className="action-buttons">
                          <button
                            onClick={() => handleEdit(payment.id)}
                            className="btn-edit"
                            title={t('payment.editPayment')}
                          >
                            <FaPen />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(payment.id)}
                            className="btn-delete"
                            title={t('payment.deletePayment')}
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {payments?.length > nrOfItemsToShow && (
              <div className="load-more">
                <button
                  onClick={() => setNrOfItemsToShow(nrOfItemsToShow + 6)}
                  className="load-more-btn"
                >
                  <FaCaretDown />
                  <span>
                    {t('common.loadMore')} ({payments.length - nrOfItemsToShow} {t('common.remaining')})
                  </span>
                </button>
              </div>
            )}

            {deleteVisible && (
              <div style={{ ...extraRowStyle }}>
                <div className="row-action delete">
                  <FaTrash />
                </div>
              </div>
            )}
            {editVisible && (
              <div style={{ ...extraRowStyle }}>
                <div className="row-action edit">
                  <FaPen />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="no-payments">
          <div className="no-payments-icon">
            <FaMoneyBillWave />
          </div>
          <h3>{t('payment.noPaymentsYet')}</h3>
          <p>{t('payment.noPaymentsDesc')}</p>
        </div>
      )}
    </div>
  );
};

export default PaymentDetails;
