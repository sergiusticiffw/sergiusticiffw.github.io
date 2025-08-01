import React, { useRef, useState } from 'react';
import { useAuthDispatch, useAuthState } from '@context/context';
import { useNotification } from '@context/notification';
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
          'Payment was successfully deleted.',
          notificationType.SUCCESS
        );
        setIsSubmitting(false);
      } else {
        showNotification('Something went wrong.', notificationType.ERROR);
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
  const totalAmount = payments.reduce(
    (sum, payment) => sum + parseFloat(payment.fpi || 0),
    0
  );
  const averagePayment = totalPayments > 0 ? totalAmount / totalPayments : 0;

  return (
    <div className="payment-history">
      {/* Payment Statistics Cards */}
      <div className="payment-stats">
        <div className="stat-card">
          <div className="stat-icon">
            <FaMoneyBillWave />
          </div>
          <div className="stat-content">
            <div className="stat-value">{formatNumber(totalAmount)}</div>
            <div className="stat-label">Total Paid</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <FaChartLine />
          </div>
          <div className="stat-content">
            <div className="stat-value">{totalPayments}</div>
            <div className="stat-label">Payments</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <FaCalendarAlt />
          </div>
          <div className="stat-content">
            <div className="stat-value">{formatNumber(averagePayment)}</div>
            <div className="stat-label">Average</div>
          </div>
        </div>
      </div>

      {/* Add Payment Button */}
      <div className="payment-actions">
        <button
          onClick={() => {
            setShowEditModal(true);
            setIsNewModal(true);
          }}
          className="add-payment-btn"
        >
          <FaPlus />
          <span>Add New Payment</span>
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
        <h3>Are you sure you want to delete this payment?</h3>
        <button
          onClick={() => handleDelete(deleteModalId as string, token)}
          className="button wide"
        >
          {isSubmitting ? (
            <div className="loader">
              <span className="loader__element"></span>
              <span className="loader__element"></span>
              <span className="loader__element"></span>
            </div>
          ) : (
            <FaTrash />
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
        <div className="payment-table-container">
          <div className="table-header">
            <h3>Payment History</h3>
            <div className="table-subtitle">
              Showing {Math.min(nrOfItemsToShow, payments.length)} of{' '}
              {payments.length} payments
            </div>
          </div>

          <div className="table-wrapper">
            <table
              className="expenses-table payment-table"
              cellSpacing="0"
              cellPadding="0"
            >
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Title</th>
                  <th>Installment</th>
                  <th className="desktop-only">Actions</th>
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
                      <td className="payment-date">
                        <div className="date-content">
                          <div className="date-day">
                            {new Date(payment.fdt).getDate()}
                          </div>
                          <div className="date-month">
                            {new Date(payment.fdt).toLocaleDateString('en-US', {
                              month: 'short',
                            })}
                          </div>
                        </div>
                      </td>
                      <td className="payment-title">
                        <div className="title-content">
                          <div className="title-text">{payment.title}</div>
                          {isSimulated && (
                            <span className="simulated-badge">Simulated</span>
                          )}
                        </div>
                      </td>
                      <td className="payment-amount">
                        <div className="amount-value">
                          {formatNumber(payment.fpi)}
                        </div>
                      </td>
                      <td className="desktop-only payment-actions-cell">
                        <div className="action-buttons">
                          <button
                            onClick={() => handleEdit(payment.id)}
                            className="btn-edit"
                            title="Edit Payment"
                          >
                            <FaPen />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(payment.id)}
                            className="btn-delete"
                            title="Delete Payment"
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
                    Load More ({payments.length - nrOfItemsToShow} remaining)
                  </span>
                </button>
              </div>
            )}

            {deleteVisible && (
              <div style={{ ...extraRowStyle }}>
                <div className="action delete">
                  <FaTrash />
                </div>
              </div>
            )}
            {editVisible && (
              <div style={{ ...extraRowStyle }}>
                <div className="action edit">
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
          <h3>No Payments Yet</h3>
          <p>Start by adding your first payment to track your loan progress.</p>
        </div>
      )}
    </div>
  );
};

export default PaymentDetails;
