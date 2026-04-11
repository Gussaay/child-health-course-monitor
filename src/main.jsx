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

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <DataProvider>
      <App />
    </DataProvider>
  </React.StrictMode>
);