import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LiveViewerApp } from '@/components/LiveViewer/LiveViewer';
import './styles/globals.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error(
    '[main.tsx] Root element #root not found. Check your index.html.'
  );
}

const isLiveMode = new URLSearchParams(window.location.search).get('mode') === 'live';

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    {isLiveMode ? <LiveViewerApp /> : <App />}
  </React.StrictMode>
);
