/**
 * Application entry point.
 *
 * Provider order matters and is deliberate:
 *
 *   AuthProvider      -> owns the operator session (Supabase or a labelled demo session)
 *     RiskDataProvider -> owns villages, alerts and the SINGLE /ws/risk WebSocket
 *       BrowserRouter  -> routes
 *
 * RiskDataProvider sits above the router so that all five routes share one socket and one
 * copy of the risk state. If each page opened its own connection, the dashboard and the
 * citizen screen could disagree about whether a village is red -- which is the one thing an
 * early-warning system must never do.
 *
 * It also sits INSIDE AuthProvider but OUTSIDE ProtectedRoute, because the citizen route is
 * public and still needs live risk data.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext';
import { RiskDataProvider } from './context/RiskDataContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <RiskDataProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </RiskDataProvider>
    </AuthProvider>
  </StrictMode>,
);

/**
 * Service worker for the citizen view.
 *
 * Registered only in production builds: during development Vite serves modules that must not
 * be cached, and a stale worker is a genuinely confusing failure mode. The worker caches the
 * app shell so a villager who opens the installed app on a dead network gets the last known
 * state with an explicit offline banner instead of a browser error page. It never caches API
 * responses -- stale risk numbers presented as current would be worse than no numbers.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration failure is not fatal: the app works online without the worker.
    });
  });
}
