import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Ensure traffic to *.vercel.app is seamlessly redirected to canonical https://bowerjj.com
if (typeof window !== 'undefined' && window.location.hostname.endsWith('vercel.app')) {
  window.location.replace(`https://bowerjj.com${window.location.pathname}${window.location.search}${window.location.hash}`);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
