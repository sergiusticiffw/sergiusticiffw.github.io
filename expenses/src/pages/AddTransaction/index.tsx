import React from 'react';
import TransactionForm from '@components/TransactionForm/TransactionForm';
import { fetchData } from '@utils/utils';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { AuthState, DataState } from '@type/types';
import './AddTransaction.scss';

const AddTransaction = () => {
  const { token } = useAuthState() as AuthState;
  const { dataDispatch } = useData() as DataState;
  const dispatch = useAuthDispatch();

  return (
    <div className="add-transaction-page">
      <TransactionForm
        formType="add"
        values={null}
        onSuccess={() => {
          fetchData(token, dataDispatch, dispatch);
        }}
      />
    </div>
  );
};

export default AddTransaction;
