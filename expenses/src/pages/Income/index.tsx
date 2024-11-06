import React, { Suspense, useEffect, useState } from 'react';
import IncomeForm from '@components/IncomeForm';
import { deleteNode, fetchData } from '@utils/utils';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { useNotification } from '@context/notification';
import Modal from '@components/Modal';
import IncomeTable from '@components/IncomeTable';
import { notificationType } from '@utils/constants';
import { AuthState, TransactionOrIncomeItem } from '@type/types';
import { FaPlus, FaTrash, FaCaretDown } from 'react-icons/fa';

const Income = () => {
  const YearIncomeAverageTrend = React.lazy(
    () => import('@components/YearIncomeAverageTrend')
  );
  const MonthlyComparisonIncomeTrend = React.lazy(
    () => import('@components/MonthlyComparisonIncomeTrend')
  );
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

  return (
    <div className="incomes-page">
      <Modal
        show={showDeleteModal}
        onClose={(e) => {
          e.preventDefault();
          setShowDeleteModal(false);
        }}
      >
        <h3>Are you sure you want to delete the income?</h3>
        <button
          onClick={() => handleDelete(showDeleteModal, token)}
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
      {loading ? (
        <div className="lds-ripple">
          <div></div>
          <div></div>
        </div>
      ) : (
        <>
          <h2>Incomes</h2>
          {noData ? (
            ''
          ) : (
            <div>
              <button
                onClick={() => {
                  setShowEditModal(true);
                  setIsNewModal(true);
                }}
                className="button wide"
              >
                <FaPlus />
              </button>

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
                <p>No income records found.</p>
              )}

              {data.incomeData?.length > nrOfItemsToShow && (
                <div className="load-more">
                  <button
                    onClick={() => setNrOfItemsToShow(nrOfItemsToShow + 10)}
                    className="btn-outline"
                  >
                    <FaCaretDown />
                  </button>
                </div>
              )}
            </div>
          )}
          {data.incomeData?.length ? (
            <div className="charts-section">
              <Suspense fallback="">
                <YearIncomeAverageTrend />
              </Suspense>
              <Suspense fallback="">
                <MonthlyComparisonIncomeTrend />
              </Suspense>
            </div>
          ) : (
            ''
          )}
        </>
      )}
    </div>
  );
};

export default Income;
