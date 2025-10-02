import { useState } from 'react';
import { useAuthDispatch, useAuthState } from '@context/context';
import { useNotification } from '@context/notification';
import { useLocalization } from '@context/localization';
import { fetchRequest } from '@utils/utils';
import { notificationType } from '@utils/constants';
import { AuthState, NodeData } from '@type/types';

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
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
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
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const value = event.target.type === 'checkbox' 
      ? (event.target as HTMLInputElement).checked 
      : event.target.value;
    
    setFormState({
      ...formState,
      [event.target.name]: value,
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    const node = {
      type: nodeType,
      ...buildNodeData(formState, additionalParams),
    };

    const fetchOptions = {
      method: formType === 'add' ? 'POST' : 'PATCH',
      headers: new Headers({
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'JWT-Authorization': 'Bearer ' + token,
      }),
      body: JSON.stringify(node),
    };

    const url =
      formType === 'add'
        ? 'https://dev-expenses-api.pantheonsite.io/node?_format=json'
        : `https://dev-expenses-api.pantheonsite.io/node/${values.nid}?_format=json`;

    if (useFetchRequest && dataDispatch) {
      // Use fetchRequest utility (for transactions, income)
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
      // Use direct fetch (for loans, payments)
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
  };

  return {
    formState,
    setFormState,
    isSubmitting,
    handleChange,
    handleSubmit,
  };
};

