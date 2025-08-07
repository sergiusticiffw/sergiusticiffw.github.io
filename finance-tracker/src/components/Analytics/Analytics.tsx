import React from 'react';
import { motion } from 'framer-motion';
import './Analytics.css';

const Analytics: React.FC = () => {
  return (
    <motion.div
      className="analytics"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h1>Analytics</h1>
      <p>Detailed financial analytics coming soon...</p>
    </motion.div>
  );
};

export default Analytics;