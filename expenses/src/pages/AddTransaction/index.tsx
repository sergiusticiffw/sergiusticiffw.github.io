import React from 'react';
import TransactionForm from '@components/TransactionForm/TransactionForm';
import { fetchData } from '@utils/utils';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { AuthState, DataState } from '@type/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';

const AddTransaction = () => {
  const { token } = useAuthState() as AuthState;
  const { dataDispatch } = useData() as DataState;
  const dispatch = useAuthDispatch();

  return (
    <div className="min-h-screen bg-background p-4">
      <Card className="max-w-2xl mx-auto border-border/50 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Add New Transaction
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionForm
            formType="add"
            values={null}
            onSuccess={() => {
              fetchData(token, dataDispatch, dispatch);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default AddTransaction;
