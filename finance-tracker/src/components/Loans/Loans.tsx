import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPlus,
  FiPercent,
  FiCalendar,
  FiDollarSign,
  FiTrendingUp,
  FiTrendingDown,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiX
} from 'react-icons/fi';
import { format, differenceInMonths, addMonths } from 'date-fns';
import './Loans.css';
import { Loan } from '../../types';

const Loans: React.FC = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);

  // Sample loans data
  const [loans] = useState<Loan[]>([
    {
      id: '1',
      name: 'Car Loan',
      type: 'taken',
      amount: 25000,
      interestRate: 4.5,
      startDate: new Date('2023-01-15'),
      endDate: new Date('2028-01-15'),
      monthlyPayment: 466.08,
      remainingAmount: 22500,
      status: 'active'
    },
    {
      id: '2',
      name: 'Personal Loan to John',
      type: 'given',
      amount: 5000,
      interestRate: 3,
      startDate: new Date('2023-06-01'),
      endDate: new Date('2024-06-01'),
      monthlyPayment: 421.60,
      remainingAmount: 2500,
      status: 'active'
    },
    {
      id: '3',
      name: 'Home Renovation Loan',
      type: 'taken',
      amount: 15000,
      interestRate: 5.2,
      startDate: new Date('2022-09-01'),
      endDate: new Date('2025-09-01'),
      monthlyPayment: 451.13,
      remainingAmount: 8000,
      status: 'active'
    },
    {
      id: '4',
      name: 'Student Loan',
      type: 'taken',
      amount: 30000,
      interestRate: 3.5,
      startDate: new Date('2020-08-01'),
      endDate: new Date('2030-08-01'),
      monthlyPayment: 298.36,
      remainingAmount: 0,
      status: 'paid'
    }
  ]);

  const activeLoansTaken = loans.filter(loan => loan.type === 'taken' && loan.status === 'active');
  const activeLoansGiven = loans.filter(loan => loan.type === 'given' && loan.status === 'active');
  
  const totalDebt = activeLoansTaken.reduce((sum, loan) => sum + loan.remainingAmount, 0);
  const totalLent = activeLoansGiven.reduce((sum, loan) => sum + loan.remainingAmount, 0);
  const monthlyPayments = activeLoansTaken.reduce((sum, loan) => sum + loan.monthlyPayment, 0);
  const monthlyIncome = activeLoansGiven.reduce((sum, loan) => sum + loan.monthlyPayment, 0);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <FiClock className="status-icon active" />;
      case 'paid':
        return <FiCheckCircle className="status-icon paid" />;
      case 'overdue':
        return <FiAlertCircle className="status-icon overdue" />;
      default:
        return null;
    }
  };

  const calculateProgress = (loan: Loan) => {
    const totalAmount = loan.amount;
    const paidAmount = totalAmount - loan.remainingAmount;
    return (paidAmount / totalAmount) * 100;
  };

  const AddLoanModal = () => {
    const [formData, setFormData] = useState({
      name: '',
      type: 'taken',
      amount: '',
      interestRate: '',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      duration: '12',
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
                <h2>Add New Loan</h2>
                <button className="close-button" onClick={() => setShowAddModal(false)}>
                  <FiX size={20} />
                </button>
              </div>

              <form className="loan-form">
                <div className="form-group">
                  <label>Loan Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Car Loan, Personal Loan"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Type</label>
                  <div className="type-selector">
                    <button
                      type="button"
                      className={`type-button ${formData.type === 'taken' ? 'active taken' : ''}`}
                      onClick={() => setFormData({ ...formData, type: 'taken' })}
                    >
                      <FiTrendingDown size={16} />
                      Loan Taken
                    </button>
                    <button
                      type="button"
                      className={`type-button ${formData.type === 'given' ? 'active given' : ''}`}
                      onClick={() => setFormData({ ...formData, type: 'given' })}
                    >
                      <FiTrendingUp size={16} />
                      Loan Given
                    </button>
                  </div>
                </div>

                <div className="form-row">
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
                    <label>Interest Rate (%)</label>
                    <input
                      type="number"
                      placeholder="0.0"
                      step="0.1"
                      value={formData.interestRate}
                      onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Start Date</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Duration (months)</label>
                    <input
                      type="number"
                      placeholder="12"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="cancel-button" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="submit-button">
                    Add Loan
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const LoanDetails = ({ loan }: { loan: Loan }) => {
    const progress = calculateProgress(loan);
    const monthsRemaining = differenceInMonths(loan.endDate, new Date());
    const totalInterest = (loan.monthlyPayment * differenceInMonths(loan.endDate, loan.startDate)) - loan.amount;

    return (
      <AnimatePresence>
        {selectedLoan?.id === loan.id && (
          <motion.div
            className="loan-details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="details-grid">
              <div className="detail-item">
                <span className="detail-label">Total Amount</span>
                <span className="detail-value">${loan.amount.toFixed(2)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Remaining</span>
                <span className="detail-value">${loan.remainingAmount.toFixed(2)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Monthly Payment</span>
                <span className="detail-value">${loan.monthlyPayment.toFixed(2)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Interest Rate</span>
                <span className="detail-value">{loan.interestRate}%</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Total Interest</span>
                <span className="detail-value">${totalInterest.toFixed(2)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Months Remaining</span>
                <span className="detail-value">{monthsRemaining > 0 ? monthsRemaining : 0}</span>
              </div>
            </div>
            
            <div className="loan-actions">
              <button className="action-button pay">Make Payment</button>
              <button className="action-button view">View Schedule</button>
              <button className="action-button edit">Edit Details</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  return (
    <div className="loans">
      <div className="loans-header">
        <h1>Loans Management</h1>
        <motion.button
          className="add-button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddModal(true)}
        >
          <FiPlus size={20} />
          Add Loan
        </motion.button>
      </div>

      <div className="loans-summary">
        <motion.div 
          className="summary-card debt"
          whileHover={{ y: -5 }}
        >
          <div className="summary-icon">
            <FiTrendingDown size={24} />
          </div>
          <div className="summary-content">
            <h3>Total Debt</h3>
            <p className="amount">${totalDebt.toFixed(2)}</p>
            <span className="subtitle">Monthly: ${monthlyPayments.toFixed(2)}</span>
          </div>
        </motion.div>

        <motion.div 
          className="summary-card lent"
          whileHover={{ y: -5 }}
        >
          <div className="summary-icon">
            <FiTrendingUp size={24} />
          </div>
          <div className="summary-content">
            <h3>Total Lent</h3>
            <p className="amount">${totalLent.toFixed(2)}</p>
            <span className="subtitle">Monthly: ${monthlyIncome.toFixed(2)}</span>
          </div>
        </motion.div>

        <motion.div 
          className="summary-card active"
          whileHover={{ y: -5 }}
        >
          <div className="summary-icon">
            <FiClock size={24} />
          </div>
          <div className="summary-content">
            <h3>Active Loans</h3>
            <p className="amount">{activeLoansTaken.length + activeLoansGiven.length}</p>
            <span className="subtitle">{activeLoansTaken.length} taken, {activeLoansGiven.length} given</span>
          </div>
        </motion.div>

        <motion.div 
          className="summary-card net"
          whileHover={{ y: -5 }}
        >
          <div className="summary-icon">
            <FiDollarSign size={24} />
          </div>
          <div className="summary-content">
            <h3>Net Position</h3>
            <p className={`amount ${totalLent - totalDebt >= 0 ? 'positive' : 'negative'}`}>
              ${Math.abs(totalLent - totalDebt).toFixed(2)}
            </p>
            <span className="subtitle">{totalLent - totalDebt >= 0 ? 'Net Lender' : 'Net Borrower'}</span>
          </div>
        </motion.div>
      </div>

      <div className="loans-list">
        <h2>Your Loans</h2>
        <AnimatePresence>
          {loans.map((loan, index) => (
            <motion.div
              key={loan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <motion.div
                className={`loan-card ${loan.type} ${selectedLoan?.id === loan.id ? 'expanded' : ''}`}
                onClick={() => setSelectedLoan(selectedLoan?.id === loan.id ? null : loan)}
                whileHover={{ x: 5 }}
              >
                <div className="loan-header">
                  <div className="loan-info">
                    <h3>{loan.name}</h3>
                    <p className="loan-meta">
                      {loan.type === 'taken' ? 'Borrowed' : 'Lent'} • 
                      {loan.interestRate}% APR • 
                      Started {format(loan.startDate, 'MMM yyyy')}
                    </p>
                  </div>
                  <div className="loan-status">
                    {getStatusIcon(loan.status)}
                    <span className={`status-text ${loan.status}`}>{loan.status}</span>
                  </div>
                </div>

                <div className="loan-progress">
                  <div className="progress-info">
                    <span>Progress</span>
                    <span>{progress.toFixed(0)}%</span>
                  </div>
                  <div className="progress-bar">
                    <motion.div 
                      className="progress-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 1, delay: index * 0.1 }}
                    />
                  </div>
                  <div className="progress-amounts">
                    <span>${(loan.amount - loan.remainingAmount).toFixed(2)} paid</span>
                    <span>${loan.remainingAmount.toFixed(2)} remaining</span>
                  </div>
                </div>
              </motion.div>
              
              <LoanDetails loan={loan} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AddLoanModal />
    </div>
  );
};

export default Loans;