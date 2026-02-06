import { useRef, useState } from 'react';
import { useAuthDispatch, useAuthState } from '@shared/context/context';
import { useNotification } from '@shared/context/notification';
import { useLocalization } from '@shared/context/localization';
import useSwipeActions from '@shared/hooks/useSwipeActions';
import {
  FiEdit2,
  FiPlus,
  FiTrash2,
  FiChevronDown,
  FiDollarSign,
  FiMove,
  FiArrowUp,
  FiArrowDown,
} from 'react-icons/fi';
import {
  deleteNode,
  formatNumber,
  getLocale,
  processPayments,
} from '@shared/utils/utils';
import ItemSyncIndicator from '@shared/components/Common/ItemSyncIndicator';
import DeleteConfirmDrawer from '@shared/components/VaulDrawer/DeleteConfirmDrawer';
import VaulDrawer from '@shared/components/VaulDrawer';
import { fetchLoans as fetchLoansService } from '@features/loans/api/loans';
import { useApiClient } from '@shared/hooks/useApiClient';
import { notificationType } from '@shared/utils/constants';
import PaymentForm from '@features/loans/components/Loan/PaymentForm';
import { useLoan } from '@shared/context/loan';
type SortField = 'date' | 'amount' | null;
type SortDirection = 'asc' | 'desc';

const PaymentDetails = (props) => {
  const payments = props?.payments ?? [];
  const loan = props?.loan ?? {};
  const pendingSyncIds = props?.pendingSyncIds ?? {};
  const listRef = useRef<any>(null);
  const showNotification = useNotification();
  const { t, language } = useLocalization();
  const apiClient = useApiClient();
  const [showEditModal, setShowEditModal] = useState(false);
  const [isNewModal, setIsNewModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentFormSubmitting, setPaymentFormSubmitting] = useState(false);
  const { dataDispatch } = useLoan();
  const { token } = useAuthState();
  useAuthDispatch();
  const [nrOfItemsToShow, setNrOfItemsToShow] = useState(4);
  const [deleteModalId, setDeleteModalId] = useState<string | false>(false);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    deleteVisible,
    editVisible,
    swipedItemId,
  } = useSwipeActions();

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
    deleteNode(
      paymentId,
      token,
      (response) => {
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
        // UI update is handled by deleteNode, only fetch if online
        if (navigator.onLine && apiClient) {
          fetchLoansService(apiClient, dataDispatch);
        }
      },
      dataDispatch,
      loan?.id
    );
  };

  const handleDeleteClick = (paymentId: string) => {
    setDeleteModalId(paymentId);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sort payments
  const sortedPayments = (() => {
    // Use helper function for default sort (when no sortField is selected)
    if (!sortField) {
      return processPayments([...payments]);
    }

    // Manual sorting for specific fields
    return [...payments].sort((a, b) => {
      if (sortField === 'date') {
        const dateA = new Date(a.fdt).getTime();
        const dateB = new Date(b.fdt).getTime();
        if (sortDirection === 'asc') {
          // For ascending, if same date, sort by cr ascending (oldest first)
          const dateComparison = dateA - dateB;
          if (dateComparison !== 0) {
            return dateComparison;
          }
          const crA = a.cr || new Date(a.fdt).getTime();
          const crB = b.cr || new Date(b.fdt).getTime();
          return crA - crB;
        } else {
          // For descending, if same date, sort by cr descending (newest first)
          const dateComparison = dateB - dateA;
          if (dateComparison !== 0) {
            return dateComparison;
          }
          const crA = a.cr || new Date(a.fdt).getTime();
          const crB = b.cr || new Date(b.fdt).getTime();
          return crB - crA;
        }
      }

      if (sortField === 'amount') {
        const amountA = parseFloat(a.fpi || '0');
        const amountB = parseFloat(b.fpi || '0');
        return sortDirection === 'asc' ? amountA - amountB : amountB - amountA;
      }

      return 0;
    });
  })();

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <FiMove />;
    return sortDirection === 'asc' ? <FiArrowUp /> : <FiArrowDown />;
  };

  const sortBtn =
    'rounded-lg py-2 px-4 text-white/60 text-sm cursor-pointer flex items-center gap-2 transition-all duration-200 bg-white/[0.05] border-none hover:bg-white/10 hover:text-white/80 [&_svg]:text-sm';
  const sortBtnActive =
    'bg-[rgba(91,141,239,0.2)] text-[#5b8def] font-medium';

  return (
    <div>
      <DeleteConfirmDrawer
        open={!!deleteModalId}
        onClose={() => setDeleteModalId(false)}
        onConfirm={() =>
          deleteModalId && handleDelete(deleteModalId, token)
        }
        title={t('payment.deletePayment')}
        message={t('modal.deletePayment')}
        isSubmitting={isSubmitting}
      />

      {/* Edit / Add payment – same VaulDrawer + footer as Income */}
      <VaulDrawer
        show={showEditModal}
        onClose={(e) => {
          e.preventDefault();
          setShowEditModal(false);
          setIsNewModal(false);
        }}
        title={!isNewModal ? t('payment.editPayment') : t('payment.addPayment')}
        footer={
          <button
            type="submit"
            form={`payment-form-${!isNewModal ? 'edit' : 'add'}`}
            disabled={paymentFormSubmitting}
            className="btn-submit"
          >
            {paymentFormSubmitting ? (
              <div className="loader">
                <span className="loader__element"></span>
                <span className="loader__element"></span>
                <span className="loader__element"></span>
              </div>
            ) : !isNewModal ? (
              <>
                <FiEdit2 />
                <span>{t('payment.editPayment')}</span>
              </>
            ) : (
              <>
                <FiPlus />
                <span>{t('payment.addPayment')}</span>
              </>
            )}
          </button>
        }
      >
        <PaymentForm
          formType={!isNewModal ? 'edit' : 'add'}
          values={focusedItem}
          startDate={loan.sdt}
          endDate={loan.edt}
          hideSubmitButton={true}
          onFormReady={(_submitHandler, isSubmitting) => {
            setPaymentFormSubmitting(isSubmitting);
          }}
          onSuccess={() => {
            setIsNewModal(false);
            setShowEditModal(false);
            if (navigator.onLine && apiClient) {
              fetchLoansService(apiClient, dataDispatch);
            }
          }}
        />
      </VaulDrawer>

      {/* Payment List – same pattern as IncomeTable / TransactionList */}
      {payments.length ? (
        <div
          className="flex flex-col gap-2 w-full relative overflow-x-hidden overflow-y-auto touch-pan-y mt-4"
          style={{ WebkitOverflowScrolling: 'touch' }}
          ref={listRef}
        >
          <div className="mb-3">
            <p className="text-base text-white/50 m-0 mb-2">
              {Math.min(nrOfItemsToShow, payments.length)} of {payments.length}{' '}
              payments
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className={`${sortBtn} ${sortField === 'date' ? sortBtnActive : ''}`}
                onClick={() => handleSort('date')}
              >
                Date {getSortIcon('date')}
              </button>
              <button
                type="button"
                className={`${sortBtn} ${sortField === 'amount' ? sortBtnActive : ''}`}
                onClick={() => handleSort('amount')}
              >
                Amount {getSortIcon('amount')}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {sortedPayments.slice(0, nrOfItemsToShow).map((payment) => {
              const isSimulated = Number(payment.fisp) === 1;
              const date = new Date(payment.fdt);
              const day = date.getDate();
              const locale = getLocale(language);
              const month = date
                .toLocaleDateString(locale, { month: 'short' })
                .toUpperCase();

              const isThisItemSwiped = swipedItemId === payment.id;
              const isPending =
                !!pendingSyncIds[payment.id] ||
                (typeof payment.id === 'string' &&
                  payment.id.startsWith('temp_'));

              return (
                <div
                  key={payment.id}
                  className={`relative w-full rounded-2xl overflow-hidden ${isSimulated ? 'border-l-4 border-l-[#ff9800]' : ''}`}
                >
                  <div
                    className={`swipe-actions-background rounded-2xl ${isThisItemSwiped && (deleteVisible || editVisible) ? 'visible' : ''}`}
                  >
                    {isThisItemSwiped && deleteVisible && (
                      <div className="delete-action-bg">
                        <FiTrash2 />
                      </div>
                    )}
                    {isThisItemSwiped && editVisible && (
                      <div className="edit-action-bg">
                        <FiEdit2 />
                      </div>
                    )}
                  </div>

                  <div
                    data-id={payment.id}
                    className="bg-white/[0.05] rounded-2xl py-4 pr-6 pl-4 flex items-start gap-4 cursor-pointer transition-all duration-200 relative z-[1] w-full min-h-0 touch-pan-y overflow-hidden hover:bg-white/10 hover:translate-x-1 active:scale-[0.98]"
                    style={{ touchAction: 'pan-y pan-x pinch-zoom' }}
                    onTouchStart={(e) =>
                      handleTouchStart(e, payment.id, listRef)
                    }
                    onTouchMove={(e) => handleTouchMove(e, listRef)}
                    onTouchEnd={(e) =>
                      handleTouchEnd(
                        e,
                        listRef,
                        payment.id,
                        handleEdit,
                        handleDeleteClick
                      )
                    }
                  >
                    <div className="flex flex-col items-center justify-center min-w-[50px] shrink-0">
                      <div className="text-2xl font-bold text-white leading-none">{day}</div>
                      <div className="text-xs font-semibold text-white/50 mt-1 tracking-wide">{month}</div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap text-base font-medium text-white/90 leading-snug break-words">
                        {payment.title}
                        {isSimulated && (
                          <span className="inline-block text-[0.7rem] font-semibold text-[#ff9800] bg-[rgba(255,152,0,0.15)] px-2 py-0.5 rounded-full uppercase tracking-wide">
                            {t('payment.simulated')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-lg font-bold text-white whitespace-nowrap pr-2 shrink-0 flex items-center gap-1">
                      {formatNumber(payment.fpi)}
                      <ItemSyncIndicator
                        status={isPending ? 'pending' : undefined}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {payments.length > nrOfItemsToShow && (
            <div className="flex justify-center items-center py-4 mt-2">
              <button
                type="button"
                onClick={() => setNrOfItemsToShow(nrOfItemsToShow + 10)}
                className="inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-[var(--color-app-accent)]/20 border border-[var(--color-app-accent)]/40 text-[var(--color-app-accent)] text-[0.95rem] font-semibold cursor-pointer transition-all duration-200 hover:bg-[var(--color-app-accent)]/30 hover:border-[var(--color-app-accent)]/50 hover:-translate-y-0.5 active:translate-y-0 shadow-[0_2px_8px_rgba(0,0,0,0.15)] [&_svg]:text-sm"
              >
                <FiChevronDown />
                <span>
                  {t('common.loadMore')} ({payments.length - nrOfItemsToShow}{' '}
                  {t('common.remaining')})
                </span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 px-6">
          <FiDollarSign className="w-12 h-12 text-[var(--color-app-accent)]/70 mx-auto mb-4 opacity-70" />
          <h3 className="text-xl font-semibold text-white m-0 mb-2">
            {t('payment.noPaymentsYet')}
          </h3>
          <p className="text-white/50 text-sm m-0">
            {t('payment.noPaymentsDesc')}
          </p>
        </div>
      )}
    </div>
  );
};

export default PaymentDetails;
