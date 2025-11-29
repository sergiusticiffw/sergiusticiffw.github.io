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

      // For loans: implement offline-first approach
      if (nodeType === 'loan' && dataDispatch && isIndexedDBAvailable()) {
        // Convert node to loan format
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

        // Save offline (saves locally and adds to sync queue)
        const savedId = await saveLoanOffline(loanItem, node, formType, url, method);
        loanItem.id = savedId;

        // Show success message
        const messageKey = successMessageKeys
          ? formType === 'add'
            ? successMessageKeys.add
            : successMessageKeys.edit
          : formType === 'add'
            ? 'notification.added'
            : 'notification.updated';
        
        // Try to sync if online, otherwise update UI with local data
        if (isOnline()) {
          // Don't update UI yet - wait for server response
        } else {
          // Update UI with local data when offline
          await updateLoansUILocally(dataDispatch);
          showNotification(t('notification.savedOffline') || 'Saved offline', notificationType.SUCCESS);
        }

        setIsSubmitting(false);
        setFormState(initialState);
        onSuccess();

        // Try to sync if online
        if (isOnline()) {
          const fetchOptions = {
            method,
            headers: new Headers({
              Accept: 'application/json',
              'Content-Type': 'application/json',
              'JWT-Authorization': 'Bearer ' + token,
            }),
            body: JSON.stringify(node),
          };

          fetch(url, fetchOptions)
            .then(async (response) => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              return response.json();
            })
            .then(async (data: NodeData) => {
              if (data.nid) {
                const serverId = data.nid[0]?.value?.toString() || data.nid.toString();
                const { openDB, saveLoanLocally } = await import('@utils/indexedDB');
                
                if (formType === 'add' && loanItem.id?.startsWith('temp_')) {
                  // Update local item with server ID
                  const db = await openDB();
                  const transaction = db.transaction('loans', 'readwrite');
                  const store = transaction.objectStore('loans');
                  
                  const localItem = await new Promise<any>((resolve) => {
                    const req = store.get(loanItem.id);
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => resolve(null);
                  });

                  if (localItem) {
                    await new Promise<void>((resolve) => {
                      const delReq = store.delete(loanItem.id!);
                      delReq.onsuccess = () => resolve();
                      delReq.onerror = () => resolve();
                    });
                    
                    localItem.id = serverId;
                    await new Promise<void>((resolve) => {
                      const putReq = store.put(localItem);
                      putReq.onsuccess = () => resolve();
                      putReq.onerror = () => resolve();
                    });
                  }
                  transaction.oncomplete = () => db.close();
                  
                  // Remove from sync queue since we successfully synced online
                  const pendingOps = await getPendingSyncOperations();
                  const op = pendingOps.find(
                    (o) => o.localId === loanItem.id && o.type === 'create' && o.entityType === 'loan'
                  );
                  if (op && op.id) {
                    await removeSyncOperation(op.id);
                  }
                } else if (formType === 'edit') {
                  // For edit operations, update local DB with server data
                  const updatedLoan: any = {
                    id: serverId,
                    title: node.title?.[0] || loanItem.title,
                    fp: node.field_principal?.[0] || loanItem.fp,
                    sdt: node.field_start_date?.[0] || loanItem.sdt,
                    edt: node.field_end_date?.[0] || loanItem.edt,
                    fr: node.field_rate?.[0] || loanItem.fr,
                    fif: node.field_initial_fee?.[0] || loanItem.fif,
                    pdt: node.field_rec_first_payment_date?.[0] || loanItem.pdt,
                    frpd: node.field_recurring_payment_day?.[0] || loanItem.frpd,
                    fls: node.field_loan_status?.[0] || loanItem.fls,
                  };
                  
                  // Update local DB with server data
                  await saveLoanLocally(updatedLoan, false);
                  
                  // Remove from sync queue since we successfully synced online
                  const pendingOps = await getPendingSyncOperations();
                  const op = pendingOps.find(
                    (o) => o.localId === loanItem.id && o.type === 'update' && o.entityType === 'loan'
                  );
                  if (op && op.id) {
                    await removeSyncOperation(op.id);
                  }
                }
                
                // Update UI with latest data from local DB
                await updateLoansUILocally(dataDispatch);
                
                // Show success notification after UI update
                showNotification(t(messageKey), notificationType.SUCCESS);
              }
            })
            .catch((error) => {
              console.error('Loan sync failed:', error);
            });
        } else {
          // If offline, UI was already updated above
        }
      }
      // For payments: implement offline-first approach
      else if (nodeType === 'payment' && dataDispatch && isIndexedDBAvailable()) {
        // Get loan ID from node or additionalParams
        const loanId = node.field_loan_reference?.[0] || additionalParams?.loanId || values.field_loan_reference;
        
        if (!loanId) {
          throw new Error('Loan ID is required for payment');
        }

        // Convert node to payment format
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

        // Save offline (saves locally and adds to sync queue)
        const savedId = await savePaymentOffline(loanId, paymentItem, node, formType, url, method);
        paymentItem.id = savedId;

        // Show success message
        const messageKey = successMessageKeys
          ? formType === 'add'
            ? successMessageKeys.add
            : successMessageKeys.edit
          : formType === 'add'
            ? 'notification.added'
            : 'notification.updated';
        
        // Try to sync if online, otherwise update UI with local data
        if (isOnline()) {
          // Don't update UI yet - wait for server response
        } else {
          // Update UI with local data when offline
          await updateLoansUILocally(dataDispatch);
          showNotification(t('notification.savedOffline') || 'Saved offline', notificationType.SUCCESS);
        }

        setIsSubmitting(false);
        setFormState(initialState);
        onSuccess();

        // Try to sync if online
        if (isOnline()) {
          const fetchOptions = {
            method,
            headers: new Headers({
              Accept: 'application/json',
              'Content-Type': 'application/json',
              'JWT-Authorization': 'Bearer ' + token,
            }),
            body: JSON.stringify(node),
          };

          fetch(url, fetchOptions)
            .then(async (response) => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              return response.json();
            })
            .then(async (data: NodeData) => {
              if (data.nid) {
                const serverId = data.nid[0]?.value?.toString() || data.nid.toString();
                const { savePaymentLocally } = await import('@utils/indexedDB');
                const loanId = node.field_loan_reference?.[0] || additionalParams?.loanId || values.field_loan_reference;
                
                if (formType === 'add' && paymentItem.id?.startsWith('temp_')) {
                  // Update local payment with server ID
                  const updatedPayment: any = {
                    id: serverId,
                    title: node.title?.[0] || paymentItem.title,
                    fdt: node.field_date?.[0] || paymentItem.fdt,
                    fr: node.field_rate?.[0] || paymentItem.fr,
                    fpi: node.field_pay_installment?.[0] || paymentItem.fpi,
                    fpsf: node.field_pay_single_fee?.[0] || paymentItem.fpsf,
                    fnra: node.field_new_recurring_amount?.[0] || paymentItem.fnra,
                    fisp: node.field_is_simulated_payment?.[0] || paymentItem.fisp,
                  };
                  
                  // Update local DB with server data
                  await savePaymentLocally(loanId, updatedPayment, false);
                  
                  // Remove from sync queue since we successfully synced online
                  const pendingOps = await getPendingSyncOperations();
                  const op = pendingOps.find(
                    (o) => o.localId === paymentItem.id && o.type === 'create' && o.entityType === 'payment'
                  );
                  if (op && op.id) {
                    await removeSyncOperation(op.id);
                  }
                } else if (formType === 'edit') {
                  // For edit operations, update local DB with server data
                  const updatedPayment: any = {
                    id: serverId,
                    title: node.title?.[0] || paymentItem.title,
                    fdt: node.field_date?.[0] || paymentItem.fdt,
                    fr: node.field_rate?.[0] || paymentItem.fr,
                    fpi: node.field_pay_installment?.[0] || paymentItem.fpi,
                    fpsf: node.field_pay_single_fee?.[0] || paymentItem.fpsf,
                    fnra: node.field_new_recurring_amount?.[0] || paymentItem.fnra,
                    fisp: node.field_is_simulated_payment?.[0] || paymentItem.fisp,
                  };
                  
                  // Update local DB with server data
                  await savePaymentLocally(loanId, updatedPayment, false);
                  
                  // Remove from sync queue since we successfully synced online
                  const pendingOps = await getPendingSyncOperations();
                  const op = pendingOps.find(
                    (o) => o.localId === paymentItem.id && o.type === 'update' && o.entityType === 'payment'
                  );
                  if (op && op.id) {
                    await removeSyncOperation(op.id);
                  }
                }
                
                // Update UI with latest data from local DB
                await updateLoansUILocally(dataDispatch);
                
                // Show success notification after UI update
                showNotification(t(messageKey), notificationType.SUCCESS);
              }
            })
            .catch((error) => {
              console.error('Payment sync failed:', error);
            });
        } else {
          // If offline, UI was already updated above
        }
      }
      // For transactions/income: implement offline-first approach
      else if (useFetchRequest && dataDispatch && entityType && isIndexedDBAvailable()) {
        // Convert node to expense format
        const savedItem: TransactionOrIncomeItem = {
          id: formType === 'add' ? undefined : values.nid,
          dt: node.field_date?.[0] || node.title?.[0] || new Date().toISOString().split('T')[0],
          sum: node.field_amount?.[0] || '0',
          type: nodeType === 'transaction' ? 'transaction' : 'incomes',
          cat: node.field_category?.[0],
          dsc: node.field_description?.[0],
          cr: formType === 'add' ? Date.now() : undefined,
        };

        // Save offline (saves locally and adds to sync queue)
        const savedId = await saveOffline(savedItem, node, formType, entityType, url, method);
        savedItem.id = savedId;

        // Show success message
        const messageKey = successMessageKeys
          ? formType === 'add'
            ? successMessageKeys.add
            : successMessageKeys.edit
          : formType === 'add'
            ? 'notification.added'
            : 'notification.updated';
        
        // Try to sync if online, otherwise update UI with local data
        if (isOnline()) {
          // Don't update UI yet - wait for server response
        } else {
          // Update UI with local data when offline
          await updateUILocally(dataDispatch);
          showNotification(t('notification.savedOffline') || 'Saved offline', notificationType.SUCCESS);
        }

        setIsSubmitting(false);
        setFormState(initialState);
        onSuccess();

        // Try to sync if online
        if (isOnline()) {
          const fetchOptions = {
            method,
            headers: new Headers({
              Accept: 'application/json',
              'Content-Type': 'application/json',
              'JWT-Authorization': 'Bearer ' + token,
            }),
            body: JSON.stringify(node),
          };

          fetchRequest(
            url,
            fetchOptions,
            dataDispatch,
            dispatch,
            async (data: NodeData | string | null) => {
              if (typeof data === 'string' || data === null) {
                // Network error - already saved offline
                return;
              }

              if (data.nid) {
                const serverId = data.nid[0]?.value?.toString() || data.nid.toString();
                const { openDB, saveExpenseLocally } = await import('@utils/indexedDB');
                
                if (formType === 'add' && savedItem.id?.startsWith('temp_')) {
                  // Update local item with server ID
                  const db = await openDB();
                  const transaction = db.transaction('expenses', 'readwrite');
                  const store = transaction.objectStore('expenses');
                  
                  const localItem = await new Promise<any>((resolve) => {
                    const req = store.get(savedItem.id);
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => resolve(null);
                  });

                  if (localItem) {
                    await new Promise<void>((resolve) => {
                      const delReq = store.delete(savedItem.id!);
                      delReq.onsuccess = () => resolve();
                      delReq.onerror = () => resolve();
                    });
                    
                    localItem.id = serverId;
                    await new Promise<void>((resolve) => {
                      const putReq = store.put(localItem);
                      putReq.onsuccess = () => resolve();
                      putReq.onerror = () => resolve();
                    });
                  }
                  transaction.oncomplete = () => db.close();
                  
                  // Remove from sync queue since we successfully synced online
                  const pendingOps = await getPendingSyncOperations();
                  const op = pendingOps.find(
                    (o) => o.localId === savedItem.id && o.type === 'create' && o.entityType === entityType
                  );
                  if (op && op.id) {
                    await removeSyncOperation(op.id);
                  }
                } else if (formType === 'edit') {
                  // For edit operations, update local DB with server data
                  const updatedItem: TransactionOrIncomeItem = {
                    id: serverId,
                    dt: node.field_date?.[0] || node.title?.[0] || savedItem.dt,
                    sum: node.field_amount?.[0] || savedItem.sum,
                    type: savedItem.type,
                    cat: node.field_category?.[0] || savedItem.cat,
                    dsc: node.field_description?.[0] || savedItem.dsc,
                  };
                  
                  // Update local DB with server data
                  await saveExpenseLocally(updatedItem, false);
                  
                  // Remove from sync queue since we successfully synced online
                  const pendingOps = await getPendingSyncOperations();
                  const op = pendingOps.find(
                    (o) => o.localId === savedItem.id && o.type === 'update' && o.entityType === entityType
                  );
                  if (op && op.id) {
                    await removeSyncOperation(op.id);
                  }
                }
                
                // Update UI with latest data from local DB
                await updateUILocally(dataDispatch);
                
                // Show success notification after UI update
                showNotification(t(messageKey), notificationType.SUCCESS);
              }
            }
          );
        } else {
          // If offline, UI was already updated above
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
              console.error('Operation failed:', error);
              showNotification(t('error.unknown'), notificationType.ERROR);
              setIsSubmitting(false);
            });
        }
      }
    } catch (error) {
      console.error('Form submission error:', error);
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
