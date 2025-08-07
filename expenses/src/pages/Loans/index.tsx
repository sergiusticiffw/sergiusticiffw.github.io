import React, { useEffect, useState, useMemo } from 'react';
import { useAuthDispatch, useAuthState } from '@context/context';
import { useLoan } from '@context/loan';
import { AuthState } from '@type/types';
import { fetchLoans, formatNumber, deleteLoan } from '@utils/utils';
import { useNotification } from '@context/notification';
import { notificationType } from '@utils/constants';
import {
  FaHandHoldingUsd,
  FaPlus,
  FaPen,
  FaTrash,
  FaChartLine,
  FaExternalLinkAlt,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaFilter,
  FaMoneyBillWave,
  FaPercentage,
  FaCalendarAlt,
} from 'react-icons/fa';
import Modal from '@components/Modal/Modal';
import LoanForm from '@components/Loan/LoanForm';
import { Link } from 'react-router-dom';
import './Loans.scss';

const Loans: React.FC = () => {
  const { data, dataDispatch } = useLoan();
  const { token } = useAuthState() as AuthState;
  const dispatch = useAuthDispatch();
  const showNotification = useNotification();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [focusedItem, setFocusedItem] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sortBy, setSortBy] = useState<
    'status' | 'title' | 'principal' | 'date'
  >('status');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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

  const handleConfirmDelete = () => {
    setIsSubmitting(true);
    deleteLoan(focusedItem.id, token, dataDispatch, dispatch, () => {
      setIsSubmitting(false);
      setShowDeleteModal(false);
      showNotification('Loan deleted successfully!', notificationType.SUCCESS);
      fetchLoans(token, dataDispatch, dispatch);
    });
  };

  const handleSort = (field: 'status' | 'title' | 'principal' | 'date') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: 'status' | 'title' | 'principal' | 'date') => {
    if (sortBy !== field) return <FaSort />;
    return sortOrder === 'asc' ? <FaSortUp /> : <FaSortDown />;
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

  // Filter and sort loans
  const filteredAndSortedLoans = useMemo(() => {
    if (!loans) return [];

    let filtered = loans;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = loans.filter(
        (loan: any) => getLoanStatus(loan) === statusFilter
      );
    }

    // Apply sorting
    filtered.sort((a: any, b: any) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'status':
          aValue = getLoanStatus(a);
          bValue = getLoanStatus(b);
          break;
        case 'title':
          aValue = a.title?.toLowerCase() || '';
          bValue = b.title?.toLowerCase() || '';
          break;
        case 'principal':
          aValue = parseFloat(a.fp || '0');
          bValue = parseFloat(b.fp || '0');
          break;
        case 'date':
          aValue = new Date(a.sdt || '');
          bValue = new Date(b.sdt || '');
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [loans, sortBy, sortOrder, statusFilter]);

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
      <div className="loans-container page-transition">
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
    <div className="loans-container page-transition">
      {/* Enhanced Header Section */}
      <div className="loans-header glass-card floating">
        <div className="header-content">
          <div className="header-icon glow-effect">
            <FaHandHoldingUsd />
          </div>
          <div className="header-text">
            <h1 className="header-title gradient-text">Loan Management</h1>
            <p className="header-subtitle">
              Track and manage your loans with advanced insights
            </p>
          </div>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowAddModal(true)} 
            className="action-btn glow-effect"
          >
            <FaPlus />
            Add New Loan
          </button>
        </div>
      </div>

      {/* Enhanced Summary Section */}
      <div className="loans-summary glass-card">
        <div className="summary-header">
          <FaChartLine className="summary-icon" />
          <h3 className="gradient-text">Portfolio Overview</h3>
        </div>
        
        <div className="summary-grid">
          <div className="summary-item glass-morphism glow-border">
            <div className="summary-icon-wrapper">
              <FaHandHoldingUsd />
            </div>
            <div className="summary-content">
              <div className="summary-value gradient-text">{totalLoans}</div>
              <div className="summary-label">Total Loans</div>
            </div>
          </div>
          
          <div className="summary-item glass-morphism glow-border">
            <div className="summary-icon-wrapper active">
              <FaMoneyBillWave />
            </div>
            <div className="summary-content">
              <div className="summary-value gradient-text">{activeLoans}</div>
              <div className="summary-label">Active Loans</div>
            </div>
          </div>
          
          <div className="summary-item glass-morphism glow-border">
            <div className="summary-icon-wrapper completed">
              <FaChartLine />
            </div>
            <div className="summary-content">
              <div className="summary-value gradient-text">{completedLoans}</div>
              <div className="summary-label">Completed</div>
            </div>
          </div>
          
          <div className="summary-item glass-morphism glow-border">
            <div className="summary-icon-wrapper total">
              <FaPercentage />
            </div>
            <div className="summary-content">
              <div className="summary-value gradient-text">{formatNumber(totalPrincipal)}</div>
              <div className="summary-label">Total Principal</div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Filters Section */}
      <div className="loans-filters glass-card">
        <div className="filter-group">
          <label className="filter-label">
            <FaFilter />
            Filter by Status:
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select glass-morphism"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        <div className="sort-group">
          <span className="sort-label">Sort by:</span>
          <div className="sort-buttons">
            <button
              onClick={() => handleSort('status')}
              className={`sort-btn glass-morphism ${sortBy === 'status' ? 'active' : ''}`}
              title="Sort by Status"
            >
              Status {getSortIcon('status')}
            </button>
            <button
              onClick={() => handleSort('title')}
              className={`sort-btn glass-morphism ${sortBy === 'title' ? 'active' : ''}`}
              title="Sort by Title"
            >
              Title {getSortIcon('title')}
            </button>
            <button
              onClick={() => handleSort('principal')}
              className={`sort-btn glass-morphism ${sortBy === 'principal' ? 'active' : ''}`}
              title="Sort by Principal"
            >
              Principal {getSortIcon('principal')}
            </button>
            <button
              onClick={() => handleSort('date')}
              className={`sort-btn glass-morphism ${sortBy === 'date' ? 'active' : ''}`}
              title="Sort by Start Date"
            >
              Date {getSortIcon('date')}
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Loans Grid */}
      <div className="loans-grid">
        {filteredAndSortedLoans.length === 0 ? (
          <div className="no-loans glass-card">
            <div className="no-loans-icon glow-effect">
              <FaHandHoldingUsd />
            </div>
            <h3 className="gradient-text">No loans found</h3>
            <p>
              {statusFilter !== 'all'
                ? `No loans with "${statusFilter}" status found.`
                : 'No loans available. Add your first loan to get started!'}
            </p>
            {statusFilter !== 'all' && (
              <button
                onClick={() => setStatusFilter('all')}
                className="action-btn glow-effect"
              >
                Show All Loans
              </button>
            )}
          </div>
        ) : (
          filteredAndSortedLoans.map((loan: any) => {
            const status = getLoanStatus(loan);

            return (
              <div key={loan.id} className="loan-card glass-morphism glow-border">
                <div className="loan-header">
                  <h3 className="loan-title">
                    <Link
                      to={`/expenses/loan/${loan.id}`}
                      className="loan-link gradient-text"
                      title={loan.title}
                    >
                      {loan.title}
                      <FaExternalLinkAlt className="link-icon" />
                    </Link>
                  </h3>
                  <div className="loan-actions">
                    <button
                      onClick={() => handleEdit(loan)}
                      className="btn-icon glass-morphism glow-effect"
                      title="Edit Loan"
                    >
                      <FaPen />
                    </button>
                    <button
                      onClick={() => handleDelete(loan)}
                      className="btn-icon glass-morphism glow-effect danger"
                      title="Delete Loan"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>

                <div className="loan-details">
                  <div className="detail-item">
                    <div className="detail-icon">
                      <FaMoneyBillWave />
                    </div>
                    <div className="detail-content">
                      <div className="detail-label">Principal</div>
                      <div className="detail-value gradient-text">{formatNumber(loan.fp)}</div>
                    </div>
                  </div>
                  
                  <div className="detail-item">
                    <div className="detail-icon">
                      <FaPercentage />
                    </div>
                    <div className="detail-content">
                      <div className="detail-label">Interest Rate</div>
                      <div className="detail-value gradient-text">{loan.fr}%</div>
                    </div>
                  </div>
                  
                  <div className="detail-item">
                    <div className="detail-icon">
                      <FaCalendarAlt />
                    </div>
                    <div className="detail-content">
                      <div className="detail-label">Duration</div>
                      <div className="detail-value">{loan.sdt} - {loan.edt}</div>
                    </div>
                  </div>
                </div>

                <div className="loan-status">
                  <span className={`status-badge glass-morphism ${status}`}>
                    {getStatusText(status)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Enhanced Modals */}
      <Modal
        show={showAddModal}
        onClose={(e) => {
          e.preventDefault();
          setShowAddModal(false);
        }}
      >
        <div className="glass-card">
          <h3 className="gradient-text">Add New Loan</h3>
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
        </div>
      </Modal>

      <Modal
        show={showEditModal}
        onClose={(e) => {
          e.preventDefault();
          setShowEditModal(false);
        }}
      >
        <div className="glass-card">
          <h3 className="gradient-text">Edit Loan</h3>
          <LoanForm
            formType="edit"
            values={focusedItem}
            onSuccess={() => {
              setShowEditModal(false);
              fetchLoans(token, dataDispatch, dispatch);
            }}
          />
        </div>
      </Modal>

      <Modal
        show={showDeleteModal}
        onClose={(e) => {
          e.preventDefault();
          setShowDeleteModal(false);
        }}
      >
        <div className="glass-card">
          <h3 className="gradient-text">Confirm Deletion</h3>
          <p style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '1.5rem' }}>
            Are you sure you want to delete this loan? This action cannot be undone and will also delete all associated payments.
          </p>
          <button
            onClick={handleConfirmDelete}
            className="button danger wide glow-effect"
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
                Delete Loan
              </>
            )}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default Loans;
