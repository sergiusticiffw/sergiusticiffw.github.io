import React, { useState, useEffect } from 'react';
import { useAuthDispatch, useAuthState } from '@context/context';
import { useNotification } from '@context/notification';
import { useLocalization } from '@context/localization';
import { AuthState } from '@type/types';
import { notificationType } from '@utils/constants';
import { fetchLoans } from '@utils/utils';
import { FaCheck } from 'react-icons/fa';
import './LoanForm.scss';

interface LoanFormProps {
  formType: 'add' | 'edit';
  values?: any;
  onSuccess?: () => void;
}

const LoanForm: React.FC<LoanFormProps> = ({ formType, values, onSuccess }) => {
  const showNotification = useNotification();
  const { t } = useLocalization();
  const { token } = useAuthState() as AuthState;
  const dispatch = useAuthDispatch();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const options = [
    { value: 'in_progress', label: t('common.active') },
    { value: 'draft', label: t('common.pending') },
    { value: 'completed', label: t('common.completed') },
  ];

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

  const [formState, setFormState] = useState(
    formType === 'add' ? initialState : values
  );

  // Validation functions
  const validateField = (name: string, value: string) => {
    switch (name) {
      case 'title':
        return value && value.trim() !== '';
      case 'field_principal':
        if (!value) return false;
        const principalValue = typeof value === 'string' ? value.trim() : String(value);
        if (principalValue === '') return false;
        const principalNum = parseFloat(principalValue);
        return !isNaN(principalNum) && principalNum > 0;
      case 'field_rate':
        if (!value) return false;
        const rateValue = typeof value === 'string' ? value.trim() : String(value);
        if (rateValue === '') return false;
        const rateNum = parseFloat(rateValue);
        return !isNaN(rateNum) && rateNum >= 0;
      case 'field_start_date':
        return value && value.trim() !== '' && new Date(value) <= new Date();
      case 'field_end_date':
        return value && value.trim() !== '' && new Date(value) > new Date(formState.field_start_date);
      case 'field_initial_fee':
        // Optional field - show green only if has valid value >= 0
        if (!value) return false;
        const feeValue = typeof value === 'string' ? value.trim() : String(value);
        if (feeValue === '') return false;
        const feeNum = parseFloat(feeValue);
        return !isNaN(feeNum) && feeNum >= 0;
      case 'field_rec_first_payment_date':
        return value && value.trim() !== '' && new Date(value) >= new Date(formState.field_start_date) && new Date(value) <= new Date(formState.field_end_date);
      case 'field_recurring_payment_day':
        if (!value) return false;
        const dayValue = typeof value === 'string' ? value.trim() : String(value);
        if (dayValue === '') return false;
        const dayNum = parseInt(dayValue);
        return !isNaN(dayNum) && dayNum >= 1 && dayNum <= 31;
      case 'field_loan_status':
        return value && value.trim() !== '';
      default:
        return true;
    }
  };

  const getFieldValidation = (name: string) => {
    const value = formState[name as keyof typeof formState];
    return validateField(name, value);
  };

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, type, value } = event.target;
    const checked = (event.target as HTMLInputElement).checked;
    setFormState({
      ...formState,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    const node = {
      type: 'loan',
      title: [formState.title],
      field_principal: [formState.field_principal],
      field_start_date: [formState.field_start_date],
      field_end_date: [formState.field_end_date],
      field_rate: [formState.field_rate],
      field_initial_fee: [formState.field_initial_fee],
      field_rec_first_payment_date: [formState.field_rec_first_payment_date],
      field_recurring_payment_day: [formState.field_recurring_payment_day],
      field_loan_status: [formState.field_loan_status],
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
          showNotification(
            formType === 'add'
              ? t('notification.loanAdded')
              : t('notification.loanUpdated'),
            notificationType.SUCCESS
          );
          setIsSubmitting(false);
          setFormState(initialState);
        } else {
          showNotification(t('error.unknown'), notificationType.ERROR);
          setIsSubmitting(false);
        }
      })
      .catch((error) => {
        console.error('Loan operation failed:', error);
        showNotification(t('error.unknown'), notificationType.ERROR);
        setIsSubmitting(false);
      });
  };

  return (
    <div className="loan-form-container">
      <form className="loan-form" onSubmit={handleSubmit}>
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
              className={`form-input ${getFieldValidation('title') ? 'valid' : ''}`}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group required">
            <label>{t('loanForm.principalAmount')}</label>
            <div className="input-wrapper">
              <input
                required
                placeholder="0.00"
                type="number"
                name="field_principal"
                value={formState.field_principal}
                onChange={handleChange}
                min={0}
                step={0.01}
                className={`form-input ${getFieldValidation('field_principal') ? 'valid' : ''}`}
              />
            </div>
          </div>

          <div className="form-group required">
            <label>{t('loanForm.interestRate')}</label>
            <div className="input-wrapper">
              <input
                required
                placeholder="0.00"
                type="number"
                name="field_rate"
                value={formState.field_rate}
                onChange={handleChange}
                min={0}
                step={0.01}
                className={`form-input ${getFieldValidation('field_rate') ? 'valid' : ''}`}
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
                className={`form-input ${getFieldValidation('field_start_date') ? 'valid' : ''}`}
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
                value={formState.field_end_date}
                onChange={handleChange}
                className={`form-input ${getFieldValidation('field_end_date') ? 'valid' : ''}`}
              />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label>{t('loanForm.initialFee')}</label>
          <div className="input-wrapper">
            <input
              placeholder="0.00"
              type="number"
              name="field_initial_fee"
              value={formState.field_initial_fee}
              onChange={handleChange}
              min={0}
              step={0.01}
              className={`form-input ${getFieldValidation('field_initial_fee') ? 'valid' : ''}`}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group required">
            <label>{t('loanForm.firstPaymentDate')}</label>
            <div className="input-wrapper">
              <input
                required
                type="date"
                max={formState.field_end_date}
                min={new Date(formState.field_start_date)
                  .toISOString()
                  .slice(0, 10)}
                name="field_rec_first_payment_date"
                value={formState.field_rec_first_payment_date}
                onChange={handleChange}
                className={`form-input ${getFieldValidation('field_rec_first_payment_date') ? 'valid' : ''}`}
              />
            </div>
          </div>

          <div className="form-group required">
            <label>{t('loanForm.paymentDayOfMonth')}</label>
            <div className="input-wrapper">
              <input
                required
                placeholder="1-31"
                type="number"
                name="field_recurring_payment_day"
                value={formState.field_recurring_payment_day}
                onChange={handleChange}
                min={1}
                max={31}
                className={`form-input ${getFieldValidation('field_recurring_payment_day') ? 'valid' : ''}`}
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
              className={`form-input ${getFieldValidation('field_loan_status') ? 'valid' : ''}`}
            >
              {options.map((item, id) => (
                <option key={id} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" disabled={isSubmitting} className="btn-submit">
            {isSubmitting ? (
              <div className="loader">
                <span></span>
                <span></span>
                <span></span>
              </div>
            ) : formType === 'add' ? (
              <>
                <span>{t('loanForm.addLoan')}</span>
              </>
            ) : (
              <>
                <span>{t('loanForm.updateLoan')}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LoanForm;
