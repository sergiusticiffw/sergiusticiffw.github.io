import React, { useState } from 'react';
import { FaPlus, FaCalculator, FaCalendarAlt, FaPercent, FaDollarSign } from 'react-icons/fa';
import './LoanManager.scss';

interface Loan {
  id: string;
  name: string;
  amount: number;
  interestRate: number;
  term: number;
  startDate: string;
  monthlyPayment: number;
  remainingBalance: number;
  status: 'active' | 'paid' | 'overdue';
}

const LoanManager: React.FC = () => {
  const [loans, setLoans] = useState<Loan[]>([
    {
      id: '1',
      name: 'Student Loan',
      amount: 25000,
      interestRate: 4.5,
      term: 120,
      startDate: '2023-01-15',
      monthlyPayment: 259.12,
      remainingBalance: 22000,
      status: 'active',
    },
    {
      id: '2',
      name: 'Car Loan',
      amount: 15000,
      interestRate: 6.2,
      term: 60,
      startDate: '2023-06-01',
      monthlyPayment: 291.45,
      remainingBalance: 12000,
      status: 'active',
    },
  ]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newLoan, setNewLoan] = useState({
    name: '',
    amount: '',
    interestRate: '',
    term: '',
    startDate: '',
  });

  const calculateMonthlyPayment = (amount: number, rate: number, term: number) => {
    const monthlyRate = rate / 100 / 12;
    const payment = (amount * monthlyRate * Math.pow(1 + monthlyRate, term)) / 
                   (Math.pow(1 + monthlyRate, term) - 1);
    return payment;
  };

  const handleAddLoan = () => {
    if (newLoan.name && newLoan.amount && newLoan.interestRate && newLoan.term) {
      const amount = parseFloat(newLoan.amount);
      const rate = parseFloat(newLoan.interestRate);
      const term = parseInt(newLoan.term);
      const monthlyPayment = calculateMonthlyPayment(amount, rate, term);

      const loan: Loan = {
        id: Date.now().toString(),
        name: newLoan.name,
        amount,
        interestRate: rate,
        term,
        startDate: newLoan.startDate || new Date().toISOString().split('T')[0],
        monthlyPayment,
        remainingBalance: amount,
        status: 'active',
      };

      setLoans([...loans, loan]);
      setNewLoan({ name: '', amount: '', interestRate: '', term: '', startDate: '' });
      setShowAddForm(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'gradient-success';
      case 'paid':
        return 'gradient-primary';
      case 'overdue':
        return 'gradient-danger';
      default:
        return 'gradient-warning';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return '🟢';
      case 'paid':
        return '✅';
      case 'overdue':
        return '🔴';
      default:
        return '🟡';
    }
  };

  const totalLoans = loans.reduce((sum, loan) => sum + loan.remainingBalance, 0);
  const totalMonthlyPayments = loans.reduce((sum, loan) => sum + loan.monthlyPayment, 0);

  return (
    <div className="loan-manager-container animate-fade-in">
      <div className="loan-manager-header">
        <h1 className="loan-manager-title">Loan Management</h1>
        <p className="loan-manager-subtitle">Track and manage your loans</p>
      </div>

      <div className="loan-summary-grid">
        <div className="summary-card glass-card gradient-primary">
          <div className="summary-icon">
            <FaDollarSign />
          </div>
          <div className="summary-content">
            <h3>Total Outstanding</h3>
            <p className="summary-value">${totalLoans.toLocaleString()}</p>
          </div>
        </div>

        <div className="summary-card glass-card gradient-warning">
          <div className="summary-icon">
            <FaCalculator />
          </div>
          <div className="summary-content">
            <h3>Monthly Payments</h3>
            <p className="summary-value">${totalMonthlyPayments.toFixed(2)}</p>
          </div>
        </div>

        <div className="summary-card glass-card gradient-success">
          <div className="summary-icon">
            <FaCalendarAlt />
          </div>
          <div className="summary-content">
            <h3>Active Loans</h3>
            <p className="summary-value">{loans.filter(l => l.status === 'active').length}</p>
          </div>
        </div>
      </div>

      <div className="loan-actions">
        <button
          className="add-loan-button glass-button gradient-primary"
          onClick={() => setShowAddForm(true)}
        >
          <FaPlus />
          <span>Add New Loan</span>
        </button>
      </div>

      {showAddForm && (
        <div className="add-loan-form glass-card">
          <h3>Add New Loan</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Loan Name</label>
              <input
                type="text"
                value={newLoan.name}
                onChange={(e) => setNewLoan({ ...newLoan, name: e.target.value })}
                placeholder="e.g., Student Loan"
              />
            </div>
            <div className="form-group">
              <label>Amount ($)</label>
              <input
                type="number"
                value={newLoan.amount}
                onChange={(e) => setNewLoan({ ...newLoan, amount: e.target.value })}
                placeholder="25000"
              />
            </div>
            <div className="form-group">
              <label>Interest Rate (%)</label>
              <input
                type="number"
                step="0.1"
                value={newLoan.interestRate}
                onChange={(e) => setNewLoan({ ...newLoan, interestRate: e.target.value })}
                placeholder="4.5"
              />
            </div>
            <div className="form-group">
              <label>Term (months)</label>
              <input
                type="number"
                value={newLoan.term}
                onChange={(e) => setNewLoan({ ...newLoan, term: e.target.value })}
                placeholder="120"
              />
            </div>
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="date"
                value={newLoan.startDate}
                onChange={(e) => setNewLoan({ ...newLoan, startDate: e.target.value })}
              />
            </div>
          </div>
          <div className="form-actions">
            <button
              className="cancel-button glass-button"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </button>
            <button
              className="save-button glass-button gradient-success"
              onClick={handleAddLoan}
            >
              Add Loan
            </button>
          </div>
        </div>
      )}

      <div className="loans-grid">
        {loans.map((loan) => (
          <div key={loan.id} className={`loan-card glass-card ${getStatusColor(loan.status)}`}>
            <div className="loan-header">
              <div className="loan-info">
                <h3 className="loan-name">{loan.name}</h3>
                <div className="loan-status">
                  <span className="status-icon">{getStatusIcon(loan.status)}</span>
                  <span className="status-text">{loan.status}</span>
                </div>
              </div>
              <div className="loan-amount">
                <span className="amount-label">Remaining</span>
                <span className="amount-value">${loan.remainingBalance.toLocaleString()}</span>
              </div>
            </div>

            <div className="loan-details">
              <div className="detail-row">
                <span className="detail-label">Original Amount:</span>
                <span className="detail-value">${loan.amount.toLocaleString()}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Interest Rate:</span>
                <span className="detail-value">{loan.interestRate}%</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Monthly Payment:</span>
                <span className="detail-value">${loan.monthlyPayment.toFixed(2)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Term:</span>
                <span className="detail-value">{loan.term} months</span>
              </div>
            </div>

            <div className="loan-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${((loan.amount - loan.remainingBalance) / loan.amount) * 100}%`,
                  }}
                />
              </div>
              <span className="progress-text">
                {((loan.amount - loan.remainingBalance) / loan.amount * 100).toFixed(1)}% paid
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoanManager;