import React, { useEffect, useState } from 'react';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { useNotification } from '@context/notification';
import { useLocalization } from '@context/localization';
import { deleteNode, fetchData, formatNumber } from '@utils/utils';
import { getIconForCategory } from '@utils/helper';
import { getCategories, notificationType } from '@utils/constants';
import { monthNames } from '@utils/constants';
import SearchBar from '@components/SearchBar';
import TransactionList from '@components/TransactionList';
import CalendarView from '@components/CalendarView';
import Modal from '@components/Modal';
import TransactionForm from '@components/TransactionForm';
import {
  FaPlus,
  FaMoneyBillWave,
  FaUniversity,
  FaChartLine,
  FaChevronLeft,
  FaChevronRight,
  FaTrash,
  FaList,
  FaCalendar,
} from 'react-icons/fa';
import { AuthState, TransactionOrIncomeItem } from '@type/types';
import './Home1.scss';

const Home1 = () => {
  const showNotification = useNotification();
  const { t } = useLocalization();
  const { token } = useAuthState() as AuthState;
  const { data, dataDispatch } = useData();
  const noData = data.groupedData === null;
  const loading = data.loading;
  const dispatch = useAuthDispatch();
  const [searchText, setSearchText] = useState(data.textFilter ?? '');
  const [selectedCategory, setSelectedCategory] = useState(data.category ?? '');
  const [showDeleteModal, setShowDeleteModal] = useState<string | false>(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [focusedItem, setFocusedItem] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeView, setActiveView] = useState<'list' | 'calendar'>('list');

  useEffect(() => {
    if (noData) {
      fetchData(token, dataDispatch, dispatch);
    }
  }, [data, dataDispatch, token, noData, dispatch]);

  // Update filters in context
  useEffect(() => {
    dataDispatch({
      type: 'FILTER_DATA',
      category: selectedCategory,
      textFilter: searchText,
    });
  }, [searchText, selectedCategory, dataDispatch]);

  const items = data.filtered || data;
  const localizedCategories = getCategories();

  const handleEdit = (id: string) => {
    const item = items.groupedData[currentMonth].find(
      (item: TransactionOrIncomeItem) => item.id === id
    );
    setFocusedItem({
      nid: item.id,
      field_date: item.dt,
      field_amount: item.sum,
      field_category: item.cat,
      field_description: item.dsc,
    });
    setShowEditModal(true);
  };

  const handleDelete = (id: string, token: string) => {
    setIsSubmitting(true);
    deleteNode(id, token, (response: Response) => {
      if (response.ok) {
        showNotification(
          t('notification.transactionDeleted'),
          notificationType.SUCCESS
        );
        setIsSubmitting(false);
      } else {
        showNotification(t('error.unknown'), notificationType.ERROR);
        setIsSubmitting(false);
      }
      setShowDeleteModal(false);
      fetchData(token, dataDispatch, dispatch);
    });
  };

  const months = items.groupedData ? Object.keys(items.groupedData) : [];
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const currentMonth = months[currentMonthIndex] || months[0] || '';

  useEffect(() => {
    if (months.length > 0 && currentMonthIndex === 0) {
      setCurrentMonthIndex(0);
    }
  }, [months.length]);

  // Filter transactions by search AND category
  const filteredTransactions = items.groupedData?.[currentMonth]?.filter(
    (transaction: TransactionOrIncomeItem) => {
      // Category filter
      if (selectedCategory !== '' && transaction.cat !== selectedCategory) {
        return false;
      }
      
      // Search filter
      if (searchText !== '') {
        const searchLower = searchText.toLowerCase();
        const descriptionMatch = transaction.dsc.toLowerCase().includes(searchLower);
        
        // Get category label and check if it matches
        const categoryLabel = localizedCategories.find(
          (cat) => cat.value === transaction.cat
        )?.label || '';
        const categoryMatch = categoryLabel.toLowerCase().includes(searchLower);
        
        return descriptionMatch || categoryMatch;
      }
      
      return true;
    }
  ) || [];

  // Auto-navigate to first month with filtered data
  useEffect(() => {
    if (hasFilters && filteredTransactions.length === 0 && months.length > 0 && items.groupedData) {
      // Search for first month with matching transactions
      for (let i = 0; i < months.length; i++) {
        const monthTransactions = items.groupedData[months[i]]?.filter(
          (transaction: TransactionOrIncomeItem) => {
            // Category filter
            if (selectedCategory !== '' && transaction.cat !== selectedCategory) {
              return false;
            }
            
            // Search filter
            if (searchText !== '') {
              const searchLower = searchText.toLowerCase();
              const descriptionMatch = transaction.dsc.toLowerCase().includes(searchLower);
              
              const categoryLabel = localizedCategories.find(
                (cat) => cat.value === transaction.cat
              )?.label || '';
              const categoryMatch = categoryLabel.toLowerCase().includes(searchLower);
              
              return descriptionMatch || categoryMatch;
            }
            
            return true;
          }
        ) || [];
        
        if (monthTransactions.length > 0) {
          setCurrentMonthIndex(i);
          break;
        }
      }
    }
  }, [searchText, selectedCategory]);

  // Calculate stats based on filtered transactions
  const filteredTotal = filteredTransactions.reduce(
    (sum, transaction) => sum + (typeof transaction.sum === 'string' ? parseFloat(transaction.sum) : transaction.sum),
    0
  );

  // Get income for current month (income is not filtered)
  const incomeTotals = items.incomeTotals;
  const monthIncome = incomeTotals ? incomeTotals[currentMonth] || 0 : 0;
  
  // Calculate profit based on filtered total
  const filteredProfit = parseFloat((monthIncome - filteredTotal).toFixed(2));

  // Decide which values to show - filtered or full month
  const hasFilters = searchText !== '' || selectedCategory !== '';
  const displayTotal = hasFilters ? filteredTotal : (items.totals?.[currentMonth] || 0);
  const displayIncome = monthIncome;
  const displayProfit = hasFilters ? filteredProfit : parseFloat((monthIncome - (items.totals?.[currentMonth] || 0)).toFixed(2));

  return (
    <div className="home1-page">
      {/* Delete Modal */}
      <Modal
        show={!!showDeleteModal}
        onClose={(e) => {
          e.preventDefault();
          setShowDeleteModal(false);
        }}
        title={t('modal.deleteTransaction')}
      >
        <p style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '1.5rem' }}>
          {t('modal.deleteMessage')}
        </p>
        <button
          onClick={() => showDeleteModal && handleDelete(showDeleteModal, token)}
          className="button danger wide"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <div className="loader">
              <span className="loader__element"></span>
              <span className="loader__element"></span>
              <span className="loader__element"></span>
            </div>
          ) : (
            <>
              <FaTrash />
              {t('common.delete')}
            </>
          )}
        </button>
      </Modal>

      {/* Edit Modal */}
      <Modal
        show={showEditModal}
        onClose={(e) => {
          e.preventDefault();
          setShowEditModal(false);
        }}
        title={t('transactionForm.editTransaction')}
      >
        <TransactionForm
          formType="edit"
          values={focusedItem}
          onSuccess={() => {
            setShowEditModal(false);
            fetchData(token, dataDispatch, dispatch);
          }}
        />
      </Modal>

      {/* Add Modal */}
      <Modal
        show={showAddModal}
        onClose={(e) => {
          e.preventDefault();
          setShowAddModal(false);
        }}
        title={t('transactionForm.addTransaction')}
      >
        <TransactionForm
          formType="add"
          values={{}}
          onSuccess={() => {
            setShowAddModal(false);
            fetchData(token, dataDispatch, dispatch);
          }}
        />
      </Modal>

      {loading ? (
        <div className="home1-loading">
          <div className="loader">
            <span className="loader__element"></span>
            <span className="loader__element"></span>
            <span className="loader__element"></span>
          </div>
        </div>
      ) : noData ? (
        <div className="home1-no-data">
          <p>{t('home.noData')}</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="home1-header">
            <h1>{currentMonth || t('home.title')}</h1>
            <p className="transaction-count">
              {filteredTransactions.length} transactions
            </p>
          </div>

          {/* Search Bar - For Both Views */}
          <div className="home1-search-wrapper">
            <SearchBar 
              searchValue={searchText}
              onSearchChange={setSearchText}
              categoryValue={selectedCategory}
              onCategoryChange={setSelectedCategory}
              categories={localizedCategories}
              placeholder="Search or filter by category..."
            />
          </div>

          {/* View Tabs - Below Search */}
          <div className="home1-view-tabs">
            <button
              className={`tab-button ${activeView === 'list' ? 'active' : ''}`}
              onClick={() => setActiveView('list')}
            >
              <FaList />
              <span>List</span>
            </button>
            <button
              className={`tab-button ${activeView === 'calendar' ? 'active' : ''}`}
              onClick={() => setActiveView('calendar')}
            >
              <FaCalendar />
              <span>Calendar</span>
            </button>
          </div>

          {/* Stats Cards - Show all 3 when no filters, only Total when filtered */}
          <div className={`home1-stats-grid ${hasFilters ? 'filtered' : ''}`}>
            <div className="home1-stat-card">
              <div className="stat-icon">
                <FaMoneyBillWave />
              </div>
              <div className="stat-value">{formatNumber(displayTotal)}</div>
              <div className="stat-label">Total</div>
            </div>
            
            {!hasFilters && (
              <>
                <div className="home1-stat-card">
                  <div className="stat-icon">
                    <FaUniversity />
                  </div>
                  <div className="stat-value">{formatNumber(displayIncome)}</div>
                  <div className="stat-label">Income</div>
                </div>

                <div className="home1-stat-card">
                  <div className="stat-icon">
                    <FaChartLine />
                  </div>
                  <div className="stat-value">{formatNumber(displayProfit)}</div>
                  <div className="stat-label">Profit</div>
                </div>
              </>
            )}
          </div>

          {/* Content - List or Calendar */}
          {activeView === 'list' ? (
            <div className="home1-transaction-wrapper">
              <TransactionList
                transactions={filteredTransactions}
                categoryLabels={localizedCategories}
                onEdit={handleEdit}
                onDelete={(id) => setShowDeleteModal(id)}
              />
            </div>
          ) : (
            <div className="home1-calendar-wrapper">
              <CalendarView
                transactions={filteredTransactions}
                currentMonth={currentMonth}
                categoryLabels={localizedCategories}
                onMonthChange={(direction) => {
                  if (direction === 'prev' && currentMonthIndex < months.length - 1) {
                    setCurrentMonthIndex(currentMonthIndex + 1);
                  } else if (direction === 'next' && currentMonthIndex > 0) {
                    setCurrentMonthIndex(currentMonthIndex - 1);
                  }
                }}
                onEdit={handleEdit}
                onDelete={(id) => setShowDeleteModal(id)}
              />
            </div>
          )}

          {/* Month Navigation - Sticky at Bottom (Only for List View) */}
          {activeView === 'list' && (
            <div className="home1-month-navigation-sticky">
              <button
                className="nav-button-sticky"
                onClick={() => setCurrentMonthIndex(currentMonthIndex + 1)}
                disabled={currentMonthIndex >= months.length - 1}
                aria-label="Previous month"
              >
                <FaChevronLeft />
              </button>
              
              <button
                className="nav-button-sticky"
                onClick={() => setCurrentMonthIndex(currentMonthIndex - 1)}
                disabled={currentMonthIndex <= 0}
                aria-label="Next month"
              >
                <FaChevronRight />
              </button>
            </div>
          )}

          {/* FAB */}
          <button 
            className="home1-fab" 
            onClick={() => setShowAddModal(true)}
            title="Add Transaction"
          >
            <FaPlus />
          </button>
        </>
      )}
    </div>
  );
};

export default Home1;