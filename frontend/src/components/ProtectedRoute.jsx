/**
 * Route guard for the operator console.
 *
 * Redirects to /login when there is no session, preserving the attempted URL in router
 * state so that signing in lands the operator on the page they actually wanted (a deep link
 * to /village/7 during an incident should not dump them on the generic dashboard).
 *
 * The citizen routes are deliberately NOT wrapped in this.
 */

import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // Render nothing decisive until the stored session has been checked, otherwise a page
  // refresh would flash the login screen for a moment even for a signed-in operator.
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#04101d] text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-300" />
        <span className="telemetry text-[10px] uppercase tracking-[0.2em]">
          Restoring operator session
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return children;
}
