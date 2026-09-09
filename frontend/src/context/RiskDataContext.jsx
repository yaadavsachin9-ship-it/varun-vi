/**
 * One live telemetry feed for the whole app.
 *
 * Before routing was introduced, App.jsx owned the village list, the alert feed and the
 * WebSocket. With five routes that would mean five sockets and five divergent copies of the
 * risk state -- the dashboard could show a village red while the citizen page still showed
 * it green. So the feed is hoisted here, mounted once above the router, and every page
 * reads the same object.
 *
 * The socket carries four event types from backend/main.py:
 *   telemetry_update         -- a new sensor reading + engine evaluation for one village
 *   alert_dispatched         -- an operator pressed DISPATCH (POST /api/alerts/dispatch)
 *   storm_scenario_triggered -- demo storm injected; the whole list is refetched
 *   scenario_reset           -- demo scenario cleared; the whole list is refetched
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getVillages, getAlerts, WS_URL } from '../lib/api';

const RiskDataContext = createContext(null);

const MAX_ALERTS = 40;

/** Merge a telemetry_update payload into a village row. */
function applyTelemetry(village, msg) {
  const ev = msg.risk_evaluation || {};
  const reading = msg.reading || {};
  return {
    ...village,
    current_risk_score: ev.risk_score ?? village.current_risk_score,
    current_risk_level: ev.risk_level ?? village.current_risk_level,
    current_lead_time_hrs: ev.estimated_lead_time_hrs ?? village.current_lead_time_hrs,
    latest_rainfall_mm: reading.rainfall_mm ?? village.latest_rainfall_mm,
    latest_soil_moisture_pct: reading.soil_moisture_pct ?? village.latest_soil_moisture_pct,
    latest_vibration_index: reading.vibration_index ?? village.latest_vibration_index,
    latest_stream_level_m: reading.water_level_stream_m ?? village.latest_stream_level_m,
    latest_primary_factor: ev.primary_factor ?? village.latest_primary_factor,
    latest_reading_time: msg.timestamp ?? village.latest_reading_time,
  };
}

export function RiskDataProvider({ children }) {
  const [villages, setVillages] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  const wsRef = useRef(null);
  const retryRef = useRef(0);
  const closedByUsRef = useRef(false);

  const reload = useCallback(async () => {
    try {
      const [v, a] = await Promise.all([getVillages(), getAlerts(MAX_ALERTS)]);
      setVillages([...v].sort((x, y) => (y.current_risk_score || 0) - (x.current_risk_score || 0)));
      setAlerts(a);
      setLastUpdated(new Date());
      setLoadError(null);
    } catch (err) {
      // Keep whatever we last had on screen -- a stale risk number with a visible
      // "connection lost" badge is more useful to an operator than an empty console.
      setLoadError(err.message || 'Backend unreachable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // ---- WebSocket with capped exponential backoff ---------------------------------------
  useEffect(() => {
    closedByUsRef.current = false;
    let timer = null;

    const connect = () => {
      let ws;
      try {
        ws = new WebSocket(WS_URL);
      } catch {
        timer = window.setTimeout(connect, 3000);
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.event === 'telemetry_update') {
          setLastUpdated(new Date());
          setVillages((prev) => {
            const next = prev.map((v) => (v.id === msg.village_id ? applyTelemetry(v, msg) : v));
            return [...next].sort(
              (a, b) => (b.current_risk_score || 0) - (a.current_risk_score || 0)
            );
          });
          if (msg.alert) {
            setAlerts((prev) => [
              msg.alert,
              ...prev.filter((a) => a.id !== msg.alert.id).slice(0, MAX_ALERTS - 1),
            ]);
          }
        } else if (msg.event === 'alert_dispatched') {
          // The operator dispatch endpoint broadcasts before the poller would notice, so
          // the alert feed updates the instant the button is pressed on any console.
          setAlerts((prev) => [
            {
              id: msg.id ?? `ws-${Date.now()}`,
              village_id: msg.village_id,
              village_name: msg.village_name,
              fired_at: msg.timestamp,
              risk_level: msg.risk_level,
              risk_score: msg.risk_score,
              channel: msg.channel,
              message_en: msg.message_en,
              message_hi: msg.message_hi,
              estimated_lead_time_hrs: msg.estimated_lead_time_hrs ?? 0,
              delivered: true,
              dispatched_by: msg.dispatched_by,
              cap_identifier: msg.cap_identifier,
            },
            ...prev.slice(0, MAX_ALERTS - 1),
          ]);
        } else if (
          msg.event === 'storm_scenario_triggered' ||
          msg.event === 'scenario_reset'
        ) {
          reload();
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (closedByUsRef.current) return;
        retryRef.current = Math.min(retryRef.current + 1, 5);
        timer = window.setTimeout(connect, 1000 * 2 ** (retryRef.current - 1));
      };

      ws.onerror = () => setWsConnected(false);
    };

    connect();

    return () => {
      closedByUsRef.current = true;
      if (timer) window.clearTimeout(timer);
      if (wsRef.current) wsRef.current.close();
    };
  }, [reload]);

  const criticalCount = villages.filter((v) => v.current_risk_level === 'red').length;
  const warningCount = villages.filter((v) => v.current_risk_level === 'yellow').length;

  const value = useMemo(
    () => ({
      villages,
      alerts,
      wsConnected,
      lastUpdated,
      loading,
      loadError,
      criticalCount,
      warningCount,
      reload,
      /** Look up one village from the shared list -- used by the detail and citizen pages. */
      villageById: (id) => villages.find((v) => String(v.id) === String(id)) || null,
      /** Optimistically prepend a locally dispatched alert (the WS echo dedupes by id). */
      addAlert: (alert) =>
        setAlerts((prev) => [alert, ...prev.filter((a) => a.id !== alert.id).slice(0, MAX_ALERTS - 1)]),
    }),
    [villages, alerts, wsConnected, lastUpdated, loading, loadError, criticalCount, warningCount, reload]
  );

  return <RiskDataContext.Provider value={value}>{children}</RiskDataContext.Provider>;
}

export function useRiskData() {
  const ctx = useContext(RiskDataContext);
  if (!ctx) throw new Error('useRiskData must be used inside <RiskDataProvider>');
  return ctx;
}
