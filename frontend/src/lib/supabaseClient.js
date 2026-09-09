/**
 * Supabase auth client, with a deliberate fallback.
 *
 * WHY THE FALLBACK EXISTS
 * A live SIH demo runs on someone else's projector, sometimes on a laptop that was cloned
 * five minutes earlier without a .env file. If a missing environment variable meant the
 * login page threw and the whole dashboard became unreachable, a configuration gap would
 * present as a total product failure. So when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 * are absent we expose `isConfigured === false` and AuthContext switches to a clearly
 * LABELLED local demo session. It is never silent: the login page says so on screen.
 *
 * KEY HANDLING
 * The anon (publishable) key is designed to ship in client bundles -- it identifies the
 * project, it does not authorise anything on its own. Row Level Security on the Supabase
 * tables is the actual access control. The `service_role` key must never appear in this
 * directory, in any VITE_-prefixed variable, or anywhere else in the frontend, because
 * every VITE_ variable is inlined into the public bundle at build time.
 */

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anonKey);

export const supabase = isConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

if (!isConfigured && import.meta.env.DEV) {
  console.warn(
    '[VARUN] Supabase not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ' +
      'missing). Falling back to labelled local demo auth -- see frontend/.env.example.'
  );
}
