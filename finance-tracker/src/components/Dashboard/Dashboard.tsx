import React from 'react';
import { motion } from 'framer-motion';
import {
  FiTrendingUp,
  FiTrendingDown,
  FiDollarSign,
  FiCreditCard,
  FiArrowUpRight,
  FiArrowDownRight
} from 'react-icons/fi';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { format } from 'date-fns';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  // Sample data
  const monthlyData = [
    { month: 'Jan', income: 5000, expenses: 3200 },
    { month: 'Feb', income: 5500, expenses: 3500 },
    { month: 'Mar', income: 6200, expenses: 3800 },
    { month: 'Apr', income: 5800, expenses: 3400 },
    { month: 'May', income: 6500, expenses: 4000 },
    { month: 'Jun', income: 7000, expenses: 4200 },
  ];

  const categoryData = [
    { name: 'Food & Dining', value: 1200, color: '#8b5cf6' },
    { name: 'Transportation', value: 800, color: '#ec4899' },
    { name: 'Shopping', value: 600, color: '#f59e0b' },
    { name: 'Entertainment', value: 400, color: '#10b981' },
    { name: 'Bills', value: 1500, color: '#3b82f6' },
  ];

  const stats = [
    {
      title: 'Total Income',
      value: '$37,000',
      change: '+12.5%',
      trend: 'up',
      icon: FiTrendingUp,
      gradient: 'gradient-1',
    },
    {
      title: 'Total Expenses',
      value: '$22,900',
      change: '+5.2%',
      trend: 'up',
      icon: FiTrendingDown,
      gradient: 'gradient-2',
    },
    {
      title: 'Net Balance',
      value: '$14,100',
      change: '+18.7%',
      trend: 'up',
      icon: FiDollarSign,
      gradient: 'gradient-3',
    },
    {
      title: 'Active Loans',
      value: '3',
      change: '$2,450/mo',
      trend: 'neutral',
      icon: FiCreditCard,
      gradient: 'gradient-4',
    },
  ];

  const recentTransactions = [
    { id: 1, description: 'Grocery Store', amount: -125.50, date: new Date(), category: 'Food' },
    { id: 2, description: 'Salary Deposit', amount: 5000, date: new Date(), category: 'Income' },
    { id: 3, description: 'Netflix Subscription', amount: -15.99, date: new Date(), category: 'Entertainment' },
    { id: 4, description: 'Gas Station', amount: -45.00, date: new Date(), category: 'Transportation' },
    { id: 5, description: 'Freelance Payment', amount: 800, date: new Date(), category: 'Income' },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
    },
  };

  return (
    <motion.div
      className="dashboard"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="dashboard-header">
        <motion.h1 variants={itemVariants}>Financial Overview</motion.h1>
        <motion.p variants={itemVariants} className="dashboard-subtitle">
          Welcome back! Here's your financial summary for {format(new Date(), 'MMMM yyyy')}
        </motion.p>
      </div>

      <motion.div className="stats-grid" variants={itemVariants}>
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={index}
              className="stat-card"
              whileHover={{ y: -5 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <div className={`stat-icon ${stat.gradient}`}>
                <Icon size={24} />
              </div>
              <div className="stat-content">
                <p className="stat-title">{stat.title}</p>
                <h3 className="stat-value">{stat.value}</h3>
                <div className="stat-change">
                  {stat.trend === 'up' ? (
                    <FiArrowUpRight className="trend-icon up" />
                  ) : stat.trend === 'down' ? (
                    <FiArrowDownRight className="trend-icon down" />
                  ) : null}
                  <span className={`change-value ${stat.trend}`}>{stat.change}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <div className="charts-grid">
        <motion.div className="chart-card" variants={itemVariants}>
          <h3>Income vs Expenses</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--dark-surface)',
                  border: '1px solid var(--dark-border)',
                  borderRadius: '8px',
                }}
              />
              <Area
                type="monotone"
                dataKey="income"
                stroke="#10b981"
                fillOpacity={1}
                fill="url(#incomeGradient)"
              />
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="#ef4444"
                fillOpacity={1}
                fill="url(#expenseGradient)"
              />
              <Legend />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div className="chart-card" variants={itemVariants}>
          <h3>Expense Categories</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--dark-surface)',
                  border: '1px solid var(--dark-border)',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      <motion.div className="recent-transactions" variants={itemVariants}>
        <h3>Recent Transactions</h3>
        <div className="transactions-list">
          {recentTransactions.map((transaction) => (
            <motion.div
              key={transaction.id}
              className="transaction-item"
              whileHover={{ x: 5 }}
            >
              <div className="transaction-info">
                <p className="transaction-description">{transaction.description}</p>
                <p className="transaction-category">{transaction.category}</p>
              </div>
              <div className="transaction-details">
                <p className={`transaction-amount ${transaction.amount > 0 ? 'income' : 'expense'}`}>
                  {transaction.amount > 0 ? '+' : ''}{transaction.amount.toFixed(2)}
                </p>
                <p className="transaction-date">{format(transaction.date, 'MMM dd')}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Dashboard;