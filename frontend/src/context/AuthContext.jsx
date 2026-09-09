/**
 * Auth state for the operator console.
 *
 * Two modes, chosen once at load from whether Supabase env vars are present:
 *
 *   SUPABASE MODE  -- real email/password sign-in against Supabase Auth. The session is
 *                     persisted and refreshed by the SDK, and `onAuthStateChange` keeps
 *                     this context in step with token refreshes and sign-out in other tabs.
 *
 *   DEMO MODE      -- no Supabase project configured. A local session object is stored in
 *                     sessionStorage so the dashboard is reachable, and `isDemo` is exposed
 *                     so every screen can say so out loud. This is NOT a security control
 *                     and is not pretending to be one; it exists so a missing .env cannot
 *                     brick a live presentation.
 *
 * The citizen route (/citizen) is intentionally PUBLIC in both modes. Asking a villager to
 * create an account before they can find out whether to evacuate would defeat the purpose
 * of the system.
 */

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { supabase, isConfigured } from '../lib/supabaseClient';

const DEMO_SESSION_KEY = 'drainguard.demo.session';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ---- Restore an existing session on mount -------------------------------------------
  useEffect(() => {
    let cancelled = false;

    if (!isConfigured) {
      try {
        const raw = sessionStorage.getItem(DEMO_SESSION_KEY);
        if (raw && !cancelled) setSession(JSON.parse(raw));
      } catch {
        // Private-mode browsers can refuse sessionStorage; treat as "not signed in".
      }
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setSession(data.session ?? null);
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!cancelled) setSession(next ?? null);
    });

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // ---- Actions -------------------------------------------------------------------------

  const signIn = useCallback(async (email, password) => {
    setError(null);
    if (!isConfigured) {
      // Demo mode: accept any non-empty identity, store it, and label it everywhere.
      if (!email?.trim()) {
        const msg = 'Enter an operator identity to continue in demo mode.';
        setError(msg);
        return { error: msg };
      }
      const demo = {
        demo: true,
        user: { email: email.trim(), id: 'demo-operator' },
        created_at: new Date().toISOString(),
      };
      try {
        sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(demo));
      } catch {
        // Non-fatal -- the in-memory session below still works for this tab.
      }
      setSession(demo);
      return { error: null };
    }

    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      return { error: err.message };
    }
    setSession(data.session);
    return { error: null };
  }, []);

  const signUp = useCallback(async (email, password) => {
    setError(null);
    if (!isConfigured) {
      const msg = 'Sign-up needs a configured Supabase project. Use demo sign-in instead.';
      setError(msg);
      return { error: msg };
    }
    const { error: err } = await supabase.auth.signUp({ email, password });
    if (err) {
      setError(err.message);
      return { error: err.message };
    }
    // With email confirmation enabled there is no session yet, which is why the caller
    // shows a "check your inbox" state rather than assuming it is signed in.
    return { error: null, confirmationRequired: true };
  }, []);

  const signOut = useCallback(async () => {
    if (!isConfigured) {
      try {
        sessionStorage.removeItem(DEMO_SESSION_KEY);
      } catch {
        /* ignore */
      }
      setSession(null);
      return;
    }
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      operatorEmail: session?.user?.email ?? null,
      isAuthenticated: Boolean(session),
      isDemo: !isConfigured,
      loading,
      error,
      signIn,
      signUp,
      signOut,
    }),
    [session, loading, error, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
