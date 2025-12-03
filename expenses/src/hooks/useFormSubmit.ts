import { useState } from 'react';
import { useAuthDispatch, useAuthState } from '@context/context';
import { useNotification } from '@context/notification';
import { useLocalization } from '@context/localization';
import { fetchRequest, API_BASE_URL, processDataSync } from '@utils/utils';
import { notificationType } from '@utils/constants';
import { AuthState, NodeData, TransactionOrIncomeItem } from '@type/types';
import {
  isIndexedDBAvailable,
  isOnline,
} from '@utils/indexedDB';
import { 
  saveOffline, 
  updateUILocally,
  saveLoanOffline,
  savePaymentOffline,
  updateLoansUILocally,
} from '@utils/offlineAPI';
import { getPendingSyncOperations, removeSyncOperation } from '@utils/indexedDB';
import { logger } from '@utils/logger';

interface UseFormSubmitOptions<T> {
  formType: 'add' | 'edit';
  initialState: T;
  values: any;
  nodeType: string;
  onSuccess: () => void;
  dataDispatch?: any;
  buildNodeData: (formState: T, additionalParams?: any) => any;
  additionalParams?: any;
  successMessageKeys?: {
    add: string;
    edit: string;
  };
  useFetchRequest?: boolean; // true = use fetchRequest util, false = use direct fetch
}

interface UseFormSubmitReturn<T> {
  formState: T;
  setFormState: React.Dispatch<React.SetStateAction<T>>;
  isSubmitting: boolean;
  handleChange: (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => void;
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export const useFormSubmit = <T extends Record<string, any>>({
  formType,
  initialState,
  values,
  nodeType,
  onSuccess,
  dataDispatch,
  buildNodeData,
  additionalParams,
  successMessageKeys,
  useFetchRequest = true,
}: UseFormSubmitOptions<T>): UseFormSubmitReturn<T> => {
  const dispatch = useAuthDispatch();
  const { token } = useAuthState() as AuthState;
  const showNotification = useNotification();
  const { t } = useLocalization();

  const [formState, setFormState] = useState<T>(
    formType === 'add' ? initialState : values
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const value =
      event.target.type === 'checkbox'
        ? (event.target as HTMLInputElement).checked
        : event.target.value;

    setFormState({
      ...formState,
      [event.target.name]: value,
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const node = {
        type: nodeType,
        ...buildNodeData(formState, additionalParams),
      };

      const method = formType === 'add' ? 'POST' : 'PATCH';
      const url =
        formType === 'add'
          ? `${API_BASE_URL}/node?_format=json`
          : `${API_BASE_URL}/node/${values.nid}?_format=json`;

      // Determine entity type
      const entityType =
        nodeType === 'transaction' || nodeType === 'incomes'
          ? (nodeType === 'transaction' ? 'expense' : 'income')
          : null;

      // For loans: online-first approach when online, offline-first when offline
      if (nodeType === 'loan' && dataDispatch && isIndexedDBAvailable()) {
        const messageKey = successMessageKeys
          ? formType === 'add'
            ? successMessageKeys.add
            : successMessageKeys.edit
          : formType === 'add'
            ? 'notification.added'
            : 'notification.updated';

        if (isOnline()) {
          // Online: make direct API request first
          const fetchOptions = {
            method,
            headers: new Headers({
              Accept: 'application/json',
              'Content-Type': 'application/json',
              'JWT-Authorization': 'Bearer ' + token,
            }),
            body: JSON.stringify(node),
          };

          try {
            const response = await fetch(url, fetchOptions);
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: NodeData = await response.json();

            if (data.nid) {
              const serverId = data.nid[0]?.value?.toString() || data.nid.toString();
              const { saveLoanLocally } = await import('@utils/indexedDB');
              
              // Convert to loan format and save to local DB
              const loanToSave: any = {
                id: serverId,
                title: node.title?.[0] || '',
                fp: node.field_principal?.[0] || '',
                sdt: node.field_start_date?.[0] || '',
                edt: node.field_end_date?.[0] || '',
                fr: node.field_rate?.[0] || '',
                fif: node.field_initial_fee?.[0] || '',
                pdt: node.field_rec_first_payment_date?.[0] || '',
                frpd: node.field_recurring_payment_day?.[0] || '',
                fls: node.field_loan_status?.[0] || 'draft',
                cr: formType === 'add' ? Date.now() : undefined,
              };
              
              // Save to local DB with server data
              await saveLoanLocally(loanToSave, formType === 'add');
              
              // Update UI immediately
              await updateLoansUILocally(dataDispatch);
              
              // Show success notification
              showNotification(t(messageKey), notificationType.SUCCESS);
              
              setIsSubmitting(false);
              setFormState(initialState);
              onSuccess();
            } else {
              throw new Error('No ID returned from server');
            }
          } catch (error) {
            logger.error('Online request failed, falling back to offline:', error);
            
            // Fallback to offline save if online request fails
            const loanItem: any = {
              id: formType === 'add' ? undefined : values.nid,
              title: node.title?.[0] || '',
              fp: node.field_principal?.[0] || '',
              sdt: node.field_start_date?.[0] || '',
              edt: node.field_end_date?.[0] || '',
              fr: node.field_rate?.[0] || '',
              fif: node.field_initial_fee?.[0] || '',
              pdt: node.field_rec_first_payment_date?.[0] || '',
              frpd: node.field_recurring_payment_day?.[0] || '',
              fls: node.field_loan_status?.[0] || 'draft',
              cr: formType === 'add' ? Date.now() : undefined,
            };

            await saveLoanOffline(loanItem, node, formType, url, method);
            await updateLoansUILocally(dataDispatch);
            showNotification(t('notification.savedOffline') || 'Saved offline', notificationType.SUCCESS);
            
            setIsSubmitting(false);
            setFormState(initialState);
            onSuccess();
          }
        } else {
          // Offline: save locally and add to sync queue
          const loanItem: any = {
            id: formType === 'add' ? undefined : values.nid,
            title: node.title?.[0] || '',
            fp: node.field_principal?.[0] || '',
            sdt: node.field_start_date?.[0] || '',
            edt: node.field_end_date?.[0] || '',
            fr: node.field_rate?.[0] || '',
            fif: node.field_initial_fee?.[0] || '',
            pdt: node.field_rec_first_payment_date?.[0] || '',
            frpd: node.field_recurring_payment_day?.[0] || '',
            fls: node.field_loan_status?.[0] || 'draft',
            cr: formType === 'add' ? Date.now() : undefined,
          };

          await saveLoanOffline(loanItem, node, formType, url, method);
          await updateLoansUILocally(dataDispatch);
          showNotification(t('notification.savedOffline') || 'Saved offline', notificationType.SUCCESS);
          
          setIsSubmitting(false);
          setFormState(initialState);
          onSuccess();
        }
      }
      // For payments: online-first approach when online, offline-first when offline
      else if (nodeType === 'payment' && dataDispatch && isIndexedDBAvailable()) {
        // Get loan ID from node or additionalParams
        const loanId = node.field_loan_reference?.[0] || additionalParams?.loanId || values.field_loan_reference;
        
        if (!loanId) {
          throw new Error('Loan ID is required for payment');
        }

        const messageKey = successMessageKeys
          ? formType === 'add'
            ? successMessageKeys.add
            : successMessageKeys.edit
          : formType === 'add'
            ? 'notification.added'
            : 'notification.updated';

        if (isOnline()) {
          // Online: make direct API request first
          const fetchOptions = {
            method,
            headers: new Headers({
              Accept: 'application/json',
              'Content-Type': 'application/json',
              'JWT-Authorization': 'Bearer ' + token,
            }),
            body: JSON.stringify(node),
          };

          try {
            const response = await fetch(url, fetchOptions);
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: NodeData = await response.json();

            if (data.nid) {
              const serverId = data.nid[0]?.value?.toString() || data.nid.toString();
              const { savePaymentLocally } = await import('@utils/indexedDB');
              
              // Convert to payment format and save to local DB
              const paymentToSave: any = {
                id: serverId,
                title: node.title?.[0] || '',
                fdt: node.field_date?.[0] || '',
                fr: node.field_rate?.[0] || '',
                fpi: node.field_pay_installment?.[0] || '',
                fpsf: node.field_pay_single_fee?.[0] || '',
                fnra: node.field_new_recurring_amount?.[0] || '',
                fisp: node.field_is_simulated_payment?.[0] || 0,
                cr: formType === 'add' ? Date.now() : undefined,
              };
              
              // Save to local DB with server data
              await savePaymentLocally(loanId, paymentToSave, formType === 'add');
              
              // Update UI immediately
              await updateLoansUILocally(dataDispatch);
              
              // Show success notification
              showNotification(t(messageKey), notificationType.SUCCESS);
              
              setIsSubmitting(false);
              setFormState(initialState);
              onSuccess();
            } else {
              throw new Error('No ID returned from server');
            }
          } catch (error) {
            logger.error('Online request failed, falling back to offline:', error);
            
            // Fallback to offline save if online request fails
            const paymentItem: any = {
              id: formType === 'add' ? undefined : values.nid,
              title: node.title?.[0] || '',
              fdt: node.field_date?.[0] || '',
              fr: node.field_rate?.[0] || '',
              fpi: node.field_pay_installment?.[0] || '',
              fpsf: node.field_pay_single_fee?.[0] || '',
              fnra: node.field_new_recurring_amount?.[0] || '',
              fisp: node.field_is_simulated_payment?.[0] || 0,
              cr: formType === 'add' ? Date.now() : undefined,
            };

            await savePaymentOffline(loanId, paymentItem, node, formType, url, method);
            await updateLoansUILocally(dataDispatch);
            showNotification(t('notification.savedOffline') || 'Saved offline', notificationType.SUCCESS);
            
            setIsSubmitting(false);
            setFormState(initialState);
            onSuccess();
          }
        } else {
          // Offline: save locally and add to sync queue
          const paymentItem: any = {
            id: formType === 'add' ? undefined : values.nid,
            title: node.title?.[0] || '',
            fdt: node.field_date?.[0] || '',
            fr: node.field_rate?.[0] || '',
            fpi: node.field_pay_installment?.[0] || '',
            fpsf: node.field_pay_single_fee?.[0] || '',
            fnra: node.field_new_recurring_amount?.[0] || '',
            fisp: node.field_is_simulated_payment?.[0] || 0,
            cr: formType === 'add' ? Date.now() : undefined,
          };

          await savePaymentOffline(loanId, paymentItem, node, formType, url, method);
          await updateLoansUILocally(dataDispatch);
          showNotification(t('notification.savedOffline') || 'Saved offline', notificationType.SUCCESS);
          
          setIsSubmitting(false);
          setFormState(initialState);
          onSuccess();
        }
      }
      // For transactions/income: online-first approach when online, offline-first when offline
      else if (useFetchRequest && dataDispatch && entityType && isIndexedDBAvailable()) {
        const messageKey = successMessageKeys
          ? formType === 'add'
            ? successMessageKeys.add
            : successMessageKeys.edit
          : formType === 'add'
            ? 'notification.added'
            : 'notification.updated';

        if (isOnline()) {
          // Online: make direct API request first
          const fetchOptions = {
            method,
            headers: new Headers({
              Accept: 'application/json',
              'Content-Type': 'application/json',
              'JWT-Authorization': 'Bearer ' + token,
            }),
            body: JSON.stringify(node),
          };

          try {
            const response = await fetch(url, fetchOptions);
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: NodeData = await response.json();

            if (data.nid) {
              const serverId = data.nid[0]?.value?.toString() || data.nid.toString();
              const { saveExpenseLocally } = await import('@utils/indexedDB');
              
              // Convert to expense format and save to local DB
              const itemToSave: TransactionOrIncomeItem = {
                id: serverId,
                dt: node.field_date?.[0] || node.title?.[0] || new Date().toISOString().split('T')[0],
                sum: node.field_amount?.[0] || '0',
                type: nodeType === 'transaction' ? 'transaction' : 'incomes',
                cat: node.field_category?.[0],
                dsc: node.field_description?.[0],
                cr: formType === 'add' ? Date.now() : undefined,
              };
              
              // Save to local DB with server data
              await saveExpenseLocally(itemToSave, formType === 'add');
              
              // Update UI immediately
              await updateUILocally(dataDispatch);
              
              // Show success notification
              showNotification(t(messageKey), notificationType.SUCCESS);
              
              setIsSubmitting(false);
              setFormState(initialState);
              onSuccess();
            } else {
              throw new Error('No ID returned from server');
            }
          } catch (error) {
            logger.error('Online request failed, falling back to offline:', error);
            
            // Fallback to offline save if online request fails
            const savedItem: TransactionOrIncomeItem = {
              id: formType === 'add' ? undefined : values.nid,
              dt: node.field_date?.[0] || node.title?.[0] || new Date().toISOString().split('T')[0],
              sum: node.field_amount?.[0] || '0',
              type: nodeType === 'transaction' ? 'transaction' : 'incomes',
              cat: node.field_category?.[0],
              dsc: node.field_description?.[0],
              cr: formType === 'add' ? Date.now() : undefined,
            };

            const savedId = await saveOffline(savedItem, node, formType, entityType, url, method);
            await updateUILocally(dataDispatch);
            showNotification(t('notification.savedOffline') || 'Saved offline', notificationType.SUCCESS);
            
            setIsSubmitting(false);
            setFormState(initialState);
            onSuccess();
          }
        } else {
          // Offline: save locally and add to sync queue
          const savedItem: TransactionOrIncomeItem = {
            id: formType === 'add' ? undefined : values.nid,
            dt: node.field_date?.[0] || node.title?.[0] || new Date().toISOString().split('T')[0],
            sum: node.field_amount?.[0] || '0',
            type: nodeType === 'transaction' ? 'transaction' : 'incomes',
            cat: node.field_category?.[0],
            dsc: node.field_description?.[0],
            cr: formType === 'add' ? Date.now() : undefined,
          };

          await saveOffline(savedItem, node, formType, entityType, url, method);
          await updateUILocally(dataDispatch);
          showNotification(t('notification.savedOffline') || 'Saved offline', notificationType.SUCCESS);
          
          setIsSubmitting(false);
          setFormState(initialState);
          onSuccess();
        }
      } else {
        // Fallback to original behavior
        const fetchOptions = {
          method,
          headers: new Headers({
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'JWT-Authorization': 'Bearer ' + token,
          }),
          body: JSON.stringify(node),
        };

        if (useFetchRequest && dataDispatch) {
          fetchRequest(
            url,
            fetchOptions,
            dataDispatch,
            dispatch,
            (data: NodeData) => {
              if (data.nid) {
                onSuccess();
                const messageKey = successMessageKeys
                  ? formType === 'add'
                    ? successMessageKeys.add
                    : successMessageKeys.edit
                  : formType === 'add'
                    ? 'notification.added'
                    : 'notification.updated';
                showNotification(t(messageKey), notificationType.SUCCESS);
                setIsSubmitting(false);
                setFormState(initialState);
              } else {
                showNotification(t('error.unknown'), notificationType.ERROR);
                setIsSubmitting(false);
              }
            }
          );
        } else {
          fetch(url, fetchOptions)
            .then((response) => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              return response.json();
            })
            .then((data) => {
              if (data.nid) {
                onSuccess();
                const messageKey = successMessageKeys
                  ? formType === 'add'
                    ? successMessageKeys.add
                    : successMessageKeys.edit
                  : formType === 'add'
                    ? 'notification.added'
                    : 'notification.updated';
                showNotification(t(messageKey), notificationType.SUCCESS);
                setIsSubmitting(false);
                setFormState(initialState);
              } else {
                showNotification(t('error.unknown'), notificationType.ERROR);
                setIsSubmitting(false);
              }
            })
            .catch((error) => {
              logger.error('Operation failed:', error);
              showNotification(t('error.unknown'), notificationType.ERROR);
              setIsSubmitting(false);
            });
        }
      }
    } catch (error) {
      logger.error('Form submission error:', error);
      showNotification(t('error.unknown'), notificationType.ERROR);
      setIsSubmitting(false);
      onSuccess(); // Close modal even on error
    }
  };

  return {
    formState,
    setFormState,
    isSubmitting,
    handleChange,
    handleSubmit,
  };
};
