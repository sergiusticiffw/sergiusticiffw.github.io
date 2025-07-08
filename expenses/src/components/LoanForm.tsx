import React, { useState } from 'react';
import { useNotification } from '@context/notification';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { AuthState, DataState, NodeData } from '@type/types';
import { fetchRequest, addOneDay } from '@utils/utils';
import { notificationType } from '@utils/constants';
import { FaPlus, FaPen } from 'react-icons/fa';

interface LoanFormProps {
  formType: string;
  values: {
    nid: string;
    title: string;
    field_principal: number;
    field_start_date: string;
    field_end_date: string;
    field_rate: number;
    field_initial_fee?: number;

    field_recurring_payment_method?: string;
    field_rec_first_payment_date?: string;
    field_recurring_payment_day?: number;
  };
  onSuccess: () => void;
}

const LoanForm: React.FC<LoanFormProps> = ({ formType, values, onSuccess }) => {
  const showNotification = useNotification();
  const dispatch = useAuthDispatch();
  const { dataDispatch } = useData() as DataState;

  const initialState = {
    title: '',
    field_principal: '',
    field_start_date: new Date().toISOString().slice(0, 10),
    field_end_date: new Date().toISOString().slice(0, 10),
    field_rate: '',
    field_initial_fee: '',

    field_rec_first_payment_date: null,
    field_recurring_payment_day: '',
    field_loan_status: true,
  };

  const [formState, setFormState] = useState(
    formType === 'add' ? initialState : values
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
      <h2>{formType === 'add' ? 'Add loan' : 'Edit loan'}</h2>
      <form className="add-transaction" onSubmit={handleSubmit}>
        <input
          required
          placeholder="Title"
          type="text"
          name="title"
          value={formState.title}
          onChange={handleChange}
        />
        <input
          required
          placeholder="Principal"
          type="number"
          name="field_principal"
          value={formState.field_principal}
          onChange={handleChange}
          min={0}
          step={0.01}
        />
        <input
          required
          placeholder="Start Date"
          type="date"
          name="field_start_date"
          value={formState.field_start_date}
          onChange={handleChange}
        />
        <input
          required
          placeholder="End Date"
          type="date"
          name="field_end_date"
          value={formState.field_end_date}
          onChange={handleChange}
        />
        <input
          required
          placeholder="Rate"
          type="number"
          name="field_rate"
          value={formState.field_rate}
          onChange={handleChange}
          min={0}
          step={0.01}
        />
        <input
          placeholder="Initial fee"
          type="number"
          name="field_initial_fee"
          value={formState.field_initial_fee}
          onChange={handleChange}
        />
        <input
          required
          placeholder="1st recurring payment date"
          type="date"
          max={formState.field_end_date}
          min={addOneDay(formState.field_start_date)}
          name="field_rec_first_payment_date"
          value={formState.field_rec_first_payment_date}
          onChange={handleChange}
        />
        <input
          required
          placeholder="Recurring payment day"
          type="number"
          name="field_recurring_payment_day"
          value={formState.field_recurring_payment_day}
          onChange={handleChange}
          min={1}
          max={31}
        />

        <label htmlFor="field_loan_status">
          Is loan active
          <input
            type="checkbox"
            name="field_loan_status"
            id="field_loan_status"
            checked={formState.field_loan_status}
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

export default LoanForm;
