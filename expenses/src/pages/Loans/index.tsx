import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '@components/Modal';
import LoanForm from '@components/LoanForm';
import useSwipeActions from '@hooks/useSwipeActions';
import { AuthState } from '@type/types';
import { deleteNode, fetchLoans } from '@utils/utils';
import { notificationType } from '@utils/constants';
import { useAuthDispatch, useAuthState } from '@context/context';
import { useNotification } from '@context/notification';
import { FaPen, FaTrash } from 'react-icons/fa';
import { useLoan } from '@context/loan';
import { formatNumber } from '@utils/utils';

const Loans = () => {
  const tableRef = useRef(null);
  const showNotification = useNotification();
  const { data, dataDispatch } = useLoan();
  const { token } = useAuthState() as AuthState;
  const dispatch = useAuthDispatch();
  const { loans } = data;
  const noData = !data.loans || data?.loans?.length === 0;
  const loading = data.loading;
  useEffect(() => {
    if (noData) {
      fetchLoans(token, dataDispatch, dispatch);
    }
  }, [dataDispatch, noData, token, dispatch]);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isNewModal, setIsNewModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedItem, setFocusedItem] = useState({
    title: '',
    field_principal: '',
    field_start_date: new Date().toISOString().slice(0, 10),
    field_end_date: new Date().toISOString().slice(0, 10),
    field_rate: '',
    field_initial_fee: '',
    field_rec_first_payment_date: null,
    field_recurring_payment_day: '',
    field_recurring_payment_fee: '',
    field_loan_status: 'draft',
  });

  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    deleteVisible,
    editVisible,
    extraRowStyle,
  } = useSwipeActions();

  const handleEdit = (id: string) => {
    const item = loans?.find((item) => item.id === id);
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
      field_recurring_payment_fee: item.frpf,
      field_loan_status: item.fls,
    });
    setShowEditModal(true);
  };

  const handleDelete = (showDeleteModal: boolean, token: string) => {
    setIsSubmitting(true);
    // @ts-expect-error
    deleteNode(showDeleteModal, token, (response) => {
      if (response.ok) {
        showNotification(
          'Loan was successfully deleted.',
          notificationType.SUCCESS
        );
        setIsSubmitting(false);
      } else {
        showNotification('Something went wrong.', notificationType.ERROR);
        setIsSubmitting(false);
      }
      setShowDeleteModal(false);
      fetchLoans(token, dataDispatch, dispatch);
    });
  };

  return (
    <div className="incomes-page">
      {loading ? (
        <div className="lds-ripple">
          <div></div>
          <div></div>
        </div>
      ) : (
        <>
          <h2>Loans page</h2>
          <button
            onClick={() => {
              setShowEditModal(true);
              setIsNewModal(true);
            }}
            className="button wide"
          >
            Add New Loan
          </button>
          <br />
          <br />
          <Modal
            show={showDeleteModal}
            onClose={(e) => {
              e.preventDefault();
              setShowDeleteModal(false);
            }}
          >
            <h3>Are you sure you want to delete the loan?</h3>
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
            <LoanForm
              formType={!isNewModal ? 'edit' : 'add'}
              values={focusedItem}
              onSuccess={() => {
                setIsNewModal(false);
                setShowEditModal(false);
                fetchLoans(token, dataDispatch, dispatch);
              }}
            />
          </Modal>
          {noData ? (
            'No loans found'
          ) : (
            <div className="table-wrapper">
              <table className="expenses-table" cellSpacing="0" cellPadding="0">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Principal</th>
                    <th>Rate</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th className="desktop-only"></th>
                    <th className="desktop-only"></th>
                  </tr>
                </thead>
                <tbody ref={tableRef}>
                  {/** In Progress Section */}
                  {loans?.some((loan) => loan.fls == 'in_progress') && (
                    <>
                      <tr>
                        <td colSpan={7}>
                          <strong>🟡 In Progress</strong>
                        </td>
                      </tr>
                      {loans
                        .filter((loan) => loan.fls == 'in_progress')
                        .map((loan) => (
                          <tr
                            key={loan.id}
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
                                setShowDeleteModal
                              )
                            }
                          >
                            <td>
                              <Link
                                to={`/expenses/loan/${loan.id}`}
                                style={{
                                  color: 'white',
                                  textDecoration: 'none',
                                }}
                              >
                                {loan.title}
                              </Link>
                            </td>
                            <td>{formatNumber(loan.fp)}</td>
                            <td>{formatNumber(loan.fr)}</td>
                            <td>{loan.sdt}</td>
                            <td>{loan.edt}</td>
                            <td className="desktop-only">
                              <button
                                onClick={() => handleEdit(loan.id)}
                                className="btn-outline"
                              >
                                <FaPen />
                              </button>
                            </td>
                            <td className="desktop-only">
                              <button
                                onClick={() => setShowDeleteModal(loan.id)}
                                className="btn-outline"
                              >
                                <FaTrash />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </>
                  )}

                  {/** Draft Section */}
                  {loans?.some((loan) => loan.fls == 'draft') && (
                    <>
                      <tr>
                        <td colSpan={7}>
                          <strong>🔵 Draft</strong>
                        </td>
                      </tr>
                      {loans
                        .filter((loan) => loan.fls == 'draft')
                        .map((loan) => (
                          <tr
                            key={loan.id}
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
                                setShowDeleteModal
                              )
                            }
                          >
                            <td>
                              <Link
                                to={`/expenses/loan/${loan.id}`}
                                style={{
                                  color: 'white',
                                  textDecoration: 'none',
                                }}
                              >
                                {loan.title}
                              </Link>
                            </td>
                            <td>{formatNumber(loan.fp)}</td>
                            <td>{formatNumber(loan.fr)}</td>
                            <td>{loan.sdt}</td>
                            <td>{loan.edt}</td>
                            <td className="desktop-only">
                              <button
                                onClick={() => handleEdit(loan.id)}
                                className="btn-outline"
                              >
                                <FaPen />
                              </button>
                            </td>
                            <td className="desktop-only">
                              <button
                                onClick={() => setShowDeleteModal(loan.id)}
                                className="btn-outline"
                              >
                                <FaTrash />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </>
                  )}

                  {/** Completed Section */}
                  {loans?.some((loan) => loan.fls == 'completed') && (
                    <>
                      <tr>
                        <td colSpan={7}>
                          <strong>🟢 Completed</strong>
                        </td>
                      </tr>
                      {loans
                        .filter((loan) => loan.fls == 'completed')
                        .map((loan) => (
                          <tr
                            key={loan.id}
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
                                setShowDeleteModal
                              )
                            }
                          >
                            <td>
                              <Link
                                to={`/expenses/loan/${loan.id}`}
                                style={{
                                  color: 'white',
                                  textDecoration: 'none',
                                }}
                              >
                                {loan.title}
                              </Link>
                            </td>
                            <td>{formatNumber(loan.fp)}</td>
                            <td>{formatNumber(loan.fr)}</td>
                            <td>{loan.sdt}</td>
                            <td>{loan.edt}</td>
                            <td className="desktop-only">
                              <button
                                onClick={() => handleEdit(loan.id)}
                                className="btn-outline"
                              >
                                <FaPen />
                              </button>
                            </td>
                            <td className="desktop-only">
                              <button
                                onClick={() => setShowDeleteModal(loan.id)}
                                className="btn-outline"
                              >
                                <FaTrash />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </>
                  )}
                </tbody>
              </table>
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
        </>
      )}
    </div>
  );
};

export default Loans;
