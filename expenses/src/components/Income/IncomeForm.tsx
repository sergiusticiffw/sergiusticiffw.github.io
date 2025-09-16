import React, { useState } from 'react';
import { fetchRequest } from '@utils/utils';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { useNotification } from '@context/notification';
import { useLocalization } from '@context/localization';
import { notificationType } from '@utils/constants';
import { AuthState, DataState, NodeData } from '@type/types';
import { FaPlus, FaPen, FaCheck } from 'react-icons/fa';
import './IncomeForm.scss';

interface IncomeFormProps {
  formType: string;
  values: {
    nid: string;
    field_amount: string;
    field_date: string;
    field_description: string;
  };
  onSuccess: () => void;
}

const IncomeForm: React.FC<IncomeFormProps> = ({
  formType,
  values,
  onSuccess,
}) => {
  const showNotification = useNotification();
  const { t } = useLocalization();
  const dispatch = useAuthDispatch();
  const { dataDispatch } = useData() as DataState;
  const initialState = {
    field_amount: '',
    field_date: new Date().toISOString().slice(0, 10),
    field_description: '',
  };
  const [formState, setFormState] = useState(
    formType === 'add' ? initialState : values
  );
  const { token } = useAuthState() as AuthState;
  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = event.target.value;
    setFormState({
      ...formState,
      [event.target.name]: value,
    });
  };
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation functions
  const validateField = (name: string, value: string) => {
    switch (name) {
      case 'field_amount':
        return value && value.trim() !== '' && !isNaN(parseFloat(value)) && parseFloat(value) > 0;
      case 'field_date':
        return value && value.trim() !== '' && new Date(value) <= new Date();
      case 'field_description':
        return value && value.trim() !== '';
      default:
        return true;
    }
  };

  const getFieldValidation = (name: string) => {
    const value = formState[name as keyof typeof formState];
    return validateField(name, value);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    const node = {
      type: 'incomes',
      title: [formState.field_date],
      field_amount: [formState.field_amount],
      field_date: [formState.field_date],
      field_description: [formState.field_description],
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
    fetchRequest(
      url,
      fetchOptions,
      dataDispatch,
      dispatch,
      (data: NodeData) => {
        if (data.nid) {
          onSuccess();
          showNotification(t('notification.incomeAdded'), notificationType.SUCCESS);
          setIsSubmitting(false);
          setFormState(initialState);
        } else {
          showNotification(
            t('error.unknown'),
            notificationType.ERROR
          );
          setIsSubmitting(false);
        }
      }
    );
  };

  return (
    <div className="income-form-container">
      <div className="form-header">
        <h2>{formType === 'add' ? t('incomeForm.addIncome') : t('incomeForm.editIncome')}</h2>
      </div>
      <form className="income-form" onSubmit={handleSubmit}>
        <div className="form-group required">
          <label htmlFor="field_amount">{t('incomeForm.amount')}</label>
          <div className="input-wrapper">
            <input
              id="field_amount"
              required
              placeholder="0.00"
              type="number"
              name="field_amount"
              value={formState.field_amount}
              onChange={handleChange}
              step="0.01"
              min="0"
              className={`form-input ${getFieldValidation('field_amount') ? 'valid' : ''}`}
            />
            {getFieldValidation('field_amount') && (
              <div className="validation-icon valid">
                <FaCheck />
              </div>
            )}
          </div>
        </div>
        
        <div className="form-group required">
          <label htmlFor="field_date">{t('incomeForm.date')}</label>
          <div className="input-wrapper">
            <input
              id="field_date"
              required
              type="date"
              name="field_date"
              value={formState.field_date}
              onChange={handleChange}
              className={`form-input ${getFieldValidation('field_date') ? 'valid' : ''}`}
            />
            {getFieldValidation('field_date') && (
              <div className="validation-icon valid">
                <FaCheck />
              </div>
            )}
          </div>
        </div>
        
        <div className="form-group required">
          <label htmlFor="field_description">{t('incomeForm.description')}</label>
          <div className="input-wrapper">
            <input
              id="field_description"
              required
              placeholder={t('incomeForm.enterDescription')}
              type="text"
              name="field_description"
              value={formState.field_description}
              onChange={handleChange}
              className={`form-input ${getFieldValidation('field_description') ? 'valid' : ''}`}
            />
            {getFieldValidation('field_description') && (
              <div className="validation-icon valid">
                <FaCheck />
              </div>
            )}
          </div>
        </div>
        
        <div className="form-actions">
          <button type="submit" className="btn-submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <div className="loader">
                <span></span>
                <span></span>
                <span></span>
              </div>
            ) : (
              <>
                {formType === 'add' ? <FaPlus /> : <FaPen />}
                <span>{formType === 'add' ? t('incomeForm.addIncome') : t('incomeForm.updateIncome')}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default IncomeForm;
