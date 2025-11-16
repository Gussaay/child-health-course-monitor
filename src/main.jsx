import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Buffer } from 'buffer';
window.Buffer = Buffer;
import { DataProvider } from './DataContext'; // Import DataProvider
import './index.css'; // Add this line to import your stylesheet

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <DataProvider>
      <App />
    </DataProvider>
  </React.StrictMode>
);