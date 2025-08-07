import React, { useState, useEffect } from 'react';
import { FaChartLine, FaWallet, FaCreditCard, FaPiggyBank, FaArrowUp, FaArrowDown, FaPlus } from 'react-icons/fa';
import { useAuthState } from '@context/context';
import { useData } from '@context/context';
import { formatNumber } from '@utils/utils';
import './Dashboard.scss';

interface DashboardStats {
  totalExpenses: number;
  totalIncome: number;
  totalLoans: number;
  netBalance: number;
  monthlyChange: number;
}

const Dashboard: React.FC = () => {
  const { data } = useData();
  const [stats, setStats] = useState<DashboardStats>({
    totalExpenses: 0,
    totalIncome: 0,
    totalLoans: 0,
    netBalance: 0,
    monthlyChange: 0,
  });

  useEffect(() => {
    if (data?.groupedData) {
      calculateStats();
    }
  }, [data]);

  const calculateStats = () => {
    let totalExpenses = 0;
    let totalIncome = 0;
    let totalLoans = 0;

    Object.values(data.groupedData).forEach((monthData: any) => {
      monthData.forEach((item: any) => {
        if (item.type === 'expense') {
          totalExpenses += parseFloat(item.sum);
        } else if (item.type === 'income') {
          totalIncome += parseFloat(item.sum);
        } else if (item.type === 'loan') {
          totalLoans += parseFloat(item.sum);
        }
      });
    });

    const netBalance = totalIncome - totalExpenses;
    const monthlyChange = ((netBalance - (totalIncome * 0.8)) / (totalIncome * 0.8)) * 100;

    setStats({
      totalExpenses,
      totalIncome,
      totalLoans,
      netBalance,
      monthlyChange,
    });
  };

  const StatCard: React.FC<{
    title: string;
    value: string;
    icon: React.ReactNode;
    gradient: string;
    change?: number;
  }> = ({ title, value, icon, gradient, change }) => (
    <div className={`dashboard-stat-card glass-card ${gradient}`}>
      <div className="stat-card-header">
        <div className="stat-icon">
          {icon}
        </div>
        {change !== undefined && (
          <div className={`stat-change ${change >= 0 ? 'positive' : 'negative'}`}>
            <span className="change-icon">
              {change >= 0 ? <FaArrowUp /> : <FaArrowDown />}
            </span>
            <span className="change-value">{Math.abs(change).toFixed(1)}%</span>
          </div>
        )}
      </div>
      <div className="stat-content">
        <h3 className="stat-title">{title}</h3>
        <p className="stat-value">{value}</p>
      </div>
    </div>
  );

  const QuickAction: React.FC<{
    title: string;
    icon: React.ReactNode;
    onClick: () => void;
    gradient: string;
  }> = ({ title, icon, onClick, gradient }) => (
    <button className={`quick-action glass-button ${gradient}`} onClick={onClick}>
      <div className="action-icon">{icon}</div>
      <span className="action-title">{title}</span>
    </button>
  );

  return (
    <div className="dashboard-container animate-fade-in">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Financial Dashboard</h1>
        <p className="dashboard-subtitle">Track your expenses, income, and loans</p>
      </div>

      <div className="dashboard-stats-grid">
        <StatCard
          title="Total Income"
          value={`$${formatNumber(stats.totalIncome)}`}
          icon={<FaWallet />}
          gradient="gradient-success"
          change={stats.monthlyChange}
        />
        
        <StatCard
          title="Total Expenses"
          value={`$${formatNumber(stats.totalExpenses)}`}
          icon={<FaChartLine />}
          gradient="gradient-danger"
        />
        
        <StatCard
          title="Net Balance"
          value={`$${formatNumber(stats.netBalance)}`}
          icon={<FaPiggyBank />}
          gradient="gradient-primary"
        />
        
        <StatCard
          title="Active Loans"
          value={`$${formatNumber(stats.totalLoans)}`}
          icon={<FaCreditCard />}
          gradient="gradient-warning"
        />
      </div>

      <div className="dashboard-actions">
        <h2 className="actions-title">Quick Actions</h2>
        <div className="actions-grid">
          <QuickAction
            title="Add Expense"
            icon={<FaPlus />}
            onClick={() => {/* Navigate to add expense */}}
            gradient="gradient-danger"
          />
          <QuickAction
            title="Add Income"
            icon={<FaPlus />}
            onClick={() => {/* Navigate to add income */}}
            gradient="gradient-success"
          />
          <QuickAction
            title="Add Loan"
            icon={<FaPlus />}
            onClick={() => {/* Navigate to add loan */}}
            gradient="gradient-warning"
          />
          <QuickAction
            title="View Reports"
            icon={<FaChartLine />}
            onClick={() => {/* Navigate to reports */}}
            gradient="gradient-primary"
          />
        </div>
      </div>

      <div className="dashboard-charts">
        <div className="chart-section glass-card">
          <h3 className="chart-title">Monthly Overview</h3>
          <div className="chart-placeholder">
            <FaChartLine className="chart-icon" />
            <p>Charts will be displayed here</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;