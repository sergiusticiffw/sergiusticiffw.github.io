import React, { useState } from 'react';
import { useNotification } from '@context/notification';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { AuthState, DataState, NodeData } from '@type/types';
import { addOneDay, fetchRequest } from '@utils/utils';
import { notificationType } from '@utils/constants';
import { FaPlus, FaPen } from 'react-icons/fa';
import { useParams } from 'react-router-dom';

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
  endDate?: string;
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
  
  // Ensure all values are properly initialized to prevent null values
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
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, checked, value } = event.target;
    setFormState({
      ...formState,
      [name]: type === 'checkbox' ? checked : value,
    });
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    <div>
      <h2>{formType === 'add' ? 'Add Payment' : 'Edit Payment'}</h2>
      <form className="add-transaction" onSubmit={handleSubmit}>
        <input
          required
          placeholder="Title"
          type="text"
          name="title"
          value={formState.title || ''}
          onChange={handleChange}
        />
        <input
          required
          placeholder="Event date"
          type="date"
          name="field_date"
          min={addOneDay(startDate)}
          value={formState.field_date || ''}
          onChange={handleChange}
        />
        <input
          placeholder="New interest rate"
          type="number"
          name="field_rate"
          value={formState.field_rate || ''}
          onChange={handleChange}
          min={0}
          step={0.01}
        />
        <input
          placeholder="Installment payment"
          type="number"
          name="field_pay_installment"
          value={formState.field_pay_installment || ''}
          onChange={handleChange}
          min={0}
          step={0.01}
        />
        <input
          placeholder="New recurring amount"
          type="number"
          name="field_new_recurring_amount"
          value={formState.field_new_recurring_amount || ''}
          onChange={handleChange}
          min={0}
          step={0.01}
        />
        <input
          placeholder="Individual fee"
          type="number"
          name="field_pay_single_fee"
          value={formState.field_pay_single_fee || ''}
          onChange={handleChange}
          min={0}
          step={0.01}
        />

        <label htmlFor="field_is_simulated_payment" className="checkbox-label">
          Simulated payment (debug loan)
          <input
            type="checkbox"
            name="field_is_simulated_payment"
            id="field_is_simulated_payment"
            checked={formState.field_is_simulated_payment || false}
            onChange={handleChange}
          />
        </label>

        <button type="submit" disabled={isSubmitting} className="button w-100">
          {isSubmitting ? (
            <div className="loader">
              <span className="loader__element"></span>
              <span className="loader__element"></span>
              <span className="loader__element"></span>
            </div>
          ) : formType === 'add' ? (
            <FaPlus />
          ) : (
            <FaPen />
          )}
        </button>
      </form>
    </div>
  );
};

export default PaymentForm;
