import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1a2e',
            color: '#f0f0ff',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            fontSize: '0.875rem',
            fontFamily: 'Inter, sans-serif'
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#1a1a2e' },
            duration: 3000
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#1a1a2e' },
            duration: 4000
          }
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
