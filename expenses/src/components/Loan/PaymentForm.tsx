import React, { useState } from 'react';
import { useNotification } from '@context/notification';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { AuthState, DataState, NodeData } from '@type/types';
import { addOneDay, fetchRequest } from '@utils/utils';
import { notificationType } from '@utils/constants';
import { FaPlus, FaPen } from 'react-icons/fa';
import { useParams } from 'react-router-dom';
import './PaymentForm.scss';

interface PaymentFormProps {
  formType: string;
  values: {
    nid: string;
    title: string;
    field_date: string;
    field_rate?: number;
    field_pay_installment?: number;
    field_pay_single_fee?: number;
    field_new_recurring_amount?: number;
  };
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
          showNotification('Success!', notificationType.SUCCESS);
          setIsSubmitting(false);
          setFormState(initialState);
        } else {
          showNotification(
            'Something went wrong, please contact Sergiu S :)',
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
        <h2>{formType === 'add' ? 'Add New Payment' : 'Edit Payment'}</h2>
      </div>
      
      <form className="payment-form" onSubmit={handleSubmit}>
        {/* Basic Information */}
        <div className="form-group required">
          <label>Payment Title</label>
          <input
            required
            placeholder="Enter payment title"
            type="text"
            name="title"
            value={formState.title || ''}
            onChange={handleChange}
          />
        </div>

        <div className="form-group required">
          <label>Payment Date</label>
          <input
            required
            type="date"
            name="field_date"
            min={addOneDay(startDate)}
            value={formState.field_date || ''}
            onChange={handleChange}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>New Interest Rate (%)</label>
            <input
              placeholder="0.00"
              type="number"
              name="field_rate"
              value={formState.field_rate || ''}
              onChange={handleChange}
              min={0}
              step={0.01}
            />
          </div>
          
          <div className="form-group">
            <label>Installment Payment</label>
            <input
              placeholder="0.00"
              type="number"
              name="field_pay_installment"
              value={formState.field_pay_installment || ''}
              onChange={handleChange}
              min={0}
              step={0.01}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>New Recurring Amount</label>
            <input
              placeholder="0.00"
              type="number"
              name="field_new_recurring_amount"
              value={formState.field_new_recurring_amount || ''}
              onChange={handleChange}
              min={0}
              step={0.01}
            />
          </div>
          
          <div className="form-group">
            <label>Individual Fee</label>
            <input
              placeholder="0.00"
              type="number"
              name="field_pay_single_fee"
              value={formState.field_pay_single_fee || ''}
              onChange={handleChange}
              min={0}
              step={0.01}
            />
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
            Simulated payment (debug loan)
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
                Add Payment
              </>
            ) : (
              <>
                <FaPen />
                Update Payment
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PaymentForm;
