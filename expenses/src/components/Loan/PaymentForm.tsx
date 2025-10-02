import React from 'react';
import { useData } from '@context/context';
import { useLocalization } from '@context/localization';
import { DataState } from '@type/types';
import { addOneDay } from '@utils/utils';
import { useFormSubmit } from '@hooks/useFormSubmit';
import { useFormValidation } from '@hooks/useFormValidation';
import { useParams } from 'react-router-dom';
import './PaymentForm.scss';

interface PaymentFormProps {
  formType: 'add' | 'edit';
  values: any;
  onSuccess: () => void;
  startDate?: string;
  endDate?: string;
}

const PaymentForm: React.FC<PaymentFormProps> = ({
  formType,
  values,
  onSuccess,
  startDate,
  endDate,
}) => {
  const { id } = useParams();
  const { t } = useLocalization();
  const { dataDispatch } = useData() as DataState;
  
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

  const { formState, isSubmitting, handleChange, handleSubmit } = useFormSubmit({
    formType,
    initialState: formType === 'add' ? initialState : initialValues,
    values,
    nodeType: 'payment',
    onSuccess,
    useFetchRequest: false,
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
  });

  return (
    <div className="payment-form-container">
      <form className="payment-form" onSubmit={handleSubmit}>
        <div className="form-group required">
          <label>{t('paymentForm.paymentTitle')}</label>
          <div className="input-wrapper">
            <input
              required
              type="text"
              name="title"
              placeholder={t('paymentForm.enterPaymentTitle')}
              value={formState.title}
              onChange={handleChange}
              className={`form-input ${getFieldValidation('title', formState) ? 'valid' : ''}`}
            />
          </div>
        </div>

        <div className="form-group required">
          <label>{t('paymentForm.paymentDate')}</label>
          <div className="input-wrapper">
            <input
              required
              type="date"
              name="field_date"
              value={formState.field_date}
              onChange={handleChange}
              className={`form-input ${getFieldValidation('field_date', formState) ? 'valid' : ''}`}
            />
          </div>
        </div>

        <div className="form-group">
          <label>{t('paymentForm.newInterestRate')}</label>
          <div className="input-wrapper">
            <input
              type="number"
              name="field_rate"
              value={formState.field_rate}
              onChange={handleChange}
              step="0.01"
              min="0"
              className={`form-input ${getFieldValidation('field_rate', formState) ? 'valid' : ''}`}
            />
          </div>
        </div>

        <div className="form-group">
          <label>{t('paymentForm.installmentPayment')}</label>
          <div className="input-wrapper">
            <input
              type="number"
              name="field_pay_installment"
              value={formState.field_pay_installment}
              onChange={handleChange}
              step="0.01"
              min="0"
              className={`form-input ${getFieldValidation('field_pay_installment', formState) ? 'valid' : ''}`}
            />
          </div>
        </div>

        <div className="form-group">
          <label>{t('paymentForm.individualFee')}</label>
          <div className="input-wrapper">
            <input
              type="number"
              name="field_pay_single_fee"
              value={formState.field_pay_single_fee}
              onChange={handleChange}
              step="0.01"
              min="0"
              className={`form-input ${getFieldValidation('field_pay_single_fee', formState) ? 'valid' : ''}`}
            />
          </div>
        </div>

        <div className="form-group">
          <label>{t('paymentForm.newRecurringAmount')}</label>
          <div className="input-wrapper">
            <input
              type="number"
              name="field_new_recurring_amount"
              value={formState.field_new_recurring_amount}
              onChange={handleChange}
              step="0.01"
              min="0"
              className={`form-input ${getFieldValidation('field_new_recurring_amount', formState) ? 'valid' : ''}`}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="field_is_simulated_payment"
              checked={formState.field_is_simulated_payment}
              onChange={handleChange}
            />
            <span>{t('paymentForm.simulatedPayment')}</span>
          </label>
        </div>

        <div className="form-actions">
          <button type="submit" disabled={isSubmitting} className="btn-submit">
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
      </form>
    </div>
  );
};

export default PaymentForm;
