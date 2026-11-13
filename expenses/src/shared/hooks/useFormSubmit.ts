import { useState } from 'react';
import { useAuthDispatch, useAuthState } from '@shared/context/context';
import { useNotification } from '@shared/context/notification';
import { useLocalization } from '@shared/context/localization';
import { notificationType } from '@shared/utils/constants';
import { TransactionOrIncomeItem } from '@shared/type/types';
import { isIndexedDBAvailable, isOnline } from '@shared/utils/indexedDB';
import {
  saveOffline,
  updateUILocally,
  saveLoanOffline,
  savePaymentOffline,
  updateLoansUILocally,
} from '@shared/utils/offlineAPI';
import { logger } from '@shared/utils/logger';
import { sanitizeFormField } from '@shared/utils/sanitization';
import { isWriteBlocked, refreshStatus } from '../../crypto/encryptionState';
import { encodeNodeBody } from '../../crypto/nodeCodec';
import { getDataProvider } from '../../data';
import type { WriteResult } from '../../data';

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
  useFetchRequest?: boolean;
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

async function providerWrite(
  token: string,
  nodeType: string,
  isAdd: boolean,
  id: string | undefined,
  body: unknown
): Promise<WriteResult> {
  const provider = getDataProvider();
  provider.configure(token);

  let result;
  if (nodeType === 'loan') {
    result = isAdd
      ? await provider.createLoan(body)
      : await provider.updateLoan(String(id), body);
  } else if (nodeType === 'payment') {
    result = isAdd
      ? await provider.createPayment(body)
      : await provider.updatePayment(String(id), body);
  } else {
    result = isAdd
      ? await provider.createTransaction(body)
      : await provider.updateTransaction(String(id), body);
  }

  if (!result.success || !result.data?.id) {
    throw result.error || new Error('No ID returned from server');
  }
  return result.data;
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
  const { token } = useAuthState();
  const showNotification = useNotification();
  const { t } = useLocalization();

  const isAdd = formType === 'add';
  const addInitialState =
    isAdd && values && typeof values === 'object' && !values.nid
      ? { ...initialState, ...values }
      : initialState;
  const editInitialState =
    !isAdd && values && typeof values === 'object'
      ? { ...initialState, ...values }
      : initialState;
  const [formState, setFormState] = useState<T>(
    isAdd ? addInitialState : (editInitialState as T)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    let value: string | boolean;

    if (event.target.type === 'checkbox') {
      value = (event.target as HTMLInputElement).checked;
    } else {
      const fieldType = event.target.type as
        | 'text'
        | 'number'
        | 'date'
        | 'email'
        | 'url';
      value = sanitizeFormField(event.target.value, fieldType);
    }

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

      const method = isAdd ? 'POST' : 'PATCH';
      const editId = values?.nid ? String(values.nid) : undefined;
      // Legacy URL kept for offline queue compatibility with older ops.
      const url = isAdd ? 'provider:create' : `provider:update:${editId}`;

      const isMoney = nodeType === 'transaction' || nodeType === 'incomes';
      const isProtected =
        isMoney || nodeType === 'loan' || nodeType === 'payment';
      let outgoing = node;
      let holdSend = false;
      if (isProtected) {
        await refreshStatus(true);
        if (isWriteBlocked()) {
          showNotification(t('privacy.writePaused'), notificationType.ERROR);
          setIsSubmitting(false);
          return;
        }
        const encoded = await encodeNodeBody(node);
        if (encoded.kind === 'hold') {
          holdSend = true;
        } else {
          outgoing = encoded.body;
        }
      }

      const entityType =
        nodeType === 'transaction' || nodeType === 'incomes'
          ? nodeType === 'transaction'
            ? 'expense'
            : 'income'
          : null;

      const messageKey = successMessageKeys
        ? isAdd
          ? successMessageKeys.add
          : successMessageKeys.edit
        : isAdd
          ? 'notification.added'
          : 'notification.updated';

      if (nodeType === 'loan' && dataDispatch && isIndexedDBAvailable()) {
        if (isOnline() && !holdSend) {
          try {
            const write = await providerWrite(
              token,
              nodeType,
              isAdd,
              editId,
              outgoing
            );
            const { saveLoanLocally } = await import('@shared/utils/indexedDB');
            const loanToSave: any = {
              id: write.id,
              title: node.title?.[0] || '',
              fp: node.field_principal?.[0] || '',
              sdt: node.field_start_date?.[0] || '',
              edt: node.field_end_date?.[0] || '',
              fr: node.field_rate?.[0] || '',
              fpm: node.field_payment_method?.[0] || 'equal_installment',
              fif: node.field_initial_fee?.[0] || '',
              pdt: node.field_rec_first_payment_date?.[0] || '',
              frpd: node.field_recurring_payment_day?.[0] || '',
              fls: node.field_loan_status?.[0] || 'draft',
              cr: isAdd ? Date.now() : undefined,
            };
            await saveLoanLocally(loanToSave, isAdd);
            await updateLoansUILocally(dataDispatch);
            showNotification(t(messageKey), notificationType.SUCCESS);
            setIsSubmitting(false);
            setFormState(initialState);
            onSuccess();
          } catch (error) {
            logger.error(
              'Online request failed, falling back to offline:',
              error
            );
            const loanItem: any = {
              id: isAdd ? undefined : values.nid,
              title: node.title?.[0] || '',
              fp: node.field_principal?.[0] || '',
              sdt: node.field_start_date?.[0] || '',
              edt: node.field_end_date?.[0] || '',
              fr: node.field_rate?.[0] || '',
              fpm: node.field_payment_method?.[0] || 'equal_installment',
              fif: node.field_initial_fee?.[0] || '',
              pdt: node.field_rec_first_payment_date?.[0] || '',
              frpd: node.field_recurring_payment_day?.[0] || '',
              fls: node.field_loan_status?.[0] || 'draft',
              cr: isAdd ? Date.now() : undefined,
            };
            await saveLoanOffline(loanItem, node, formType, url, method);
            await updateLoansUILocally(dataDispatch);
            showNotification(
              t('notification.savedOffline') || 'Saved offline',
              notificationType.SUCCESS
            );
            setIsSubmitting(false);
            setFormState(initialState);
            onSuccess();
          }
        } else {
          const loanItem: any = {
            id: isAdd ? undefined : values.nid,
            title: node.title?.[0] || '',
            fp: node.field_principal?.[0] || '',
            sdt: node.field_start_date?.[0] || '',
            edt: node.field_end_date?.[0] || '',
            fr: node.field_rate?.[0] || '',
            fpm: node.field_payment_method?.[0] || 'equal_installment',
            fif: node.field_initial_fee?.[0] || '',
            pdt: node.field_rec_first_payment_date?.[0] || '',
            frpd: node.field_recurring_payment_day?.[0] || '',
            fls: node.field_loan_status?.[0] || 'draft',
            cr: isAdd ? Date.now() : undefined,
          };
          await saveLoanOffline(loanItem, node, formType, url, method);
          await updateLoansUILocally(dataDispatch);
          showNotification(
            t('notification.savedOffline') || 'Saved offline',
            notificationType.SUCCESS
          );
          setIsSubmitting(false);
          setFormState(initialState);
          onSuccess();
        }
      } else if (
        nodeType === 'payment' &&
        dataDispatch &&
        isIndexedDBAvailable()
      ) {
        const loanId =
          node.field_loan_reference?.[0] ||
          additionalParams?.loanId ||
          values.field_loan_reference;

        if (!loanId) {
          throw new Error('Loan ID is required for payment');
        }

        if (isOnline() && !holdSend) {
          try {
            const write = await providerWrite(
              token,
              nodeType,
              isAdd,
              editId,
              outgoing
            );
            const { savePaymentLocally } =
              await import('@shared/utils/indexedDB');
            const paymentToSave: any = {
              id: write.id,
              title: node.title?.[0] || '',
              fdt: node.field_date?.[0] || '',
              fr: node.field_rate?.[0] || '',
              fpi: node.field_pay_installment?.[0] || '',
              fpsf: node.field_pay_single_fee?.[0] || '',
              fnra: node.field_new_recurring_amount?.[0] || '',
              fnp: node.field_new_principal?.[0] || '',
              fpm: node.field_payment_method?.[0] || '',
              fisp: node.field_is_simulated_payment?.[0] || 0,
              cr: isAdd ? Date.now() : undefined,
            };
            await savePaymentLocally(loanId, paymentToSave, isAdd);
            await updateLoansUILocally(dataDispatch);
            showNotification(t(messageKey), notificationType.SUCCESS);
            setIsSubmitting(false);
            setFormState(initialState);
            onSuccess();
          } catch (error) {
            logger.error(
              'Online request failed, falling back to offline:',
              error
            );
            const paymentItem: any = {
              id: isAdd ? undefined : values.nid,
              title: node.title?.[0] || '',
              fdt: node.field_date?.[0] || '',
              fr: node.field_rate?.[0] || '',
              fpi: node.field_pay_installment?.[0] || '',
              fpsf: node.field_pay_single_fee?.[0] || '',
              fnra: node.field_new_recurring_amount?.[0] || '',
              fnp: node.field_new_principal?.[0] || '',
              fpm: node.field_payment_method?.[0] || '',
              fisp: node.field_is_simulated_payment?.[0] || 0,
              cr: isAdd ? Date.now() : undefined,
            };
            await savePaymentOffline(
              loanId,
              paymentItem,
              node,
              formType,
              url,
              method
            );
            await updateLoansUILocally(dataDispatch);
            showNotification(
              t('notification.savedOffline') || 'Saved offline',
              notificationType.SUCCESS
            );
            setIsSubmitting(false);
            setFormState(initialState);
            onSuccess();
          }
        } else {
          const paymentItem: any = {
            id: isAdd ? undefined : values.nid,
            title: node.title?.[0] || '',
            fdt: node.field_date?.[0] || '',
            fr: node.field_rate?.[0] || '',
            fpi: node.field_pay_installment?.[0] || '',
            fpsf: node.field_pay_single_fee?.[0] || '',
            fnra: node.field_new_recurring_amount?.[0] || '',
            fnp: node.field_new_principal?.[0] || '',
            fpm: node.field_payment_method?.[0] || '',
            fisp: node.field_is_simulated_payment?.[0] || 0,
            cr: isAdd ? Date.now() : undefined,
          };
          await savePaymentOffline(
            loanId,
            paymentItem,
            node,
            formType,
            url,
            method
          );
          await updateLoansUILocally(dataDispatch);
          showNotification(
            t('notification.savedOffline') || 'Saved offline',
            notificationType.SUCCESS
          );
          setIsSubmitting(false);
          setFormState(initialState);
          onSuccess();
        }
      } else if (
        useFetchRequest &&
        dataDispatch &&
        entityType &&
        isIndexedDBAvailable()
      ) {
        if (isOnline() && !holdSend) {
          try {
            const write = await providerWrite(
              token,
              nodeType,
              isAdd,
              editId,
              outgoing
            );
            const { saveExpenseLocally } =
              await import('@shared/utils/indexedDB');
            const itemToSave: TransactionOrIncomeItem = {
              id: write.id,
              dt:
                node.field_date?.[0] ||
                node.title?.[0] ||
                new Date().toISOString().split('T')[0],
              sum: node.field_amount?.[0] || '0',
              type: nodeType === 'transaction' ? 'transaction' : 'incomes',
              cat: node.field_category?.[0],
              dsc: node.field_description?.[0],
              cr: isAdd ? Date.now() : undefined,
            };
            await saveExpenseLocally(itemToSave, isAdd);
            await updateUILocally(dataDispatch);
            showNotification(t(messageKey), notificationType.SUCCESS);
            setIsSubmitting(false);
            setFormState(initialState);
            onSuccess();
          } catch (error) {
            logger.error(
              'Online request failed, falling back to offline:',
              error
            );
            const savedItem: TransactionOrIncomeItem = {
              id: isAdd ? undefined : values.nid,
              dt:
                node.field_date?.[0] ||
                node.title?.[0] ||
                new Date().toISOString().split('T')[0],
              sum: node.field_amount?.[0] || '0',
              type: nodeType === 'transaction' ? 'transaction' : 'incomes',
              cat: node.field_category?.[0],
              dsc: node.field_description?.[0],
              cr: isAdd ? Date.now() : undefined,
            };
            await saveOffline(
              savedItem,
              node,
              formType,
              entityType,
              url,
              method
            );
            await updateUILocally(dataDispatch);
            showNotification(
              t('notification.savedOffline') || 'Saved offline',
              notificationType.SUCCESS
            );
            setIsSubmitting(false);
            setFormState(initialState);
            onSuccess();
          }
        } else {
          const savedItem: TransactionOrIncomeItem = {
            id: isAdd ? undefined : values.nid,
            dt:
              node.field_date?.[0] ||
              node.title?.[0] ||
              new Date().toISOString().split('T')[0],
            sum: node.field_amount?.[0] || '0',
            type: nodeType === 'transaction' ? 'transaction' : 'incomes',
            cat: node.field_category?.[0],
            dsc: node.field_description?.[0],
            cr: isAdd ? Date.now() : undefined,
          };
          await saveOffline(savedItem, node, formType, entityType, url, method);
          await updateUILocally(dataDispatch);
          showNotification(
            t('notification.savedOffline') || 'Saved offline',
            notificationType.SUCCESS
          );
          setIsSubmitting(false);
          setFormState(initialState);
          onSuccess();
        }
      } else {
        if (isProtected && holdSend) {
          showNotification(t('privacy.writePaused'), notificationType.ERROR);
          setIsSubmitting(false);
          return;
        }
        try {
          await providerWrite(
            token,
            nodeType,
            isAdd,
            editId,
            isProtected ? outgoing : node
          );
          onSuccess();
          showNotification(t(messageKey), notificationType.SUCCESS);
          setIsSubmitting(false);
          setFormState(initialState);
        } catch (error) {
          logger.error('Operation failed:', error);
          showNotification(t('error.unknown'), notificationType.ERROR);
          setIsSubmitting(false);
        }
      }
    } catch (error) {
      const paused = error instanceof Error && error.message === 'write-blocked';
      logger.error('Form submission error:', error);
      showNotification(
        t(paused ? 'privacy.writePaused' : 'error.unknown'),
        notificationType.ERROR
      );
      setIsSubmitting(false);
      if (!paused) onSuccess();
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
