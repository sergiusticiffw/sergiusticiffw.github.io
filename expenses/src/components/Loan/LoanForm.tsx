import React, { useState, useEffect } from 'react';
import { useAuthDispatch, useAuthState } from '@context/context';
import { useNotification } from '@context/notification';
import { useLocalization } from '@context/localization';
import { AuthState } from '@type/types';
import { notificationType } from '@utils/constants';
import { fetchLoans } from '@utils/utils';
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

    field_rec_first_payment_date: null,
    field_recurring_payment_day: '',
    field_loan_status: 'draft',
  };

  const [formState, setFormState] = useState(
    formType === 'add' ? initialState : values
  );

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
      <div className="form-header">
        <h2>
          {formType === 'add' ? t('loanForm.addLoan') : t('loanForm.editLoan')}
        </h2>
      </div>

      <form className="loan-form" onSubmit={handleSubmit}>
        {/* Basic Information */}
        <div className="form-group required">
          <label>{t('loanForm.loanTitle')}</label>
          <input
            required
            placeholder={t('loanForm.enterLoanTitle')}
            type="text"
            name="title"
            value={formState.title}
            onChange={handleChange}
          />
        </div>

        <div className="form-row">
          <div className="form-group required">
            <label>{t('loanForm.principalAmount')}</label>
            <input
              required
              placeholder={t('form.amountPlaceholder')}
              type="number"
              name="field_principal"
              value={formState.field_principal}
              onChange={handleChange}
              min={0}
              step={0.01}
            />
          </div>

          <div className="form-group required">
            <label>{t('loanForm.interestRate')}</label>
            <input
              required
              placeholder={t('form.amountPlaceholder')}
              type="number"
              name="field_rate"
              value={formState.field_rate}
              onChange={handleChange}
              min={0}
              step={0.01}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group required">
            <label>{t('loanForm.startDate')}</label>
            <input
              required
              type="date"
              name="field_start_date"
              value={formState.field_start_date}
              onChange={handleChange}
            />
          </div>

          <div className="form-group required">
            <label>{t('loanForm.endDate')}</label>
            <input
              required
              type="date"
              name="field_end_date"
              value={formState.field_end_date}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-group">
          <label>{t('loanForm.initialFee')}</label>
          <input
            placeholder="0.00"
            type="number"
            name="field_initial_fee"
            value={formState.field_initial_fee}
            onChange={handleChange}
            min={0}
            step={0.01}
          />
        </div>

        <div className="form-row">
          <div className="form-group required">
            <label>{t('loanForm.firstPaymentDate')}</label>
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
            />
          </div>

          <div className="form-group required">
            <label>{t('loanForm.paymentDayOfMonth')}</label>
            <input
              required
              placeholder="1-31"
              type="number"
              name="field_recurring_payment_day"
              value={formState.field_recurring_payment_day}
              onChange={handleChange}
              min={1}
              max={31}
            />
          </div>
        </div>

        <div className="form-group required">
          <label>{t('loanForm.loanStatus')}</label>
          <select
            required
            name="field_loan_status"
            value={formState.field_loan_status}
            onChange={handleChange}
          >
            {options.map((item, id) => (
              <option key={id} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
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
              <>{t('loanForm.addLoan')}</>
            ) : (
              <>{t('loanForm.updateLoan')}</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LoanForm;
