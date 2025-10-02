import React, { useEffect, useState, useMemo } from 'react';
import { useAuthDispatch, useAuthState } from '@context/context';
import { useLoan } from '@context/loan';
import { useLocalization } from '@context/localization';
import { AuthState } from '@type/types';
import { fetchLoans, formatNumber, deleteLoan } from '@utils/utils';
import { useNotification } from '@context/notification';
import { notificationType } from '@utils/constants';
import {
  FaHandHoldingUsd,
  FaPlus,
  FaTrash,
  FaFilter,
} from 'react-icons/fa';
import Modal from '@components/Modal/Modal';
import LoanForm from '@components/Loan/LoanForm';
import LoansList from '@components/Loan/LoansList';
import './Loans.scss';

const Loans: React.FC = () => {
  const { data, dataDispatch } = useLoan();
  const { token } = useAuthState() as AuthState;
  const { t } = useLocalization();
  const dispatch = useAuthDispatch();
  const showNotification = useNotification();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [focusedItem, setFocusedItem] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { loans, loading } = data;

  useEffect(() => {
    if (!loans) {
      fetchLoans(token, dataDispatch, dispatch);
    }
  }, [loans, token, dataDispatch, dispatch]);

  const handleEdit = (id: string) => {
    const item = loans?.find((loan: any) => loan.id === id);
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

  const handleDelete = (id: string) => {
    const item = loans?.find((loan: any) => loan.id === id);
    setFocusedItem(item);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    setIsSubmitting(true);
    deleteLoan(focusedItem.id, token, dataDispatch, dispatch, () => {
      setIsSubmitting(false);
      setShowDeleteModal(false);
      showNotification(t('notification.loanDeleted'), notificationType.SUCCESS);
      fetchLoans(token, dataDispatch, dispatch);
    });
  };

  const getLoanStatus = (loan: any) => {
    if (loan.fls === 'completed') return 'completed';
    if (loan.fls === 'in_progress') return 'active';
    return 'pending';
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return t('common.completed');
      case 'active':
        return t('common.active');
      case 'pending':
        return t('common.pending');
      default:
        return t('common.status');
    }
  };

  // Filter loans
  const filteredLoans = useMemo(() => {
    if (!loans) return [];

    let filtered = loans;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = loans.filter(
        (loan: any) => getLoanStatus(loan) === statusFilter
      );
    }

    return filtered;
  }, [loans, statusFilter]);

  const totalLoans = loans?.length || 0;
  const activeLoans =
    loans?.filter((loan: any) => getLoanStatus(loan) === 'active').length || 0;
  const completedLoans =
    loans?.filter((loan: any) => getLoanStatus(loan) === 'completed').length ||
    0;

  if (loading) {
    return (
      <div className="loans-page">
        <div className="loans-loading">
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
    <div className="loans-page">
      {/* Header - same structure as NewHome */}
      <div className="loans-header">
        <h1>{t('loans.title')}</h1>
        <p className="transaction-count">{totalLoans} {totalLoans === 1 ? 'loan' : 'loans'}</p>
      </div>


      {/* Simple Stats */}
      <div className="loans-stats">
        <div className="stat-item">
          <span className="stat-value">{formatNumber(totalLoans)}</span>
          <span className="stat-label">{t('common.total')}</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{formatNumber(activeLoans)}</span>
          <span className="stat-label">{t('loans.active')}</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{formatNumber(completedLoans)}</span>
          <span className="stat-label">{t('common.completed')}</span>
        </div>
      </div>

      {/* Status Filter */}
      <div className="loans-filter">
        <FaFilter className="filter-icon" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">{t('loans.allStatuses')}</option>
          <option value="active">{t('loans.active')}</option>
          <option value="completed">{t('common.completed')}</option>
          <option value="pending">{t('loans.pending')}</option>
        </select>
      </div>

      {/* Loans List Section */}
      <div className="loans-table-section">
        {filteredLoans.length === 0 ? (
          <div className="no-loans">
            <FaHandHoldingUsd />
            <h3>{t('loans.noLoans')}</h3>
            <p>
              {statusFilter !== 'all'
                ? `${t('loans.noLoansWithStatus')} "${statusFilter}".`
                : t('loans.noLoansDesc')}
            </p>
            {statusFilter !== 'all' && (
              <button
                onClick={() => setStatusFilter('all')}
                className="action-btn"
              >
                {t('loans.showAllLoans')}
              </button>
            )}
          </div>
        ) : (
          <LoansList
            loans={filteredLoans}
            onEdit={handleEdit}
            onDelete={handleDelete}
            getStatus={getLoanStatus}
            getStatusText={getStatusText}
          />
        )}
      </div>

      {/* Add Loan Modal */}
      <Modal
        show={showAddModal}
        onClose={(e) => {
          e.preventDefault();
          setShowAddModal(false);
        }}
        title={t('loan.addLoan')}
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
        title={t('loan.editLoan')}
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
        title={t('loan.deleteLoan')}
      >
        <p
          style={{
            textAlign: 'center',
            color: 'rgba(255, 255, 255, 0.7)',
            marginBottom: '1.5rem',
          }}
        >
          {t('modal.deleteLoanMessage')}
        </p>
        <button
          onClick={handleConfirmDelete}
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
      
      {/* Floating Action Button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fab"
        title={t('loans.addLoan')}
      >
        <FaPlus />
      </button>
    </div>
  );
};

export default Loans;
