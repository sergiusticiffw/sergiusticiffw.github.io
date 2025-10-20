import React, { useRef, useEffect } from 'react';
import { useLocalization } from '@context/localization';
import { useNotification } from '@context/notification';
import { notificationType } from '@utils/constants';
import { useFormSubmit } from '@hooks/useFormSubmit';
import { useFormValidation } from '@hooks/useFormValidation';
import './LoanForm.scss';

interface LoanFormProps {
  formType: 'add' | 'edit';
  values?: any;
  onSuccess?: () => void;
}

const LoanForm: React.FC<LoanFormProps> = ({
  formType,
  values = {},
  onSuccess = () => {},
}) => {
  const { t } = useLocalization();
  const showNotification = useNotification();

  const initialState = {
    title: '',
    field_principal: '',
    field_start_date: new Date().toISOString().slice(0, 10),
    field_end_date: new Date().toISOString().slice(0, 10),
    field_rate: '',
    field_initial_fee: '',
    field_rec_first_payment_date: '',
    field_recurring_payment_day: '',
    field_loan_status: 'draft',
  };

  const { formState, isSubmitting, handleChange, handleSubmit } = useFormSubmit(
    {
      formType,
      initialState,
      values,
      nodeType: 'loan',
      onSuccess,
      useFetchRequest: false,
      buildNodeData: (state) => ({
        title: [state.title],
        field_principal: [state.field_principal],
        field_start_date: [state.field_start_date],
        field_end_date: [state.field_end_date],
        field_rate: [state.field_rate],
        field_initial_fee: [state.field_initial_fee],
        field_rec_first_payment_date: [state.field_rec_first_payment_date],
        field_recurring_payment_day: [state.field_recurring_payment_day],
        field_loan_status: [state.field_loan_status],
      }),
      successMessageKeys: {
        add: 'notification.loanAdded',
        edit: 'notification.loanUpdated',
      },
    }
  );

  const validationRules = {
    title: { required: true },
    field_principal: {
      required: true,
      custom: (value: any) => {
        if (!value) return false;
        const num = parseFloat(String(value));
        return !isNaN(num) && num > 0;
      },
    },
    field_rate: {
      required: true,
      custom: (value: any) => {
        if (!value) return false;
        const num = parseFloat(String(value));
        return !isNaN(num) && num >= 0;
      },
    },
    field_start_date: {
      required: true,
      // No custom validation - start date can be any date
    },
    field_end_date: {
      required: true,
      custom: (value: any, state: any) => {
        if (!value) return false;
        const currentState = state || formState;
        if (!currentState || !currentState.field_start_date) return true;
        const endDate = new Date(value);
        const startDate = new Date(currentState.field_start_date);
        // End date must be GREATER than start date (not equal)
        return endDate > startDate;
      },
    },
    field_initial_fee: {
      required: false,
      custom: (value: any) => {
        if (!value) return false;
        const strValue = String(value).trim();
        if (strValue === '') return false;
        const num = parseFloat(strValue);
        return !isNaN(num) && num >= 0;
      },
    },
    field_rec_first_payment_date: {
      required: false,
      custom: (value: any, state: any) => {
        if (!value) return true; // Optional field, empty is valid
        const currentState = state || formState;
        if (
          !currentState ||
          !currentState.field_start_date ||
          !currentState.field_end_date
        )
          return true;
        const paymentDate = new Date(value);
        const startDate = new Date(currentState.field_start_date);
        const endDate = new Date(currentState.field_end_date);
        // First payment date must be >= start date AND <= end date
        return paymentDate >= startDate && paymentDate <= endDate;
      },
    },
    field_recurring_payment_day: {
      required: false,
      custom: (value: any) => {
        if (!value) return true; // Optional field
        const strValue = String(value).trim();
        if (strValue === '') return true;
        const num = parseInt(strValue);
        return !isNaN(num) && num >= 1 && num <= 31;
      },
    },
    field_loan_status: {
      required: true,
    },
  };

  const { getFieldValidation, isFormValid } =
    useFormValidation(validationRules);

  const options = [
    { value: 'in_progress', label: t('common.active') },
    { value: 'draft', label: t('common.pending') },
    { value: 'completed', label: t('common.completed') },
  ];

  const endDateRef = useRef<HTMLInputElement>(null);
  const firstPaymentDateRef = useRef<HTMLInputElement>(null);

  // Update HTML validation constraints when dates change
  useEffect(() => {
    if (endDateRef.current && formState.field_start_date) {
      // Calculate next day after start date for end date minimum
      const startDate = new Date(formState.field_start_date);
      startDate.setDate(startDate.getDate() + 1);
      endDateRef.current.min = startDate.toISOString().split('T')[0];
    }
  }, [formState.field_start_date]);

  useEffect(() => {
    if (firstPaymentDateRef.current) {
      if (formState.field_start_date) {
        firstPaymentDateRef.current.min = formState.field_start_date;
      }
      if (formState.field_end_date) {
        firstPaymentDateRef.current.max = formState.field_end_date;
      }
    }
  }, [formState.field_start_date, formState.field_end_date]);

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate end_date > start_date
    if (formState.field_end_date && formState.field_start_date) {
      const endDate = new Date(formState.field_end_date);
      const startDate = new Date(formState.field_start_date);
      if (endDate <= startDate) {
        showNotification(
          t('loanForm.endDateMustBeAfterStartDate'),
          notificationType.ERROR
        );
        return;
      }
    }

    // Validate first payment date is between start and end
    if (
      formState.field_rec_first_payment_date &&
      formState.field_start_date &&
      formState.field_end_date
    ) {
      const paymentDate = new Date(formState.field_rec_first_payment_date);
      const startDate = new Date(formState.field_start_date);
      const endDate = new Date(formState.field_end_date);
      if (paymentDate < startDate || paymentDate > endDate) {
        showNotification(
          t('loanForm.firstPaymentDateMustBeBetweenStartAndEnd'),
          notificationType.ERROR
        );
        return;
      }
    }

    // If all validations pass, call the original handleSubmit
    handleSubmit(e);
  };

  return (
    <div className="loan-form-container">
      <form className="loan-form" onSubmit={handleFormSubmit}>
        {/* Basic Information */}
        <div className="form-group required">
          <label>{t('loanForm.loanTitle')}</label>
          <div className="input-wrapper">
            <input
              required
              placeholder={t('loanForm.enterLoanTitle')}
              type="text"
              name="title"
              value={formState.title}
              onChange={handleChange}
              className={`form-input ${getFieldValidation('title', formState) ? 'valid' : ''}`}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group required">
            <label>{t('loanForm.principalAmount')}</label>
            <div className="input-wrapper">
              <input
                required
                type="number"
                name="field_principal"
                value={formState.field_principal}
                onChange={handleChange}
                step="0.01"
                min="0"
                className={`form-input ${getFieldValidation('field_principal', formState) ? 'valid' : ''}`}
              />
            </div>
          </div>

          <div className="form-group required">
            <label>{t('loanForm.interestRate')}</label>
            <div className="input-wrapper">
              <input
                required
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
        </div>

        <div className="form-row">
          <div className="form-group required">
            <label>{t('loanForm.startDate')}</label>
            <div className="input-wrapper">
              <input
                required
                type="date"
                name="field_start_date"
                value={formState.field_start_date}
                onChange={handleChange}
                className={`form-input ${getFieldValidation('field_start_date', formState) ? 'valid' : ''}`}
              />
            </div>
          </div>

          <div className="form-group required">
            <label>{t('loanForm.endDate')}</label>
            <div className="input-wrapper">
              <input
                required
                type="date"
                name="field_end_date"
                ref={endDateRef}
                value={formState.field_end_date}
                onChange={handleChange}
                className={`form-input ${getFieldValidation('field_end_date', formState) ? 'valid' : ''}`}
              />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label>{t('loanForm.initialFee')}</label>
          <div className="input-wrapper">
            <input
              type="number"
              name="field_initial_fee"
              value={formState.field_initial_fee}
              onChange={handleChange}
              step="0.01"
              min="0"
              className={`form-input ${getFieldValidation('field_initial_fee', formState) ? 'valid' : ''}`}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>{t('loanForm.firstPaymentDate')}</label>
            <div className="input-wrapper">
              <input
                type="date"
                name="field_rec_first_payment_date"
                ref={firstPaymentDateRef}
                value={formState.field_rec_first_payment_date}
                onChange={handleChange}
                className={`form-input ${getFieldValidation('field_rec_first_payment_date', formState) ? 'valid' : ''}`}
              />
            </div>
          </div>

          <div className="form-group">
            <label>{t('loanForm.paymentDayOfMonth')}</label>
            <div className="input-wrapper">
              <input
                type="number"
                name="field_recurring_payment_day"
                value={formState.field_recurring_payment_day}
                onChange={handleChange}
                min="1"
                max="31"
                className={`form-input ${getFieldValidation('field_recurring_payment_day', formState) ? 'valid' : ''}`}
              />
            </div>
          </div>
        </div>

        <div className="form-group required">
          <label>{t('loanForm.loanStatus')}</label>
          <div className="input-wrapper">
            <select
              required
              name="field_loan_status"
              value={formState.field_loan_status}
              onChange={handleChange}
              className={`form-input ${getFieldValidation('field_loan_status', formState) ? 'valid' : ''}`}
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-actions-sticky">
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

export default LoanForm;
