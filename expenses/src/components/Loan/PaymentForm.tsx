import React, { useState } from 'react';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { useNotification } from '@context/notification';
import { useLocalization } from '@context/localization';
import { AuthState, DataState, NodeData } from '@type/types';
import { addOneDay, fetchRequest } from '@utils/utils';
import { notificationType } from '@utils/constants';
import { FaPlus, FaPen, FaCheck } from 'react-icons/fa';
import { useParams } from 'react-router-dom';
import './PaymentForm.scss';

interface PaymentFormProps {
  formType: 'add' | 'edit';
  values: any;
  onSuccess: () => void;
  startDate?: string;
}
const PaymentForm: React.FC<PaymentFormProps> = ({
  formType,
  values,
  onSuccess,
  startDate,
}) => {
  const { id } = useParams();
  const showNotification = useNotification();
  const { t } = useLocalization();
  const dispatch = useAuthDispatch();
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
  
  const [formState, setFormState] = useState(
    formType === 'add' ? initialState : initialValues
  );
  const { token } = useAuthState() as AuthState;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation functions
  const validateField = (name: string, value: string | boolean) => {
    switch (name) {
      case 'title':
        return value && typeof value === 'string' && value.trim() !== '';
      case 'field_date':
        return value && typeof value === 'string' && new Date(value) <= new Date();
      case 'field_rate':
        // Optional field - show green only if has valid value > 0
        if (!value) return false;
        const rateValue = typeof value === 'string' ? value.trim() : String(value);
        if (rateValue === '') return false;
        const rateNum = parseFloat(rateValue);
        return !isNaN(rateNum) && rateNum > 0;
      case 'field_pay_installment':
        // Optional field - show green only if has valid value > 0
        if (!value) return false;
        const installmentValue = typeof value === 'string' ? value.trim() : String(value);
        if (installmentValue === '') return false;
        const installmentNum = parseFloat(installmentValue);
        return !isNaN(installmentNum) && installmentNum > 0;
      case 'field_pay_single_fee':
        // Optional field - show green only if has valid value > 0
        if (!value) return false;
        const feeValue = typeof value === 'string' ? value.trim() : String(value);
        if (feeValue === '') return false;
        const feeNum = parseFloat(feeValue);
        return !isNaN(feeNum) && feeNum > 0;
      case 'field_new_recurring_amount':
        // Optional field - show green only if has valid value > 0
        if (!value) return false;
        const recurringValue = typeof value === 'string' ? value.trim() : String(value);
        if (recurringValue === '') return false;
        const recurringNum = parseFloat(recurringValue);
        return !isNaN(recurringNum) && recurringNum > 0;
      default:
        return true;
    }
  };

  const getFieldValidation = (name: string) => {
    const value = formState[name as keyof typeof formState];
    return validateField(name, value);
  };
  
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, checked, value } = event.target;
    setFormState({
      ...formState,
      [name]: type === 'checkbox' ? checked : value,
    });
  };
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    const node = {
      type: 'payment',
      title: [formState.title],
      field_date: [formState.field_date],
      field_rate: [formState.field_rate],
      field_pay_installment: [formState.field_pay_installment],
      field_pay_single_fee: [formState.field_pay_single_fee],
      field_new_recurring_amount: [formState.field_new_recurring_amount],
      field_is_simulated_payment: [formState.field_is_simulated_payment ? 1 : 0],
      field_loan_reference: [id],
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
          showNotification(t('notification.paymentAdded'), notificationType.SUCCESS);
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
    <div className="payment-form-container">
      <div className="form-header">
        <h2>{formType === 'add' ? t('paymentForm.addPayment') : t('paymentForm.editPayment')}</h2>
      </div>
      
      <form className="payment-form" onSubmit={handleSubmit}>
        {/* Basic Information */}
        <div className="form-group required">
          <label>{t('paymentForm.paymentTitle')}</label>
          <div className="input-wrapper">
            <input
              required
              placeholder={t('paymentForm.enterPaymentTitle')}
              type="text"
              name="title"
              value={formState.title || ''}
              onChange={handleChange}
              className={`form-input ${getFieldValidation('title') ? 'valid' : ''}`}
            />
            {getFieldValidation('title') && (
              <div className="validation-icon valid">
                <FaCheck />
              </div>
            )}
          </div>
        </div>

        <div className="form-group required">
          <label>{t('paymentForm.paymentDate')}</label>
          <div className="input-wrapper">
            <input
              required
              type="date"
              name="field_date"
              min={addOneDay(startDate)}
              value={formState.field_date || ''}
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

        <div className="form-row">
          <div className="form-group">
            <label>{t('paymentForm.newInterestRate')}</label>
            <div className="input-wrapper">
              <input
                placeholder="0.00"
                type="number"
                name="field_rate"
                value={formState.field_rate || ''}
                onChange={handleChange}
                min={0}
                step={0.01}
                className={`form-input ${getFieldValidation('field_rate') ? 'valid' : ''}`}
              />
              {getFieldValidation('field_rate') && (
                <div className="validation-icon valid">
                  <FaCheck />
                </div>
              )}
            </div>
          </div>
          
          <div className="form-group">
            <label>{t('paymentForm.installmentPayment')}</label>
            <div className="input-wrapper">
              <input
                placeholder="0.00"
                type="number"
                name="field_pay_installment"
                value={formState.field_pay_installment || ''}
                onChange={handleChange}
                min={0}
                step={0.01}
                className={`form-input ${getFieldValidation('field_pay_installment') ? 'valid' : ''}`}
              />
              {getFieldValidation('field_pay_installment') && (
                <div className="validation-icon valid">
                  <FaCheck />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>{t('paymentForm.newRecurringAmount')}</label>
            <div className="input-wrapper">
              <input
                placeholder="0.00"
                type="number"
                name="field_new_recurring_amount"
                value={formState.field_new_recurring_amount || ''}
                onChange={handleChange}
                min={0}
                step={0.01}
                className={`form-input ${getFieldValidation('field_new_recurring_amount') ? 'valid' : ''}`}
              />
              {getFieldValidation('field_new_recurring_amount') && (
                <div className="validation-icon valid">
                  <FaCheck />
                </div>
              )}
            </div>
          </div>
          
          <div className="form-group">
            <label>{t('paymentForm.individualFee')}</label>
            <div className="input-wrapper">
              <input
                placeholder="0.00"
                type="number"
                name="field_pay_single_fee"
                value={formState.field_pay_single_fee || ''}
                onChange={handleChange}
                min={0}
                step={0.01}
                className={`form-input ${getFieldValidation('field_pay_single_fee') ? 'valid' : ''}`}
              />
              {getFieldValidation('field_pay_single_fee') && (
                <div className="validation-icon valid">
                  <FaCheck />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="checkbox-group">
          <input
            type="checkbox"
            name="field_is_simulated_payment"
            id="field_is_simulated_payment"
            checked={formState.field_is_simulated_payment || false}
            onChange={handleChange}
          />
          <label htmlFor="field_is_simulated_payment">
            {t('paymentForm.simulatedPayment')}
          </label>
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
                <FaPlus />
                <span>{t('paymentForm.addPayment')}</span>
              </>
            ) : (
              <>
                <FaPen />
                <span>{t('paymentForm.updatePayment')}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PaymentForm;
