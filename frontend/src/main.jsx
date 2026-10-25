import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { useAuthStore } from './store/authStore';
import { useBusinessStore } from './store/businessStore';
import { useQueueStore } from './store/queueStore';
import { useUiStore } from './store/uiStore';
import { STORE_KEYS } from './config/constants';
import './index.css';

// Keep separate tabs in sync: when another tab writes a store, reload it here.
const STORES = { [STORE_KEYS.auth]: useAuthStore, [STORE_KEYS.business]: useBusinessStore, [STORE_KEYS.queue]: useQueueStore, [STORE_KEYS.ui]: useUiStore };
window.addEventListener('storage', (e) => {
  const store = STORES[e.key];
  if (store) store.persist.rehydrate();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>,
);
