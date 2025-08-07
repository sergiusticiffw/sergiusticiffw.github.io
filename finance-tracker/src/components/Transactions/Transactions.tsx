import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPlus,
  FiFilter,
  FiSearch,
  FiCalendar,
  FiDollarSign,
  FiShoppingBag,
  FiHome,
  FiTruck,
  FiFilm,
  FiHeart,
  FiTrendingUp,
  FiX
} from 'react-icons/fi';
import { format } from 'date-fns';
import './Transactions.css';
import { Transaction } from '../../types';

const categoryIcons: { [key: string]: any } = {
  'Food & Dining': FiShoppingBag,
  'Transportation': FiTruck,
  'Shopping': FiShoppingBag,
  'Entertainment': FiFilm,
  'Bills': FiHome,
  'Healthcare': FiHeart,
  'Income': FiTrendingUp,
  'Other': FiDollarSign,
};

const Transactions: React.FC = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  // Sample transactions data
  const [transactions] = useState<Transaction[]>([
    { id: '1', type: 'expense', category: 'Food & Dining', amount: 125.50, description: 'Grocery Store', date: new Date(), recurring: false },
    { id: '2', type: 'income', category: 'Income', amount: 5000, description: 'Monthly Salary', date: new Date(), recurring: true },
    { id: '3', type: 'expense', category: 'Entertainment', amount: 15.99, description: 'Netflix Subscription', date: new Date(), recurring: true },
    { id: '4', type: 'expense', category: 'Transportation', amount: 45.00, description: 'Gas Station', date: new Date(), recurring: false },
    { id: '5', type: 'income', category: 'Income', amount: 800, description: 'Freelance Project', date: new Date(), recurring: false },
    { id: '6', type: 'expense', category: 'Bills', amount: 1200, description: 'Rent Payment', date: new Date(), recurring: true },
    { id: '7', type: 'expense', category: 'Shopping', amount: 89.99, description: 'Amazon Purchase', date: new Date(), recurring: false },
    { id: '8', type: 'expense', category: 'Healthcare', amount: 50, description: 'Doctor Visit', date: new Date(), recurring: false },
  ]);

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || transaction.type === filterType;
    const matchesMonth = format(transaction.date, 'yyyy-MM') === selectedMonth;
    
    return matchesSearch && matchesType && matchesMonth;
  });

  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const AddTransactionModal = () => {
    const [formData, setFormData] = useState({
      type: 'expense',
      category: 'Food & Dining',
      amount: '',
      description: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      recurring: false,
    });

    return (
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              className="modal-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>Add Transaction</h2>
                <button className="close-button" onClick={() => setShowAddModal(false)}>
                  <FiX size={20} />
                </button>
              </div>

              <form className="transaction-form">
                <div className="form-group">
                  <label>Type</label>
                  <div className="type-selector">
                    <button
                      type="button"
                      className={`type-button ${formData.type === 'income' ? 'active income' : ''}`}
                      onClick={() => setFormData({ ...formData, type: 'income' })}
                    >
                      Income
                    </button>
                    <button
                      type="button"
                      className={`type-button ${formData.type === 'expense' ? 'active expense' : ''}`}
                      onClick={() => setFormData({ ...formData, type: 'expense' })}
                    >
                      Expense
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    {formData.type === 'income' ? (
                      <option value="Income">Income</option>
                    ) : (
                      <>
                        <option value="Food & Dining">Food & Dining</option>
                        <option value="Transportation">Transportation</option>
                        <option value="Shopping">Shopping</option>
                        <option value="Entertainment">Entertainment</option>
                        <option value="Bills">Bills</option>
                        <option value="Healthcare">Healthcare</option>
                        <option value="Other">Other</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label>Amount</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <input
                    type="text"
                    placeholder="Enter description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.recurring}
                      onChange={(e) => setFormData({ ...formData, recurring: e.target.checked })}
                    />
                    <span>Recurring transaction</span>
                  </label>
                </div>

                <div className="form-actions">
                  <button type="button" className="cancel-button" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="submit-button">
                    Add Transaction
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  return (
    <div className="transactions">
      <div className="transactions-header">
        <h1>Transactions</h1>
        <motion.button
          className="add-button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddModal(true)}
        >
          <FiPlus size={20} />
          Add Transaction
        </motion.button>
      </div>

      <div className="transactions-summary">
        <div className="summary-card income">
          <h3>Total Income</h3>
          <p>${totalIncome.toFixed(2)}</p>
        </div>
        <div className="summary-card expense">
          <h3>Total Expenses</h3>
          <p>${totalExpenses.toFixed(2)}</p>
        </div>
        <div className="summary-card balance">
          <h3>Net Balance</h3>
          <p className={totalIncome - totalExpenses >= 0 ? 'positive' : 'negative'}>
            ${(totalIncome - totalExpenses).toFixed(2)}
          </p>
        </div>
      </div>

      <div className="transactions-filters">
        <div className="search-box">
          <FiSearch size={20} />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <div className="filter-buttons">
            <button
              className={`filter-button ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              All
            </button>
            <button
              className={`filter-button ${filterType === 'income' ? 'active' : ''}`}
              onClick={() => setFilterType('income')}
            >
              Income
            </button>
            <button
              className={`filter-button ${filterType === 'expense' ? 'active' : ''}`}
              onClick={() => setFilterType('expense')}
            >
              Expense
            </button>
          </div>

          <div className="month-selector">
            <FiCalendar size={20} />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>
        </div>
      </div>

      <motion.div className="transactions-list">
        <AnimatePresence>
          {filteredTransactions.map((transaction) => {
            const Icon = categoryIcons[transaction.category] || FiDollarSign;
            
            return (
              <motion.div
                key={transaction.id}
                className="transaction-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                whileHover={{ x: 5 }}
              >
                <div className="transaction-icon">
                  <Icon size={20} />
                </div>
                
                <div className="transaction-details">
                  <h4>{transaction.description}</h4>
                  <p>{transaction.category} • {format(transaction.date, 'MMM dd, yyyy')}</p>
                  {transaction.recurring && (
                    <span className="recurring-badge">Recurring</span>
                  )}
                </div>
                
                <div className={`transaction-amount ${transaction.type}`}>
                  {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toFixed(2)}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      <AddTransactionModal />
    </div>
  );
};

export default Transactions;