/**
 * Single source of truth for talking to the FastAPI backend.
 *
 * Every page and component goes through here rather than hand-rolling its own
 * `fetch("http://localhost:8000/...")`. Three reasons that matters for this project:
 *
 *  1. The base URL is read from VITE_API_BASE, so the same build can point at a laptop
 *     backend during the demo or at a deployed one without editing component files.
 *  2. Errors surface as real thrown Errors carrying the backend's `detail` string, so a
 *     404 on a village id reads as "Village not found" in the UI instead of a blank panel.
 *  3. `AbortSignal` is threaded through, so a page that unmounts mid-poll does not race a
 *     late response into a dead component.
 */

const RAW_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
export const API_ORIGIN = RAW_BASE.replace(/\/+$/, '');
export const API_BASE = `${API_ORIGIN}/api`;

// ws:// for http://, wss:// for https:// -- otherwise a deployed HTTPS dashboard would be
// blocked by the browser for opening an insecure socket.
export const WS_URL = `${API_ORIGIN.replace(/^http/, 'ws')}/ws/risk`;

async function request(path, options = {}) {
  const { signal, ...rest } = options;
  const resp = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    signal,
    ...rest,
  });

  if (!resp.ok) {
    let detail = `${resp.status} ${resp.statusText}`;
    try {
      const body = await resp.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // Non-JSON error body (e.g. a proxy 502 HTML page) -- keep the status line.
    }
    const err = new Error(detail);
    err.status = resp.status;
    throw err;
  }

  return resp.json();
}

// ---- Villages -------------------------------------------------------------------------

export const getVillages = (signal) => request('/villages', { signal });

export const getVillage = (villageId, signal) => request(`/villages/${villageId}`, { signal });

export const getVillageHistory = (villageId, limit = 60, signal) =>
  request(`/villages/${villageId}/history?limit=${limit}`, { signal });

// ---- Evacuation & shelters ------------------------------------------------------------

export const getShelters = (villageId, signal) =>
  request(villageId ? `/shelters?village_id=${villageId}` : '/shelters', { signal });

export const getEvacuationPlan = (villageId, { radiusKm = 12, isNight = false } = {}, signal) =>
  request(
    `/villages/${villageId}/evacuation?radius_km=${radiusKm}&is_night=${isNight}`,
    { signal }
  );

// ---- Alerts ---------------------------------------------------------------------------

export const getAlerts = (limit = 25, signal) => request(`/alerts?limit=${limit}`, { signal });

/**
 * Operator CAP dispatch. This is a real write: it persists an alert row with the operator
 * identity and broadcasts on the WebSocket, so it is only ever called from an explicit
 * button press, never from a polling effect.
 */
export const dispatchAlert = (payload, signal) =>
  request('/alerts/dispatch', { method: 'POST', body: JSON.stringify(payload), signal });

// ---- Historical backtest --------------------------------------------------------------

export const getBacktestEvents = async (signal) => {
  const payload = await request('/backtest/events', { signal });
  // The API returns both the catalogue and precomputed headline results. The picker
  // needs the catalogue shape; keep the summary available for callers that need it.
  if (Array.isArray(payload)) return payload;
  return payload?.catalogue || [];
};

export const getBacktest = (eventId, signal) => request(`/backtest/${eventId}`, { signal });

// ---- Demo scenario control -----------------------------------------------------------

export const triggerStorm = (payload, signal) =>
  request('/demo/storm', { method: 'POST', body: JSON.stringify(payload), signal });

export const resetScenario = (signal) => request('/demo/reset', { method: 'POST', signal });
