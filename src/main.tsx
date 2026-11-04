import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import './styles/index.css';
import { restoreDeepLink } from './utils/appUrl';

// Deep link ที่มาจาก 404.html ของ GitHub Pages (เช่น /sme-trust/v2/m/trust) — คืนเส้นทางก่อน Render
restoreDeepLink();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
