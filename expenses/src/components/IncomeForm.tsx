import React, { useState } from 'react';
import { fetchRequest } from '@utils/utils';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { useNotification } from '@context/notification';
import { notificationType } from '@utils/constants';
import { AuthState, DataState, NodeData } from '@type/types';
import { FaPlus, FaPen } from 'react-icons/fa';

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
      <h2>{formType === 'add' ? 'Add income' : 'Edit income'}</h2>
      <form className="add-transaction" onSubmit={handleSubmit}>
        <input
          required
          placeholder="Amount"
          type="number"
          name="field_amount"
          value={formState.field_amount}
          onChange={handleChange}
          min={0}
          step={0.01}
        />
        <input
          required
          placeholder="Date"
          type="date"
          name="field_date"
          value={formState.field_date}
          onChange={handleChange}
        />
        <textarea
          placeholder="Description"
          name="field_description"
          rows={3}
          value={formState.field_description}
          onChange={handleChange}
        />
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

export default IncomeForm;
