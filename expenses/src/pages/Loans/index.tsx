import React, { useEffect, useState, useMemo } from 'react';
import { useAuthDispatch, useAuthState } from '@context/context';
import { useLoan } from '@context/loan';
import { useLocalization } from '@context/localization';
import { AuthState } from '@type/types';
import {
  fetchLoans,
  formatNumber,
  deleteLoan,
  transformDateFormat,
  transformToNumber,
} from '@utils/utils';
import { useNotification } from '@context/notification';
import { notificationType } from '@utils/constants';
import Paydown from '@utils/paydown-node';
import {
  PageHeader,
  LoadingSpinner,
  DeleteConfirmModal,
  NoData,
} from '@components/Common';
import { FiCreditCard, FiPlus, FiFilter } from 'react-icons/fi';
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
  const [loanFormSubmitting, setLoanFormSubmitting] = useState(false);
  const [loanFormEditSubmitting, setLoanFormEditSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { loans, loading, payments } = data;

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

  const calculateLoanProgress = (loan: any) => {
    const status = getLoanStatus(loan);

    // If completed, return 100%
    if (status === 'completed') return 100;

    // If pending, return 0%
    if (status === 'pending') return 0;

    // For active loans, calculate based on payments
    try {
      const [filteredData] =
        payments?.filter(
          (item: any) => item?.loanId === loan.id && item?.data?.length > 0
        ) || [];

      if (!filteredData || !filteredData.data) return 0;

      const loanPayments =
        filteredData?.data?.map((item: any) => {
          return {
            isSimulatedPayment: Number(item.fisp),
            date: transformDateFormat(item.fdt),
            ...(item.fr ? { rate: transformToNumber(item.fr) } : {}),
            ...(item.fpi
              ? { pay_installment: transformToNumber(item.fpi) }
              : {}),
            ...(item.fpsf
              ? { pay_single_fee: transformToNumber(item.fpsf) }
              : {}),
            ...(item.fnra
              ? { recurring_amount: transformToNumber(item.fnra) }
              : {}),
          };
        }) || [];

      const loanData = {
        start_date: transformDateFormat(loan.sdt),
        end_date: transformDateFormat(loan.edt),
        principal: transformToNumber(loan.fp),
        rate: transformToNumber(loan.fr),
        day_count_method: 'act/365' as const,
        ...(loan.fif
          ? {
              initial_fee: transformToNumber(loan.fif),
            }
          : {}),
        ...(loan.pdt && loan.frpd
          ? {
              recurring: {
                first_payment_date: transformDateFormat(loan.pdt),
                payment_day: transformToNumber(loan.frpd),
              },
            }
          : {}),
      };

      const amortizationSchedule: any[] = [];
      const calculator = Paydown();
      const paydown = calculator.calculate(
        loanData,
        loanPayments,
        amortizationSchedule
      );

      const totalPaidAmount = filteredData?.data?.reduce(
        (sum: number, item: any) => {
          return sum + parseFloat(item.fpi || '0');
        },
        0
      );

      const sumInstallments = paydown.sum_of_installments || 0;

      if (sumInstallments === 0) return 0;

      return ((totalPaidAmount ?? 0) / sumInstallments) * 100;
    } catch (err) {
      return 0;
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

  // Calculate stats based on filtered loans
  const totalLoans = filteredLoans?.length || 0;
  const activeLoans =
    filteredLoans?.filter((loan: any) => getLoanStatus(loan) === 'active')
      .length || 0;
  const completedLoans =
    filteredLoans?.filter((loan: any) => getLoanStatus(loan) === 'completed')
      .length || 0;

  if (loading) {
    return (
      <div className="page-container">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="page-container loans-page">
      {/* Header */}
      <PageHeader
        title={t('loans.title')}
        subtitle={`${totalLoans} ${totalLoans === 1 ? t('loans.loan') : t('loans.loans')}`}
      />

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
        <FiFilter className="filter-icon" />
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
          <NoData
            icon={<FiCreditCard />}
            title={t('loans.noLoans')}
            description={
              statusFilter !== 'all'
                ? `${t('loans.noLoansWithStatus')} "${getStatusText(statusFilter)}".`
                : t('loans.noLoansDesc')
            }
            action={
              statusFilter !== 'all'
                ? {
                    label: t('loans.showAllLoans'),
                    onClick: () => setStatusFilter('all'),
                  }
                : undefined
            }
          />
        ) : (
          <LoansList
            loans={filteredLoans}
            onEdit={handleEdit}
            onDelete={handleDelete}
            getStatus={getLoanStatus}
            getStatusText={getStatusText}
            getProgress={calculateLoanProgress}
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
        footer={
          <button
            type="submit"
            form="loan-form-add"
            disabled={loanFormSubmitting}
            className="btn-submit"
          >
            {loanFormSubmitting ? (
              <div className="loader">
                <span className="loader__element"></span>
                <span className="loader__element"></span>
                <span className="loader__element"></span>
              </div>
            ) : (
              t('common.add')
            )}
          </button>
        }
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
          hideSubmitButton={true}
          onFormReady={(submitHandler, isSubmitting) => {
            setLoanFormSubmitting(isSubmitting);
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
        footer={
          <button
            type="submit"
            form="loan-form-edit"
            disabled={loanFormEditSubmitting}
            className="btn-submit"
          >
            {loanFormEditSubmitting ? (
              <div className="loader">
                <span className="loader__element"></span>
                <span className="loader__element"></span>
                <span className="loader__element"></span>
              </div>
            ) : (
              t('common.save')
            )}
          </button>
        }
      >
        <LoanForm
          formType="edit"
          values={focusedItem}
          hideSubmitButton={true}
          onFormReady={(submitHandler, isSubmitting) => {
            setLoanFormEditSubmitting(isSubmitting);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            fetchLoans(token, dataDispatch, dispatch);
          }}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        show={showDeleteModal}
        onClose={(e) => {
          e.preventDefault();
          setShowDeleteModal(false);
        }}
        onConfirm={handleConfirmDelete}
        title={t('loan.deleteLoan')}
        message={t('modal.deleteLoanMessage')}
        isSubmitting={isSubmitting}
      />

      {/* Floating Action Button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fab"
        title={t('loans.addLoan')}
      >
        <FiPlus />
      </button>
    </div>
  );
};

export default Loans;
