import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAuthDispatch, useAuthState } from '@context/context';
import { useLoan } from '@context/loan';
import { AuthState } from '@type/types';
import { fetchLoans, formatNumber, deleteLoan } from '@utils/utils';
import { useNotification } from '@context/notification';
import { notificationType } from '@utils/constants';
import useSwipeActions from '@hooks/useSwipeActions';
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
    'status' | 'title' | 'principal'
  >('status');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const tableRef = useRef(null);

  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    deleteVisible,
    editVisible,
    extraRowStyle,
  } = useSwipeActions();

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
      showNotification('Loan deleted successfully!', notificationType.SUCCESS);
      fetchLoans(token, dataDispatch, dispatch);
    });
  };

  const handleSort = (field: 'status' | 'title' | 'principal') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: 'status' | 'title' | 'principal') => {
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
      {/* Simple Header */}
      <div className="loans-header">
        <h1>Loans</h1>
      </div>

      {/* Add Loan Button */}
      <div className="btns-actions">
        <button onClick={() => setShowAddModal(true)} className="action-btn">
          <FaPlus />
          Add New Loan
        </button>
      </div>

      {/* Simple Stats */}
      <div className="loans-stats">
        <div className="stat-item">
          <span className="stat-value">{formatNumber(totalLoans)}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{formatNumber(activeLoans)}</span>
          <span className="stat-label">Active</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{formatNumber(completedLoans)}</span>
          <span className="stat-label">Completed</span>
        </div>
      </div>

      {/* Loans Table Section */}
      <div className="loans-table-section">
        {filteredAndSortedLoans.length === 0 ? (
          <div className="no-loans">
            <FaHandHoldingUsd />
            <h3>No loans found</h3>
            <p>
              {statusFilter !== 'all'
                ? `No loans with "${statusFilter}" status found.`
                : 'No loans available. Add your first loan to get started!'}
            </p>
            {statusFilter !== 'all' && (
              <button
                onClick={() => setStatusFilter('all')}
                className="action-btn"
              >
                Show All Loans
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="loans-filter">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <div className="loans-table-container">
              <div className="table-header">
                <h3>Loan Records</h3>
                <p className="table-subtitle">Manage and track your loans</p>
              </div>

              <div className="table-wrapper">
                <table className="loans-table" cellSpacing="0" cellPadding="0" ref={tableRef}>
                  <thead>
                    <tr>
                      <th
                        onClick={() => handleSort('title')}
                        className={`sortable ${sortBy === 'title' ? (sortOrder === 'asc' ? 'asc' : 'desc') : ''}`}
                      >
                        Title
                      </th>
                      <th
                        onClick={() => handleSort('principal')}
                        className={`sortable ${sortBy === 'principal' ? (sortOrder === 'asc' ? 'asc' : 'desc') : ''}`}
                      >
                        Principal
                      </th>
                      <th
                        onClick={() => handleSort('status')}
                        className={`sortable ${sortBy === 'status' ? (sortOrder === 'asc' ? 'asc' : 'desc') : ''}`}
                      >
                        Status
                      </th>
                      <th className="desktop-only">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedLoans.map((loan: any) => {
                      const status = getLoanStatus(loan);
                      return (
                        <tr
                          key={loan.id}
                          className="loan-item"
                          data-id={loan.id}
                          onTouchStart={(e) =>
                            handleTouchStart(e, loan.id, tableRef)
                          }
                          onTouchMove={(e) => handleTouchMove(e, tableRef)}
                          onTouchEnd={(e) =>
                            handleTouchEnd(
                              e,
                              tableRef,
                              loan.id,
                              handleEdit,
                              handleDelete
                            )
                          }
                        >
                          <td className="loan-title">
                            <div className="title-content">
                              <div className="title-text">
                                <Link to={`/expenses/loan/${loan.id}`} className="loan-link">
                                  {loan.title}
                                </Link>
                              </div>
                            </div>
                          </td>
                          <td className="loan-principal">
                            <div className="principal-value">
                              {formatNumber(parseFloat(loan.fp || '0'))}
                            </div>
                          </td>
                          <td className="loan-status">
                            <div className="status-content">
                              <span className={`status-badge ${status}`}>
                                {getStatusText(status)}
                              </span>
                            </div>
                          </td>
                          <td className="desktop-only loan-actions-cell">
                            <div className="action-buttons">
                              <button
                                onClick={() => handleEdit(loan.id)}
                                className="btn-edit"
                                title="Edit Loan"
                              >
                                <FaPen />
                              </button>
                              <button
                                onClick={() => handleDelete(loan.id)}
                                className="btn-delete"
                                title="Delete Loan"
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
          </>
        )}
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
        <h3>Are you sure you want to delete this loan?</h3>
        <p style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '1.5rem' }}>
          This action cannot be undone and will also delete all associated payments.
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
              Delete
            </>
          )}
        </button>
      </Modal>
    </div>
  );
};

export default Loans;

