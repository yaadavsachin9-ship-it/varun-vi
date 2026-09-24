/**
 * Route table for the whole application.
 *
 * The split here is the security boundary, so it is worth stating plainly:
 *
 *   PUBLIC   /login              operator sign-in
 *            /citizen            village picker for residents
 *            /citizen/:id        one village's status, actions and shelter
 *
 *   GUARDED  /dashboard          EOC console
 *            /village/:id        single-node deep dive
 *            /backtest           historical replay
 *
 * The citizen routes are public on purpose. A resident will never hold NDRF/SDMA credentials,
 * and a flash-flood warning that sits behind a login is not a warning. The guard on the
 * operator routes is <ProtectedRoute>, which in demo mode (no Supabase project configured)
 * accepts any identity and says so on screen -- see components/ProtectedRoute.jsx and
 * pages/LoginPage.jsx. Real access control is Supabase auth plus row-level security, not
 * this file.
 *
 * App.css is imported here rather than in main.jsx because it carries the Stitch tactical
 * layout for the operator pages; the citizen pages are pure Tailwind and use none of it.
 *
 * The three operator pages are lazy-loaded, and that is a bandwidth decision rather than a
 * stylistic one. They pull in Leaflet and Recharts; the citizen screen uses neither. Bundled
 * together, a villager on a 2G tail-end link downloads ~930 kB to read one risk score. Split,
 * the citizen entry payload is a fraction of that and the map/chart code only ships to the
 * control room, which is on mains power and a fixed line. Login and the citizen screen stay
 * eager: they are the two cold-start entry points and must not wait on a second round trip.
 */

import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import './App.css';

import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import CitizenPage from './pages/CitizenPage';
import DisasterChatbot from './components/DisasterChatbot';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const VillageDetailPage = lazy(() => import('./pages/VillageDetailPage'));
const BacktestPage = lazy(() => import('./pages/BacktestPage'));

/** Shown only for the moment an operator chunk is in flight, on the app's own background. */
function ChunkFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#061826]">
      <p className="telemetry text-[10px] uppercase tracking-[0.18em] text-[#06B6D4]">
        Loading console…
      </p>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Routes>
        {/* ---- Public ---- */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/citizen" element={<CitizenPage />} />
        <Route path="/citizen/:villageId" element={<CitizenPage />} />

        {/* ---- Operator console ---- */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Suspense fallback={<ChunkFallback />}>
                <DashboardPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/village/:villageId"
          element={
            <ProtectedRoute>
              <Suspense fallback={<ChunkFallback />}>
                <VillageDetailPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/backtest"
          element={
            <ProtectedRoute>
              <Suspense fallback={<ChunkFallback />}>
                <BacktestPage />
              </Suspense>
            </ProtectedRoute>
          }
        />

        {/* Anything else lands on the console, which itself bounces to /login when unauthenticated. */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      {/* Global Bilingual Voice-Enabled Emergency Chatbot */}
      <DisasterChatbot />
    </>
  );
}
