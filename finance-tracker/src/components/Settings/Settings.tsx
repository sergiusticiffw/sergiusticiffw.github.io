import React from 'react';
import { motion } from 'framer-motion';
import './Settings.css';

const Settings: React.FC = () => {
  return (
    <motion.div
      className="settings"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h1>Settings</h1>
      <p>Application settings coming soon...</p>
    </motion.div>
  );
};

export default Settings;