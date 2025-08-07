import React from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import {
  FiHome,
  FiDollarSign,
  FiCreditCard,
  FiPieChart,
  FiSettings,
  FiMenu,
  FiX
} from 'react-icons/fi';
import './Sidebar.css';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

const menuItems = [
  { path: '/', icon: FiHome, label: 'Dashboard' },
  { path: '/transactions', icon: FiDollarSign, label: 'Transactions' },
  { path: '/loans', icon: FiCreditCard, label: 'Loans' },
  { path: '/analytics', icon: FiPieChart, label: 'Analytics' },
  { path: '/settings', icon: FiSettings, label: 'Settings' },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar }) => {
  const location = useLocation();

  const sidebarVariants = {
    open: { x: 0 },
    closed: { x: '-100%' },
  };

  return (
    <>
      <motion.div
        className="sidebar"
        initial="closed"
        animate={isOpen ? 'open' : 'closed'}
        variants={sidebarVariants}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="sidebar-header">
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            FinanceFlow
          </motion.h2>
          <button className="sidebar-toggle desktop-hidden" onClick={toggleSidebar}>
            <FiX size={24} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <motion.div
                key={item.path}
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  to={item.path}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => window.innerWidth < 768 && toggleSidebar()}
                >
                  <motion.div
                    className="nav-item-content"
                    whileHover={{ x: 5 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </motion.div>
                  {isActive && (
                    <motion.div
                      className="active-indicator"
                      layoutId="activeIndicator"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    />
                  )}
                </Link>
              </motion.div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <motion.div
            className="user-profile"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div className="user-avatar">JD</div>
            <div className="user-info">
              <p className="user-name">John Doe</p>
              <p className="user-email">john@example.com</p>
            </div>
          </motion.div>
        </div>
      </motion.div>

      <button className="sidebar-toggle mobile-only" onClick={toggleSidebar}>
        <FiMenu size={24} />
      </button>

      {isOpen && (
        <motion.div
          className="sidebar-overlay mobile-only"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={toggleSidebar}
        />
      )}
    </>
  );
};

export default Sidebar;