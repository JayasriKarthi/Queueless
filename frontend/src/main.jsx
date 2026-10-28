import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { restoreSession } from './lib/fakeBackend';
import './index.css';

// Logged in before? The refresh cookie brings the session back. Pages behind a login wait for
// this check; other tabs stay in sync through the server's live events, not localStorage.
restoreSession();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>,
);
