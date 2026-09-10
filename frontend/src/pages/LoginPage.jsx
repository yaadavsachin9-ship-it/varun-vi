/**
 * Operator sign-in for the EOC console.
 *
 * Two things this screen is careful about:
 *
 *  1. It never hides its own configuration state. When no Supabase project is wired up it
 *     says DEMO AUTH on screen, in the button, and again after sign-in -- so nobody can
 *     mistake a local placeholder session for real authentication.
 *
 *  2. It offers a public route out. A villager who lands here should not be stuck behind a
 *     login they will never have credentials for, so the citizen view is one tap away.
 */

import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  Lock,
  Mail,
  Loader2,
  TriangleAlert,
  ShieldCheck,
  Smartphone,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { signIn, signUp, isAuthenticated, isDemo, loading, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [notice, setNotice] = useState(null);

  const from = location.state?.from || '/dashboard';

  useEffect(() => {
    setLocalError(null);
    setNotice(null);
  }, [mode]);

  if (!loading && isAuthenticated) return <Navigate to={from} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setLocalError(null);
    setNotice(null);
    try {
      if (mode === 'signup') {
        const res = await signUp(email, password);
        if (res.error) setLocalError(res.error);
        else {
          setNotice('Account created. Check your inbox to confirm, then sign in.');
          setMode('signin');
        }
      } else {
        const res = await signIn(email, password);
        if (res.error) setLocalError(res.error);
        else navigate(from, { replace: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const shownError = localError || error;

  return (
    <div className="min-h-screen bg-[#04101d] text-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-16 h-16 rounded bg-white border border-[#273647] flex items-center justify-center shrink-0 overflow-hidden">
            <img src="/varun-vi-logo.png" alt="VARUN-VI logo" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <span className="telemetry block text-[9px] uppercase tracking-[0.2em] text-[#ab8986]">
              EOC Command Shell
            </span>
            <h1 className="text-xl font-black font-heading tracking-tight text-white">
              VARUN
            </h1>
          </div>
        </div>

        <div className="glass-panel rounded-lg border border-[#273647] p-5">
          <h2 className="text-base font-bold text-white mb-1">
            {mode === 'signup' ? 'Create operator account' : 'Operator sign-in'}
          </h2>
          <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
            Flash-flood early warning console for Himalayan catchments. Restricted to
            authorised NDRF / SDMA / DDMA control-room staff.
          </p>

          {isDemo && (
            <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2.5 mb-4">
              <div className="flex items-center gap-1.5 mb-1">
                <TriangleAlert className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="telemetry text-[9px] uppercase tracking-wider text-amber-200 font-bold">
                  Demo auth — Supabase not configured
                </span>
              </div>
              <p className="text-[10px] text-amber-100/80 leading-relaxed">
                No <code className="text-amber-200">VITE_SUPABASE_URL</code> /{' '}
                <code className="text-amber-200">VITE_SUPABASE_ANON_KEY</code> found, so any
                operator identity below opens a local session. This is not access control —
                see <code className="text-amber-200">frontend/.env.example</code>.
              </p>
            </div>
          )}

          <form id="operator-login-form" onSubmit={submit} className="flex flex-col gap-3">
            <label className="block">
              <span className="telemetry block text-[9px] uppercase tracking-wider text-slate-400 mb-1">
                {isDemo ? 'Operator identity' : 'Email'}
              </span>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type={isDemo ? 'text' : 'email'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                  placeholder={isDemo ? 'op-name@chamoli-eoc' : 'operator@ndrf.gov.in'}
                  className="w-full bg-[#071a2c] border border-[#273647] rounded pl-8 pr-3 py-2 text-[13px] text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60"
                />
              </div>
            </label>

            {!isDemo && (
              <label className="block">
                <span className="telemetry block text-[9px] uppercase tracking-wider text-slate-400 mb-1">
                  Password
                </span>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    required
                    minLength={8}
                    placeholder="••••••••"
                    className="w-full bg-[#071a2c] border border-[#273647] rounded pl-8 pr-3 py-2 text-[13px] text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60"
                  />
                </div>
              </label>
            )}

            {shownError && (
              <div className="rounded border border-rose-500/40 bg-rose-500/10 px-2.5 py-2">
                <span className="text-[11px] text-rose-200">{shownError}</span>
              </div>
            )}
            {notice && (
              <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-2">
                <span className="text-[11px] text-emerald-200">{notice}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 flex items-center justify-center gap-2 rounded bg-[#ffb3ad] hover:bg-[#ffc4bf] disabled:opacity-60 text-[#68000a] font-bold text-[13px] py-2.5 transition"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              {isDemo
                ? 'Enter console (demo auth)'
                : mode === 'signup'
                  ? 'Create account'
                  : 'Sign in'}
            </button>

          </form>

          {!isDemo && (
            <button
              onClick={() => setMode((m) => (m === 'signin' ? 'signup' : 'signin'))}
              className="telemetry w-full text-center text-[9px] uppercase tracking-wider text-slate-500 hover:text-slate-300 mt-3"
            >
              {mode === 'signin'
                ? 'No account? Request operator access'
                : 'Already have an account? Sign in'}
            </button>
          )}
        </div>

        {/* Public citizen route -- deliberately reachable without an account. */}
        <Link
          to="/citizen"
          className="login-public-card mt-4 flex items-center justify-between gap-2 rounded-lg p-3 group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Smartphone className="w-4 h-4 text-cyan-300 shrink-0" />
            <div className="min-w-0">
              <span className="block text-[12px] font-semibold text-white">
                I live in a village — मैं गाँव में रहता हूँ
              </span>
              <span className="telemetry text-[9px] uppercase tracking-wider text-slate-500">
                No account needed · कोई खाता आवश्यक नहीं
              </span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-300 shrink-0" />
        </Link>

        <p className="telemetry text-center text-[8px] uppercase tracking-wider text-slate-600 mt-5 leading-relaxed">
          SIH 2026 · Problem ID 26192 · Ministry of Home Affairs / NDRF & DM Division
        </p>
      </div>
    </div>
  );
}
