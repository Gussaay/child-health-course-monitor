// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Buffer } from 'buffer';
window.Buffer = Buffer;

// CORRECTED: Import from DataContext, not DataProvider
import { DataProvider } from './DataContext'; 
import './index.css';

// --- SERVICE WORKER REGISTRATION ---
import { registerSW } from 'virtual:pwa-register';

// Automatically updates the service worker when new content is available
registerSW({ immediate: true });
// ------------------------------------

// --- CACHE CLEANUP SCRIPT ---
// This silently finds and destroys the old broken JS cache for all existing users
if ('caches' in window) {
  caches.keys().then((cacheNames) => {
    cacheNames.forEach((cacheName) => {
      // Look for the specific bad cache name from your old config
      if (cacheName.includes('app-shell-code')) {
        caches.delete(cacheName).then(() => {
          console.log(`Successfully deleted old poisoned cache: ${cacheName}`);
          // The browser will automatically fetch the fresh files from the network next time
        });
      }
    });
  });
}
// ----------------------------

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <DataProvider>
      <App />
    </DataProvider>
  </React.StrictMode>
);