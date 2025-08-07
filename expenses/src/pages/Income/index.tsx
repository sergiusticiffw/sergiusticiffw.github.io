import React, { Suspense, useEffect, useState } from 'react';
import IncomeForm from '@components/Income/IncomeForm';
import { deleteNode, fetchData, formatNumber } from '@utils/utils';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { useNotification } from '@context/notification';
import IncomeTable from '@components/Income/IncomeTable';
import YearIncomeAverageTrend from '@components/Income/YearIncomeAverageTrend';
import { notificationType } from '@utils/constants';
import { AuthState, TransactionOrIncomeItem } from '@type/types';
import {
  Plus,
  Trash2,
  ChevronDown,
  DollarSign,
  TrendingUp,
  Calendar,
  FileText,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const Income = () => {
  const showNotification = useNotification();
  const { token } = useAuthState() as AuthState;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isNewModal, setIsNewModal] = useState(false);
  const { data, dataDispatch } = useData();
  const noData = data.groupedData === null;
  const loading = data.loading;
  const dispatch = useAuthDispatch();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nrOfItemsToShow, setNrOfItemsToShow] = useState(20);

  useEffect(() => {
    if (noData) {
      fetchData(token, dataDispatch, dispatch);
    }
  }, [data, dataDispatch, noData, token, dispatch]);

  const [focusedItem, setFocusedItem] = useState({
    nid: '',
    field_date: '',
    field_amount: '',
    field_description: '',
  });

  const handleEdit = (id: string) => {
    const item = data.incomeData.find(
      (item: TransactionOrIncomeItem) => item.id === id
    );
    setFocusedItem({
      nid: item.id,
      field_date: item.dt,
      field_amount: item.sum,
      field_description: item.dsc,
    });
    setShowEditModal(true);
  };

  const handleDelete = (showDeleteModal: boolean, token: string) => {
    setIsSubmitting(true);
    // @ts-expect-error
    deleteNode(showDeleteModal, token, (response) => {
      if (response.ok) {
        showNotification(
          'Income was successfully deleted.',
          notificationType.SUCCESS
        );
        setIsSubmitting(false);
      } else {
        showNotification('Something went wrong.', notificationType.ERROR);
        setIsSubmitting(false);
      }
      setShowDeleteModal(false);
      fetchData(token, dataDispatch, dispatch);
    });
  };

  const handleClearChangedItem = (id: string) => {
    dataDispatch({ type: 'CLEAR_CHANGED_ITEM', id });
  };

  // Calculate income statistics
  const totalIncome =
    data.incomeData?.reduce(
      (sum: number, item: TransactionOrIncomeItem) =>
        sum + parseFloat(item.sum || '0'),
      0
    ) || 0;
  const totalRecords = data.incomeData?.length || 0;
  const averageIncome = totalRecords > 0 ? totalIncome / totalRecords : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading income data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/25">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
                Income Management
              </h1>
              <p className="text-muted-foreground">Track and manage your income sources efficiently</p>
            </div>
          </div>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button 
              onClick={() => {
                setShowEditModal(true);
                setIsNewModal(true);
              }}
              className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/25 transition-all duration-200 hover:scale-105 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Income
            </Button>
          </DialogTrigger>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20 hover:shadow-lg hover:shadow-green-500/10 transition-all duration-300 group">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Records</CardTitle>
              <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                <FileText className="w-4 h-4 text-green-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {formatNumber(totalRecords)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 group">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                <DollarSign className="w-4 h-4 text-blue-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {formatNumber(totalIncome)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300 group">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Average Income</CardTitle>
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                <TrendingUp className="w-4 h-4 text-purple-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {formatNumber(averageIncome)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Income Table Section */}
      {noData ? (
        <Card className="border-border/50 shadow-lg">
          <CardContent className="text-center py-16">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No Income Data</h3>
            <p className="text-muted-foreground mb-4">Start by adding your first income record</p>
            <Button 
              onClick={() => {
                setShowEditModal(true);
                setIsNewModal(true);
              }}
              className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add First Income
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {data.incomeData && data.incomeData.length ? (
            <Card className="border-border/50 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  Income Records
                </CardTitle>
              </CardHeader>
              <CardContent>
                <IncomeTable
                  items={data.incomeData.slice(0, nrOfItemsToShow)}
                  handleEdit={handleEdit}
                  // @ts-expect-error
                  setShowDeleteModal={setShowDeleteModal}
                  changedItems={data.changedItems}
                  handleClearChangedItem={handleClearChangedItem}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50 shadow-lg">
              <CardContent className="text-center py-16">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No Income Records</h3>
                <p className="text-muted-foreground mb-4">No income records found. Add your first income entry.</p>
                <Button 
                  onClick={() => {
                    setShowEditModal(true);
                    setIsNewModal(true);
                  }}
                  className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Income
                </Button>
              </CardContent>
            </Card>
          )}

          {data.incomeData?.length > nrOfItemsToShow && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => setNrOfItemsToShow(nrOfItemsToShow + 10)}
                className="mt-4"
              >
                <ChevronDown className="w-4 h-4 mr-2" />
                Load More
              </Button>
            </div>
          )}
        </>
      )}

      {/* Charts Section */}
      {data.incomeData?.length ? (
        <YearIncomeAverageTrend />
      ) : null}

      {/* Modals */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">
              Delete Income Record
            </DialogTitle>
            <DialogDescription className="text-center text-muted-foreground">
              Are you sure you want to delete this income record? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDelete(showDeleteModal, token)}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Deleting...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  Delete
                </div>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditModal} onOpenChange={(open) => {
        if (!open) {
          setShowEditModal(false);
          setIsNewModal(false);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">
              {!isNewModal ? 'Edit Income Record' : 'Add Income Record'}
            </DialogTitle>
            <DialogDescription>
              {!isNewModal ? 'Update the details for this income record.' : 'Enter the details for your new income record.'}
            </DialogDescription>
          </DialogHeader>
          <IncomeForm
            formType={!isNewModal ? 'edit' : 'add'}
            values={focusedItem}
            onSuccess={() => {
              setShowEditModal(false);
              setIsNewModal(false);
              fetchData(token, dataDispatch, dispatch);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Income;
