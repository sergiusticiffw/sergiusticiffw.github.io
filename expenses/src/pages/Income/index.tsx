import React, { Suspense, useEffect, useState } from 'react';
import IncomeForm from '@components/Income/IncomeForm';
import { deleteNode, fetchData, formatNumber } from '@utils/utils';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { useNotification } from '@context/notification';
import Modal from '@components/Modal/Modal';
import IncomeTable from '@components/Income/IncomeTable';
import YearIncomeAverageTrend from '@components/Income/YearIncomeAverageTrend';
import { notificationType } from '@utils/constants';
import { AuthState, TransactionOrIncomeItem } from '@type/types';
import {
  FaPlus,
  FaTrash,
  FaCaretDown,
  FaMoneyBillWave,
  FaChartLine,
} from 'react-icons/fa';
import './Income.scss';

const Income = () => {
  const showNotification = useNotification();
  const { token } = useAuthState() as AuthState;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isNewModal, setIsNewModal] = useState(false);
  const { data, dataDispatch } = useData();
  const noData = data.groupedData === null;
  const loading = data.loading;
  const dispatch = useAuthDispatch();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nrOfItemsToShow, setNrOfItemsToShow] = useState(20);

  useEffect(() => {
    if (noData) {
      fetchData(token, dataDispatch, dispatch);
    }
  }, [data, dataDispatch, noData, token, dispatch]);

  const [focusedItem, setFocusedItem] = useState({
    nid: '',
    field_date: '',
    field_amount: '',
    field_description: '',
  });

  const handleEdit = (id: string) => {
    const item = data.incomeData.find(
      (item: TransactionOrIncomeItem) => item.id === id
    );
    setFocusedItem({
      nid: item.id,
      field_date: item.dt,
      field_amount: item.sum,
      field_description: item.dsc,
    });
    setShowEditModal(true);
  };

  const handleDelete = (showDeleteModal: boolean, token: string) => {
    setIsSubmitting(true);
    // @ts-expect-error
    deleteNode(showDeleteModal, token, (response) => {
      if (response.ok) {
        showNotification(
          'Income was successfully deleted.',
          notificationType.SUCCESS
        );
        setIsSubmitting(false);
      } else {
        showNotification('Something went wrong.', notificationType.ERROR);
        setIsSubmitting(false);
      }
      setShowDeleteModal(false);
      fetchData(token, dataDispatch, dispatch);
    });
  };

  const handleClearChangedItem = (id: string) => {
    dataDispatch({ type: 'CLEAR_CHANGED_ITEM', id });
  };

  // Calculate income statistics
  const totalIncome =
    data.incomeData?.reduce(
      (sum: number, item: TransactionOrIncomeItem) =>
        sum + parseFloat(item.sum || '0'),
      0
    ) || 0;
  const totalRecords = data.incomeData?.length || 0;
  const averageIncome = totalRecords > 0 ? totalIncome / totalRecords : 0;

  if (loading) {
    return (
      <div className="income-container">
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
    <div className="income-container">
      {/* Header Section */}
      <div className="income-header">
        <div className="header-icon">
          <FaMoneyBillWave />
        </div>
        <h1 className="header-title">Income Management</h1>
        <p className="header-subtitle">
          Track and manage your income sources efficiently
        </p>
      </div>

      {/* Actions Section */}
      <div className="btns-actions">
        <button
          onClick={() => {
            setShowEditModal(true);
            setIsNewModal(true);
          }}
          className="action-btn"
        >
          <FaPlus />
          Add New Income
        </button>
      </div>

      {/* Summary Section */}
      <div className="income-summary">
        <div className="summary-header">
          <FaChartLine />
          <h3>Income Overview</h3>
        </div>
        <div className="summary-grid">
          <div className="summary-item">
            <div className="summary-value">{formatNumber(totalRecords)}</div>
            <div className="summary-label">Total Records</div>
          </div>
          <div className="summary-item">
            <div className="summary-value">{formatNumber(totalIncome)}</div>
            <div className="summary-label">Total Income</div>
          </div>
          <div className="summary-item">
            <div className="summary-value">{formatNumber(averageIncome)}</div>
            <div className="summary-label">Average Income</div>
          </div>
        </div>
      </div>

      {/* Income Table Section */}
      <div className="income-table-section">
        {noData ? (
          <div className="no-income">
            <div className="no-income-icon">
              <FaMoneyBillWave />
            </div>
            <h3>No Income Data</h3>
            <p>Start by adding your first income record</p>
          </div>
        ) : (
          <>
            {data.incomeData && data.incomeData.length ? (
              <IncomeTable
                items={data.incomeData.slice(0, nrOfItemsToShow)}
                handleEdit={handleEdit}
                // @ts-expect-error
                setShowDeleteModal={setShowDeleteModal}
                changedItems={data.changedItems}
                handleClearChangedItem={handleClearChangedItem}
              />
            ) : (
              <div className="no-income">
                <div className="no-income-icon">
                  <FaMoneyBillWave />
                </div>
                <h3>No Income Records</h3>
                <p>No income records found. Add your first income entry.</p>
              </div>
            )}

            {data.incomeData?.length > nrOfItemsToShow && (
              <div className="load-more">
                <button
                  onClick={() => setNrOfItemsToShow(nrOfItemsToShow + 10)}
                  className="load-more-btn"
                >
                  <FaCaretDown />
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Charts Section */}
      {data.incomeData?.length ? (
        <div>
          <YearIncomeAverageTrend />
        </div>
      ) : null}

      {/* Modals */}
      <Modal
        show={showDeleteModal}
        onClose={(e) => {
          e.preventDefault();
          setShowDeleteModal(false);
        }}
      >
        <h3>Are you sure you want to delete this income record?</h3>
        <p style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '1.5rem' }}>
          This action cannot be undone.
        </p>
        <button
          onClick={() => handleDelete(showDeleteModal, token)}
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

      <Modal
        show={showEditModal}
        onClose={(e) => {
          e.preventDefault();
          setShowEditModal(false);
          setIsNewModal(false);
        }}
      >
        <IncomeForm
          formType={!isNewModal ? 'edit' : 'add'}
          values={focusedItem}
          onSuccess={() => {
            setShowEditModal(false);
            setIsNewModal(false);
            fetchData(token, dataDispatch, dispatch);
          }}
        />
      </Modal>
    </div>
  );
};

export default Income;
