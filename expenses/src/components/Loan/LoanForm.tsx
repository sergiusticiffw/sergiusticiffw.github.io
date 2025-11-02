import React, { useRef, useEffect } from 'react';
import { useLocalization } from '@context/localization';
import { useNotification } from '@context/notification';
import { notificationType } from '@utils/constants';
import { useFormSubmit } from '@hooks/useFormSubmit';
import { useFormValidation } from '@hooks/useFormValidation';
import { FormField } from '@components/Common';
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
        <FormField
          name="title"
          type="text"
          label={t('loanForm.loanTitle')}
          value={formState.title}
          onChange={handleChange}
          required
          placeholder={t('loanForm.enterLoanTitle')}
          isValid={getFieldValidation('title', formState)}
        />

        <div className="form-row">
          <FormField
            name="field_principal"
            type="number"
            label={t('loanForm.principalAmount')}
            value={formState.field_principal}
            onChange={handleChange}
            required
            step="0.01"
            min="0"
            isValid={getFieldValidation('field_principal', formState)}
          />

          <FormField
            name="field_rate"
            type="number"
            label={t('loanForm.interestRate')}
            value={formState.field_rate}
            onChange={handleChange}
            required
            step="0.01"
            min="0"
            isValid={getFieldValidation('field_rate', formState)}
          />
        </div>

        <div className="form-row">
          <FormField
            name="field_start_date"
            type="date"
            label={t('loanForm.startDate')}
            value={formState.field_start_date}
            onChange={handleChange}
            required
            isValid={getFieldValidation('field_start_date', formState)}
          />

          <FormField
            name="field_end_date"
            type="date"
            label={t('loanForm.endDate')}
            value={formState.field_end_date}
            onChange={handleChange}
            required
            inputRef={endDateRef}
            isValid={getFieldValidation('field_end_date', formState)}
          />
        </div>

        <FormField
          name="field_initial_fee"
          type="number"
          label={t('loanForm.initialFee')}
          value={formState.field_initial_fee}
          onChange={handleChange}
          step="0.01"
          min="0"
          isValid={getFieldValidation('field_initial_fee', formState)}
        />

        <div className="form-row">
          <FormField
            name="field_rec_first_payment_date"
            type="date"
            label={t('loanForm.firstPaymentDate')}
            value={formState.field_rec_first_payment_date}
            onChange={handleChange}
            inputRef={firstPaymentDateRef}
            isValid={getFieldValidation('field_rec_first_payment_date', formState)}
          />

          <FormField
            name="field_recurring_payment_day"
            type="number"
            label={t('loanForm.paymentDayOfMonth')}
            value={formState.field_recurring_payment_day}
            onChange={handleChange}
            min="1"
            max="31"
            isValid={getFieldValidation('field_recurring_payment_day', formState)}
          />
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
