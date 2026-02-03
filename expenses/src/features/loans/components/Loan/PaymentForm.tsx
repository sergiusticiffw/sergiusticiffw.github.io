import React from 'react';
import { useLocalization } from '@shared/context/localization';
import { useFormSubmit } from '@shared/hooks/useFormSubmit';
import { useFormValidation } from '@shared/hooks/useFormValidation';
import { useParams } from '@tanstack/react-router';
import { FormField } from '@shared/components/Common';
import { useLoan } from '@shared/context/loan';
interface PaymentFormProps {
  formType: 'add' | 'edit';
  values: any;
  onSuccess: () => void;
  startDate?: string;
  endDate?: string;
  hideSubmitButton?: boolean;
  onFormReady?: (submitHandler: () => void, isSubmitting: boolean) => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({
  formType,
  values,
  onSuccess,
  startDate,
  endDate,
  hideSubmitButton = false,
  onFormReady,
}) => {
  const { id } = useParams({ from: '/expenses/loan/$id' });
  const { t } = useLocalization();
  const { dataDispatch } = useLoan();

  const initialState = {
    field_date: new Date().toISOString().slice(0, 10),
    title: '',
    field_rate: '',
    field_pay_installment: '',
    field_pay_single_fee: '',
    field_new_recurring_amount: '',
    field_loan_reference: id,
    field_is_simulated_payment: false,
  };

  const initialValues = {
    title: values.title || '',
    field_date: values.field_date || new Date().toISOString().slice(0, 10),
    field_rate: values.field_rate || '',
    field_pay_installment: values.field_pay_installment || '',
    field_pay_single_fee: values.field_pay_single_fee || '',
    field_new_recurring_amount: values.field_new_recurring_amount || '',
    field_loan_reference: id,
    field_is_simulated_payment: values.field_is_simulated_payment || false,
  };

  const validationRules = {
    title: { required: true },
    field_date: {
      required: true,
      custom: (value: any) => {
        if (!value) return false;
        if (!startDate || !endDate) return true; // Skip validation if dates not provided
        const date = new Date(value);
        const start = new Date(startDate);
        const end = new Date(endDate);
        return date >= start && date <= end;
      },
    },
    field_rate: {
      required: false,
      custom: (value: any) => {
        if (!value) return false;
        const strValue = String(value).trim();
        if (strValue === '') return false;
        const num = parseFloat(strValue);
        return !isNaN(num) && num > 0;
      },
    },
    field_pay_installment: {
      required: false,
      custom: (value: any) => {
        if (!value) return false;
        const strValue = String(value).trim();
        if (strValue === '') return false;
        const num = parseFloat(strValue);
        return !isNaN(num) && num > 0;
      },
    },
    field_pay_single_fee: {
      required: false,
      custom: (value: any) => {
        if (!value) return false;
        const strValue = String(value).trim();
        if (strValue === '') return false;
        const num = parseFloat(strValue);
        return !isNaN(num) && num > 0;
      },
    },
    field_new_recurring_amount: {
      required: false,
      custom: (value: any) => {
        if (!value) return false;
        const strValue = String(value).trim();
        if (strValue === '') return false;
        const num = parseFloat(strValue);
        return !isNaN(num) && num > 0;
      },
    },
  };

  const { getFieldValidation } = useFormValidation(validationRules);

  const { formState, isSubmitting, handleChange, handleSubmit } = useFormSubmit(
    {
      formType,
      initialState: formType === 'add' ? initialState : initialValues,
      values,
      nodeType: 'payment',
      onSuccess,
      dataDispatch,
      useFetchRequest: false,
      additionalParams: { loanId: id },
      buildNodeData: (state) => ({
        title: [state.title],
        field_date: [state.field_date],
        field_rate: [state.field_rate],
        field_pay_installment: [state.field_pay_installment],
        field_pay_single_fee: [state.field_pay_single_fee],
        field_new_recurring_amount: [state.field_new_recurring_amount],
        field_is_simulated_payment: [state.field_is_simulated_payment ? 1 : 0],
        field_loan_reference: [id],
      }),
      successMessageKeys: {
        add: 'notification.paymentAdded',
        edit: 'notification.paymentUpdated',
      },
    }
  );

  // Expose form submit handler and state to parent if needed
  React.useEffect(() => {
    if (onFormReady) {
      onFormReady(() => {
        const form = document.querySelector(
          `.payment-form-${formType}`
        ) as HTMLFormElement;
        if (form) {
          form.requestSubmit();
        }
      }, isSubmitting);
    }
  }, [onFormReady, isSubmitting, formType]);

  return (
    <div className="payment-form-container">
      <form
        id={`payment-form-${formType}`}
        className={`payment-form payment-form-${formType}`}
        onSubmit={handleSubmit}
      >
        <FormField
          name="title"
          type="text"
          label={t('paymentForm.paymentTitle')}
          value={formState.title}
          onChange={handleChange}
          required
          placeholder={t('paymentForm.enterPaymentTitle')}
          isValid={getFieldValidation('title', formState)}
          ariaLabel={t('paymentForm.paymentTitle')}
        />

        <FormField
          name="field_date"
          type="date"
          label={t('paymentForm.paymentDate')}
          value={formState.field_date}
          onChange={handleChange}
          required
          isValid={getFieldValidation('field_date', formState)}
          ariaLabel={t('paymentForm.paymentDate')}
        />

        <FormField
          name="field_rate"
          type="number"
          label={t('paymentForm.newInterestRate')}
          value={formState.field_rate}
          onChange={handleChange}
          step="0.01"
          min="0"
          isValid={getFieldValidation('field_rate', formState)}
          ariaLabel={t('paymentForm.newInterestRate')}
        />

        <FormField
          name="field_pay_installment"
          type="number"
          label={t('paymentForm.installmentPayment')}
          value={formState.field_pay_installment}
          onChange={handleChange}
          step="0.01"
          min="0"
          isValid={getFieldValidation('field_pay_installment', formState)}
          ariaLabel={t('paymentForm.installmentPayment')}
        />

        <FormField
          name="field_pay_single_fee"
          type="number"
          label={t('paymentForm.individualFee')}
          value={formState.field_pay_single_fee}
          onChange={handleChange}
          step="0.01"
          min="0"
          isValid={getFieldValidation('field_pay_single_fee', formState)}
          ariaLabel={t('paymentForm.individualFee')}
        />

        <FormField
          name="field_new_recurring_amount"
          type="number"
          label={t('paymentForm.newRecurringAmount')}
          value={formState.field_new_recurring_amount}
          onChange={handleChange}
          step="0.01"
          min="0"
          isValid={getFieldValidation('field_new_recurring_amount', formState)}
          ariaLabel={t('paymentForm.newRecurringAmount')}
        />

        <div className="flex items-center gap-3 py-3 px-0 [&_input]:w-5 [&_input]:h-5 [&_input]:min-w-5 [&_input]:min-h-5 [&_input]:accent-[#5b8def] [&_input]:cursor-pointer [&_input]:shrink-0 [&_input]:rounded [&_input]:border-white/20">
          <input
            type="checkbox"
            id="field_is_simulated_payment"
            name="field_is_simulated_payment"
            checked={formState.field_is_simulated_payment}
            onChange={handleChange}
          />
          <label
            htmlFor="field_is_simulated_payment"
            className="text-sm text-white/90 cursor-pointer select-none m-0 flex-1"
          >
            {t('paymentForm.simulatedPayment')}
          </label>
        </div>

        {!hideSubmitButton && (
          <div className="form-actions-sticky">
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-submit"
            >
              {isSubmitting ? (
                <div className="loader">
                  <span className="loader__element"></span>
                  <span className="loader__element"></span>
                  <span className="loader__element"></span>
                </div>
              ) : formType === 'add' ? (
                t('common.add')
              ) : (
                t('common.save')
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default PaymentForm;
