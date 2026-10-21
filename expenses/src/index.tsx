import React from 'react';
import ReactDOM from 'react-dom/client'; // Note the updated import
import './index.css';
import App from './App';
import { registerSW } from 'virtual:pwa-register';

// @ts-expect-error
registerSW({ immediate: true, scope: '/expenses/' });

// A service worker left over from a preview on this port keeps controlling
// the dev page and fails cross-origin loads such as Google sign-in.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(async (registrations) => {
    if (registrations.length === 0) return;
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if (navigator.serviceWorker.controller && sessionStorage.getItem('expenses-dev-sw-cleared') !== '1') {
      sessionStorage.setItem('expenses-dev-sw-cleared', '1');
      window.location.reload();
    }
  });
}

// Create the root and render the app
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
