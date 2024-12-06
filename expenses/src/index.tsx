import React from 'react';
import ReactDOM from 'react-dom/client'; // Note the updated import
import './index.css';
import App from './App';
import { registerSW } from 'virtual:pwa-register';

// @ts-expect-error
registerSW({ immediate: true, scope: '/expenses/' });

// Create the root and render the app
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
