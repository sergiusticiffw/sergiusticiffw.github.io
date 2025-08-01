import React, { useEffect, useState } from 'react';
import { useAuthDispatch, useAuthState } from '@context/context';
import { useLoan } from '@context/loan';
import { AuthState } from '@type/types';
import { fetchLoans, formatNumber } from '@utils/utils';
import {
  FaHandHoldingUsd,
  FaPlus,
  FaPen,
  FaTrash,
  FaChartLine,
  FaCalendarAlt,
  FaMoneyBillWave,
  FaExternalLinkAlt,
} from 'react-icons/fa';
import Modal from '@components/Modal/Modal';
import LoanForm from '@components/Loan/LoanForm';
import { Link } from 'react-router-dom';
import './Loans.scss';

const Loans: React.FC = () => {
  const { data, dataDispatch } = useLoan();
  const { token } = useAuthState() as AuthState;
  const dispatch = useAuthDispatch();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [focusedItem, setFocusedItem] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { loans, loading } = data;

  useEffect(() => {
    if (!loans) {
      fetchLoans(token, dataDispatch, dispatch);
    }
  }, [loans, token, dataDispatch, dispatch]);

  const handleEdit = (item: any) => {
    setFocusedItem({
      nid: item.id,
      title: item.title,
      field_principal: item.fp,
      field_start_date: item.sdt,
      field_end_date: item.edt,
      field_rate: item.fr,
      field_initial_fee: item.fif,
      field_rec_first_payment_date: item.pdt,
      field_recurring_payment_day: item.frpd,
      field_loan_status: item.fls,
    });
    setShowEditModal(true);
  };

  const handleDelete = (item: any) => {
    setFocusedItem(item);
    setShowDeleteModal(true);
  };

  const getLoanStatus = (loan: any) => {
    if (loan.fls === 'completed') return 'completed';
    if (loan.fls === 'in_progress') return 'active';
    return 'pending';
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'active':
        return 'Active';
      case 'pending':
        return 'Pending';
      default:
        return 'Unknown';
    }
  };

  const totalLoans = loans?.length || 0;
  const activeLoans =
    loans?.filter((loan: any) => getLoanStatus(loan) === 'active').length || 0;
  const completedLoans =
    loans?.filter((loan: any) => getLoanStatus(loan) === 'completed').length ||
    0;
  const totalPrincipal =
    loans?.reduce(
      (sum: number, loan: any) => sum + parseFloat(loan.fp || '0'),
      0
    ) || 0;

  if (loading) {
    return (
      <div className="loans-container">
        <div className="loading-container">
          <div className="loader">
            <span className="loader__element"></span>
            <span className="loader__element"></span>
            <span className="loader__element"></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="loans-container">
      {/* Header Section */}
      <div className="loans-header">
        <div className="header-icon">
          <FaHandHoldingUsd />
        </div>
        <h1 className="header-title">Loan Management</h1>
        <p className="header-subtitle">
          Track and manage your loans efficiently
        </p>
      </div>

      {/* Actions Section */}
      <div className="loans-actions">
        <button onClick={() => setShowAddModal(true)} className="action-btn">
          <FaPlus />
          Add New Loan
        </button>
      </div>

      {/* Summary Section */}
      <div className="loans-summary">
        <div className="summary-header">
          <FaChartLine />
          <h3>Loans Overview</h3>
        </div>
        <div className="summary-grid">
          <div className="summary-item">
            <div className="summary-value">{totalLoans}</div>
            <div className="summary-label">Total Loans</div>
          </div>
          <div className="summary-item">
            <div className="summary-value">{activeLoans}</div>
            <div className="summary-label">Active Loans</div>
          </div>
          <div className="summary-item">
            <div className="summary-value">{completedLoans}</div>
            <div className="summary-label">Completed</div>
          </div>
        </div>
      </div>

      {/* Loans Grid */}
      <div className="loans-grid">
        {loans?.map((loan: any) => {
          const status = getLoanStatus(loan);

          return (
            <div key={loan.id} className="loan-card">
              <div className="loan-header">
                <h3 className="loan-title">
                  <Link to={`/expenses/loan/${loan.id}`} className="loan-link">
                    {loan.title}
                    <FaExternalLinkAlt className="link-icon" />
                  </Link>
                </h3>
                <div className="loan-actions">
                  <button
                    onClick={() => handleEdit(loan)}
                    className="btn-icon"
                    title="Edit Loan"
                  >
                    <FaPen />
                  </button>
                  <button
                    onClick={() => handleDelete(loan)}
                    className="btn-icon"
                    title="Delete Loan"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>

              <div className="loan-details">
                <div className="detail-item">
                  <div className="detail-label">Principal</div>
                  <div className="detail-value">{formatNumber(loan.fp)}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Interest Rate</div>
                  <div className="detail-value">{loan.fr}%</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Start Date</div>
                  <div className="detail-value">{loan.sdt}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">End Date</div>
                  <div className="detail-value">{loan.edt}</div>
                </div>
              </div>

              <div className="loan-status">
                <span className={`status-badge ${status}`}>
                  {getStatusText(status)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Loan Modal */}
      <Modal
        show={showAddModal}
        onClose={(e) => {
          e.preventDefault();
          setShowAddModal(false);
        }}
      >
        <LoanForm
          formType="add"
          values={{
            nid: '',
            title: '',
            field_principal: 0,
            field_start_date: '',
            field_end_date: '',
            field_rate: 0,
            field_initial_fee: 0,
            field_rec_first_payment_date: '',
            field_recurring_payment_day: 0,
          }}
          onSuccess={() => {
            setShowAddModal(false);
            fetchLoans(token, dataDispatch, dispatch);
          }}
        />
      </Modal>

      {/* Edit Loan Modal */}
      <Modal
        show={showEditModal}
        onClose={(e) => {
          e.preventDefault();
          setShowEditModal(false);
        }}
      >
        <LoanForm
          formType="edit"
          values={focusedItem}
          onSuccess={() => {
            setShowEditModal(false);
            fetchLoans(token, dataDispatch, dispatch);
          }}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        show={showDeleteModal}
        onClose={(e) => {
          e.preventDefault();
          setShowDeleteModal(false);
        }}
      >
        <div className="delete-confirmation">
          <h3>Delete Loan</h3>
          <p>
            Are you sure you want to delete "{focusedItem.title}"? This action
            cannot be undone.
          </p>
          <div className="modal-actions">
            <button
              onClick={() => {
                // Handle delete logic here
                setShowDeleteModal(false);
                fetchLoans(token, dataDispatch, dispatch);
              }}
              className="button danger"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="loader">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              ) : (
                <FaTrash />
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Loans;
