import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/geist';
import '@fontsource/instrument-serif';
import '@fontsource/instrument-serif/400-italic.css';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import { ThemeProvider } from './theme.jsx';
import { ErrorBoundary } from './components.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
