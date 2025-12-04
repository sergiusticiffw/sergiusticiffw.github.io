import { useState, useCallback } from 'react';
import { useAuthState } from '@context/context';
import { useNotification } from '@context/notification';
import { AuthState } from '@type/types';
import {
  handleFormSubmission,
  createLoadingState,
  validateForm,
  getCurrentDate,
} from '@utils/commonUtils';
import { logger } from '@utils/logger';
import { API_BASE_URL } from '@utils/utils';

interface UseFormOptions<T> {
  initialValues: T;
  requiredFields?: (keyof T)[];
  onSuccess?: () => void;
  successMessage?: string;
  errorMessage?: string;
  apiUrl: string;
  method: 'POST' | 'PATCH';
  transformData?: (data: T) => any;
}

export const useForm = <T extends Record<string, any>>(
  options: UseFormOptions<T>
) => {
  const {
    initialValues,
    requiredFields = [],
    onSuccess,
    successMessage = 'Success!',
    errorMessage = 'Something went wrong, please try again.',
    apiUrl,
    method,
    transformData,
  } = options;

  const [formData, setFormData] = useState<T>(initialValues);
  const { isLoading, startLoading, stopLoading } = createLoadingState();
  const { token } = useAuthState() as AuthState;
  const showNotification = useNotification();

  const handleChange = useCallback(
    (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      const { name, value, type } = event.target;
      const checked = (event.target as HTMLInputElement).checked;

      setFormData((prev) => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }));
    },
    []
  );

  const resetForm = useCallback(() => {
    setFormData(initialValues);
  }, [initialValues]);

  const setFieldValue = useCallback((name: keyof T, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const validate = useCallback((): string[] => {
    return validateForm(formData, requiredFields as string[]);
  }, [formData, requiredFields]);

  const handleSubmit = useCallback(
    async (event?: React.FormEvent) => {
      if (event) {
        event.preventDefault();
      }

      const errors = validate();
      if (errors.length > 0) {
        errors.forEach((error) => showNotification(error, 'error'));
        return;
      }

      startLoading();

      try {
        const dataToSend = transformData ? transformData(formData) : formData;

        await handleFormSubmission(
          apiUrl,
          method,
          dataToSend,
          token,
          null, // dataDispatch - not needed for this hook
          null, // dispatch - not needed for this hook
          () => {
            resetForm();
            onSuccess?.();
          },
          showNotification,
          successMessage,
          errorMessage
        );
      } catch (error) {
        logger.error('Form submission error:', error);
        showNotification(errorMessage, 'error');
      } finally {
        stopLoading();
      }
    },
    [
      formData,
      validate,
      startLoading,
      stopLoading,
      apiUrl,
      method,
      token,
      transformData,
      resetForm,
      onSuccess,
      showNotification,
      successMessage,
      errorMessage,
    ]
  );

  return {
    formData,
    isLoading,
    handleChange,
    handleSubmit,
    resetForm,
    setFieldValue,
    validate,
  };
};

// Specialized hooks for common form types
export const useTransactionForm = (
  formType: 'add' | 'edit',
  values?: any,
  onSuccess?: () => void
) => {
  const initialValues = {
    field_amount: '',
    field_date: getCurrentDate(),
    field_category: '',
    field_description: '',
    ...values,
  };

  const requiredFields: (keyof typeof initialValues)[] = [
    'field_amount',
    'field_date',
    'field_category',
  ];

  const transformData = (data: typeof initialValues) => ({
    type: 'transaction',
    title: [data.field_date],
    field_amount: [data.field_amount],
    field_category: [data.field_category],
    field_date: [data.field_date],
    field_description: [data.field_description],
  });

  const apiUrl =
    formType === 'add'
      ? `${API_BASE_URL}/node?_format=json`
      : `${API_BASE_URL}/node/${values?.nid}?_format=json`;

  return useForm({
    initialValues,
    requiredFields,
    onSuccess,
    apiUrl,
    method: formType === 'add' ? 'POST' : 'PATCH',
    transformData,
  });
};

export const useIncomeForm = (
  formType: 'add' | 'edit',
  values?: any,
  onSuccess?: () => void
) => {
  const initialValues = {
    field_amount: '',
    field_date: getCurrentDate(),
    field_description: '',
    ...values,
  };

  const requiredFields: (keyof typeof initialValues)[] = [
    'field_amount',
    'field_date',
    'field_description',
  ];

  const transformData = (data: typeof initialValues) => ({
    type: 'incomes',
    title: [data.field_date],
    field_amount: [data.field_amount],
    field_date: [data.field_date],
    field_description: [data.field_description],
  });

  const apiUrl =
    formType === 'add'
      ? `${API_BASE_URL}/node?_format=json`
      : `${API_BASE_URL}/node/${values?.nid}?_format=json`;

  return useForm({
    initialValues,
    requiredFields,
    onSuccess,
    apiUrl,
    method: formType === 'add' ? 'POST' : 'PATCH',
    transformData,
  });
};
