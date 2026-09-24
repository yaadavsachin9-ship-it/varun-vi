/**
 * Single-node page (route: /village/:villageId).
 *
 * The dashboard answers "which of my 19 settlements is in trouble". This page answers the
 * next question an operator actually asks: "tell me everything about THIS one". It is a real
 * route rather than a modal, so it can be deep-linked, bookmarked and pasted into a district
 * WhatsApp group during an incident.
 *
 * It loads its own copy from GET /api/villages/{id} so a deep link works on a cold page load,
 * then prefers the shared WebSocket feed once that has the node, keeping the numbers here
 * identical to the dashboard's.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Mountain, Droplets, Waves, Clock, Gauge, TriangleAlert, Send, Loader2,
  CheckCircle2, XCircle, Smartphone, History, Users, Layers, Ruler, Activity, Info,
} from 'lucide-react';

import MapComponent from '../components/MapComponent';
import HydrographChart from '../components/HydrographChart';
import EvacuationRoutePanel from '../components/EvacuationRoutePanel';
import AlertFeedPanel from '../components/AlertFeedPanel';
import LeadTimeExplainerModal from '../components/LeadTimeExplainerModal';
import { useRiskData } from '../context/RiskDataContext';
import { useAuth } from '../context/AuthContext';
import { getVillage, dispatchAlert } from '../lib/api';

const LEVEL_STYLE = {
  red: { text: 'text-[#EF4444]', chip: 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/50', label: 'CRITICAL' },
  yellow: { text: 'text-[#FBBF24]', chip: 'bg-[#FBBF24]/15 text-[#FBBF24] border-[#FBBF24]/50', label: 'WARNING' },
  green: { text: 'text-[#10B981]', chip: 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/50', label: 'NORMAL' },
};

function StatTile({ icon: Icon, label, value, unit, note, accent = 'text-[#F8FAFC]' }) {
  return (
    <div className="rounded-md border border-[#164E63] bg-[#0B2638] p-2.5">
      <span className="telemetry flex items-center gap-1 text-[8px] uppercase tracking-wider text-[#94A3B8] mb-1">
        <Icon className="w-3 h-3 text-[#06B6D4]" /> {label}
      </span>
      <strong className={`text-lg font-bold leading-none ${accent}`}>
        {value}
        {unit && <small className="text-[10px] text-[#94A3B8] ml-1 font-medium">{unit}</small>}
      </strong>
      {note && <em className="block text-[9px] text-[#94A3B8]/80 not-italic mt-1">{note}</em>}
    </div>
  );
}

export default function VillageDetailPage() {
  const { villageId } = useParams();
  const navigate = useNavigate();
  const { villages, alerts, wsConnected, villageById, addAlert } = useRiskData();
  const { operatorEmail } = useAuth();

  const [fetched, setFetched] = useState(null);
  const [error, setError] = useState(null);
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [dispatch, setDispatch] = useState({ status: 'READY', detail: null });
  const [evacPlan, setEvacPlan] = useState(null);
  const [hoveredRoute, setHoveredRoute] = useState(null);

  // Prefer the live shared feed; fall back to the one-off fetch for cold deep links.
  const live = villageById(villageId);
  const village = live || fetched;

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    getVillage(villageId, ac.signal)
      .then((v) => {
        if (!cancelled) {
          setFetched(v);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled && err.name !== 'AbortError') setError(err.message);
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [villageId]);

  const villageAlerts = useMemo(
    () => alerts.filter((a) => String(a.village_id) === String(villageId)),
    [alerts, villageId]
  );

  // Same live countdown the dashboard uses, re-seeded on each new engine evaluation.
  const leadHrs = village?.current_lead_time_hrs ?? 0;
  const deadlineRef = useRef(null);
  const [, force] = useState(0);
  useEffect(() => {
    deadlineRef.current = leadHrs > 0 ? Date.now() + leadHrs * 3600_000 : null;
    force((n) => n + 1);
  }, [leadHrs, villageId]);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const tti = (() => {
    if (!deadlineRef.current) return '--:--:--';
    const total = Math.floor(Math.max(0, deadlineRef.current - Date.now()) / 1000);
    return [
      Math.floor(total / 3600),
      Math.floor((total % 3600) / 60),
      total % 60,
    ]
      .map((n) => String(n).padStart(2, '0'))
      .join(':');
  })();

  useEffect(() => {
    if (dispatch.status === 'READY' || dispatch.status === 'SENDING') return undefined;
    const id = window.setTimeout(() => setDispatch({ status: 'READY', detail: null }), 6000);
    return () => window.clearTimeout(id);
  }, [dispatch]);

  const handleDispatch = useCallback(async () => {
    if (!village) return;
    setDispatch({ status: 'SENDING', detail: null });
    try {
      const alert = await dispatchAlert({
        village_id: village.id,
        channel: 'sachet_cap',
        dispatched_by: operatorEmail || 'control-room-operator',
        include_evacuation_advisory: true,
      });
      addAlert(alert);
      setDispatch({ status: 'SENT', detail: alert.cap_identifier });
    } catch (err) {
      setDispatch({ status: 'FAILED', detail: err.message });
    }
  }, [village, operatorEmail, addAlert]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#061826] flex flex-col items-center justify-center gap-3 px-4">
        <TriangleAlert className="w-8 h-8 text-[#EF4444]" />
        <p className="text-sm text-[#EF4444]">{error}</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="telemetry text-[10px] uppercase tracking-wider text-[#06B6D4] hover:text-[#22D3EE]"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  if (!village) {
    return (
      <div className="min-h-screen bg-[#061826] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-[#06B6D4]" />
        <span className="telemetry text-[10px] uppercase tracking-[0.2em] text-[#94A3B8]">
          Loading node {villageId}
        </span>
      </div>
    );
  }

  const level = LEVEL_STYLE[village.current_risk_level] || LEVEL_STYLE.green;
  const nearbyRank = villages.findIndex((v) => v.id === village.id);

  return (
    <div className="app-shell min-h-screen text-[#F8FAFC] px-3 pb-16 pt-3 md:px-5 font-sans">
      {/* ---- Node header ---- */}
      <header className="glass-panel rounded-lg border border-[#164E63] bg-[#0B2638] p-3 md:p-4 mb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/dashboard"
              className="w-9 h-9 rounded bg-[#10384A] border border-[#164E63] text-[#F8FAFC] hover:text-[#22D3EE] hover:border-[#06B6D4] flex items-center justify-center shrink-0 transition"
              title="Back to command centre"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <span className="telemetry block text-[9px] uppercase tracking-[0.18em] text-[#94A3B8]">
                Node {String(village.id).padStart(2, '0')} ·{' '}
                {nearbyRank >= 0 ? `rank ${nearbyRank + 1} of ${villages.length} by risk` : 'single node view'}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg md:text-2xl font-black font-heading tracking-tight text-[#F8FAFC] truncate">
                  {village.name}
                </h1>
                <span
                  className={`telemetry text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border font-bold ${level.chip}`}
                >
                  {level.label}
                </span>
              </div>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                {village.district} District, {village.state}
                {village.river_basin ? ` · ${village.river_basin} basin` : ''} ·{' '}
                {village.latitude.toFixed(4)}, {village.longitude.toFixed(4)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`telemetry flex items-center gap-1 text-[9px] uppercase tracking-wider px-2 py-1 rounded border ${
                wsConnected
                  ? 'border-[#10B981]/40 text-[#10B981]'
                  : 'border-[#EF4444]/40 text-[#EF4444]'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-[#10B981] animate-pulse' : 'bg-[#EF4444]'}`}
              />
              {wsConnected ? 'Live' : 'Reconnecting'}
            </span>
            <Link
              to={`/citizen/${village.id}`}
              className="telemetry flex items-center gap-1 text-[9px] uppercase tracking-wider px-2 py-1 rounded border border-[#164E63] bg-[#10384A] text-[#06B6D4] hover:border-[#06B6D4] transition"
              title="Open the citizen-facing view for this village"
            >
              <Smartphone className="w-3 h-3" /> Citizen view
            </Link>
            <Link
              to="/backtest"
              className="telemetry flex items-center gap-1 text-[9px] uppercase tracking-wider px-2 py-1 rounded border border-[#164E63] bg-[#10384A] text-[#F8FAFC] hover:text-[#22D3EE] hover:border-[#06B6D4] transition"
            >
              <History className="w-3 h-3" /> Backtest
            </Link>
          </div>
        </div>
      </header>

      {/* ---- Headline risk state ---- */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="rounded-md border border-[#164E63] bg-[#0B2638] p-3">
          <span className="telemetry flex items-center gap-1 text-[8px] uppercase tracking-wider text-[#94A3B8] mb-1">
            <Gauge className="w-3 h-3 text-[#06B6D4]" /> Fused risk score
          </span>
          <strong className={`text-3xl font-black font-heading leading-none ${level.text}`}>
            {Math.round(village.current_risk_score ?? 0)}
            <small className="text-xs text-[#94A3B8] font-semibold ml-1">/100</small>
          </strong>
          <div className="h-1 rounded-full bg-[#071F30] mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                village.current_risk_level === 'red'
                  ? 'bg-[#EF4444]'
                  : village.current_risk_level === 'yellow'
                    ? 'bg-[#FBBF24]'
                    : 'bg-[#10B981]'
              }`}
              style={{ width: `${Math.min(100, village.current_risk_score ?? 0)}%` }}
            />
          </div>
        </div>

        <div className="rounded-md border border-[#164E63] bg-[#0B2638] p-3">
          <span className="telemetry flex items-center gap-1 text-[8px] uppercase tracking-wider text-[#94A3B8] mb-1">
            <Clock className="w-3 h-3 text-[#06B6D4]" /> Modelled lead time
          </span>
          <strong className="text-3xl font-black font-heading leading-none text-[#FBBF24]">
            {(village.current_lead_time_hrs ?? 0).toFixed(1)}
            <small className="text-xs text-[#94A3B8] font-semibold ml-1">h</small>
          </strong>
          <button
            onClick={() => setExplainerOpen(true)}
            className="telemetry flex items-center gap-1 text-[8px] uppercase tracking-wider text-[#06B6D4] hover:text-[#22D3EE] mt-2"
          >
            <Info className="w-3 h-3" /> How this is derived
          </button>
        </div>

        <div className="rounded-md border border-[#164E63] bg-[#0B2638] p-3">
          <span className="telemetry flex items-center gap-1 text-[8px] uppercase tracking-wider text-[#94A3B8] mb-1">
            <Activity className="w-3 h-3 text-[#06B6D4]" /> Countdown
          </span>
          <strong className="telemetry text-2xl font-bold leading-none text-[#F8FAFC]">{tti}</strong>
          <em className="block text-[9px] text-[#94A3B8] not-italic mt-2">
            Seeded from the lead time above
          </em>
        </div>

        <div className="rounded-md border border-[#164E63] bg-[#0B2638] p-3">
          <span className="telemetry flex items-center gap-1 text-[8px] uppercase tracking-wider text-[#94A3B8] mb-1">
            <TriangleAlert className="w-3 h-3 text-[#06B6D4]" /> Dominant trigger
          </span>
          <strong className="text-[13px] font-semibold leading-tight text-[#F8FAFC] block">
            {village.latest_primary_factor || 'Normal Hydrological Baseline'}
          </strong>
          <em className="block text-[9px] text-[#94A3B8] not-italic mt-1.5">
            {village.historical_incident_count} historical incident
            {village.historical_incident_count === 1 ? '' : 's'} on record
          </em>
        </div>
      </section>

      {/* ---- Live sensor channels ---- */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <StatTile
          icon={Droplets}
          label="Rainfall"
          value={(village.latest_rainfall_mm ?? 0).toFixed(1)}
          unit="mm/h"
          note={(village.latest_rainfall_mm ?? 0) >= 45 ? 'Cloudburst band' : 'Below cloudburst band'}
          accent="text-cyan-300"
        />
        <StatTile
          icon={Layers}
          label="Soil saturation"
          value={(village.latest_soil_moisture_pct ?? 0).toFixed(1)}
          unit="%"
          note={(village.latest_soil_moisture_pct ?? 0) > 85 ? 'Above 85% co-trigger' : 'Below 85% co-trigger'}
          accent="text-amber-300"
        />
        <StatTile
          icon={Activity}
          label="Geophone vibration"
          value={(village.latest_vibration_index ?? 0).toFixed(2)}
          unit="idx"
          note={(village.latest_vibration_index ?? 0) > 0.55 ? 'Debris-flow trip exceeded' : 'Quiet seismic channel'}
          accent="text-purple-300"
        />
        <StatTile
          icon={Waves}
          label="Stream stage"
          value={(village.latest_stream_level_m ?? 0).toFixed(2)}
          unit="m"
          note={(village.latest_stream_level_m ?? 0) >= 2.5 ? 'Above flood stage' : 'Below flood stage'}
          accent="text-blue-300"
        />
      </section>

      {/* ---- Main two-column body ---- */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.55fr_1fr] gap-3">
        <div className="flex flex-col gap-3 min-w-0">
          <div className="glass-panel rounded-lg border border-[#164E63] bg-[#0B2638] p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="telemetry text-[9px] uppercase tracking-wider text-[#94A3B8]">
                Terrain & catchment context
              </span>
              <span className="telemetry text-[8px] uppercase tracking-wider text-[#94A3B8]/70">
                static site parameters
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <StatTile icon={Mountain} label="Elevation" value={village.elevation_m} unit="m" />
              <StatTile
                icon={Ruler}
                label="Mean slope"
                value={village.avg_slope_deg}
                unit="°"
                note={village.avg_slope_deg > 30 ? 'Steep — gravitational term active' : 'Moderate gradient'}
              />
              <StatTile
                icon={Waves}
                label="Distance to stream"
                value={village.distance_to_stream_m}
                unit="m"
              />
              <StatTile
                icon={Layers}
                label="Drainage index"
                value={village.drainage_capacity_index}
                note={village.soil_type}
              />
              <StatTile
                icon={Users}
                label="Population"
                value={
                  village.population ? village.population.toLocaleString('en-IN') : 'not recorded'
                }
                note="order-of-magnitude estimate"
              />
              <StatTile
                icon={Waves}
                label="River basin"
                value={village.river_basin || '—'}
              />
              <StatTile
                icon={TriangleAlert}
                label="Past incidents"
                value={village.historical_incident_count}
                note="feeds the risk boost term"
              />
              <StatTile
                icon={Clock}
                label="Last reading"
                value={
                  village.latest_reading_time
                    ? new Date(village.latest_reading_time).toLocaleTimeString()
                    : '—'
                }
              />
            </div>
          </div>

          <div className="glass-panel rounded-lg border border-[#164E63] bg-[#0B2638] p-3">
            <HydrographChart
              villageId={village.id}
              limit={90}
              height={210}
              title={`Stored telemetry & fused risk — ${village.name}`}
            />
          </div>

          <div className="glass-panel rounded-lg border border-[#164E63] bg-[#0B2638] p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="telemetry text-[9px] uppercase tracking-wider text-[#94A3B8]">
                Evacuation geometry
              </span>
              <span className="telemetry text-[8px] uppercase tracking-wider text-[#94A3B8]/70">
                shelters + indicative routes
              </span>
            </div>
            <MapComponent
              villages={village ? [village] : []}
              selectedVillage={village}
              onSelectVillage={() => {}}
              shelters={evacPlan?.options || []}
              routes={
                hoveredRoute
                  ? [hoveredRoute]
                  : evacPlan?.options?.slice(0, 3) || []
              }
              heightClass="h-[400px]"
            />
          </div>
        </div>

        {/* ---- Right rail: evacuation plan, dispatch, node alert history ---- */}
        <div className="flex flex-col gap-3 min-w-0">
          <div className="glass-panel rounded-lg border border-[#164E63] bg-[#0B2638] p-3">
            <span className="telemetry block text-[9px] uppercase tracking-wider text-[#94A3B8] mb-2">
              Ranked evacuation options
            </span>
            <EvacuationRoutePanel
              villageId={village.id}
              onRouteHover={setHoveredRoute}
              onPlanLoaded={setEvacPlan}
            />
          </div>

          <div className="glass-panel rounded-lg border border-[#164E63] bg-[#0B2638] p-3">
            <span className="telemetry block text-[9px] uppercase tracking-wider text-[#94A3B8] mb-2">
              Dispatch CAP / SACHET warning
            </span>
            <p className="text-[11px] text-[#94A3B8] leading-relaxed mb-2.5">
              Persists an alert row for {village.name} with your operator identity and a CAP
              identifier, appends the evacuation advisory above, and broadcasts to every
              connected console. There is no cooldown on an operator dispatch.
            </p>
            <button
              onClick={handleDispatch}
              disabled={dispatch.status === 'SENDING'}
              className={`w-full flex items-center justify-center gap-2 rounded py-2.5 font-bold text-[13px] transition ${
                dispatch.status === 'FAILED'
                  ? 'bg-[#EF4444]/20 border border-[#EF4444]/50 text-[#EF4444]'
                  : dispatch.status === 'SENT'
                    ? 'bg-[#10B981]/20 border border-[#10B981]/50 text-[#10B981]'
                    : 'bg-[#06B6D4] hover:bg-[#22D3EE] text-[#061826] shadow-sm disabled:opacity-60'
              }`}
            >
              {dispatch.status === 'SENDING' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : dispatch.status === 'SENT' ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : dispatch.status === 'FAILED' ? (
                <XCircle className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {{
                READY: 'Dispatch bilingual CAP alert',
                SENDING: 'Dispatching…',
                SENT: 'Dispatched',
                FAILED: 'Dispatch failed',
              }[dispatch.status]}
            </button>
            {dispatch.detail && (
              <p
                className={`telemetry text-[8px] uppercase tracking-wider mt-2 break-all ${
                  dispatch.status === 'FAILED' ? 'text-[#EF4444]' : 'text-[#10B981]'
                }`}
              >
                {dispatch.status === 'SENT' ? `CAP id ${dispatch.detail}` : dispatch.detail}
              </p>
            )}
          </div>

          <div className="glass-panel rounded-lg border border-[#164E63] bg-[#0B2638] p-3">
            <span className="telemetry block text-[9px] uppercase tracking-wider text-[#94A3B8] mb-2">
              Alert history for this node ({villageAlerts.length})
            </span>
            {villageAlerts.length === 0 ? (
              <p className="telemetry text-[9px] uppercase tracking-wider text-[#94A3B8]/70">
                No alert has been fired for {village.name} in the current feed window.
              </p>
            ) : (
              <AlertFeedPanel alerts={villageAlerts} />
            )}
          </div>
        </div>
      </div>

      <LeadTimeExplainerModal isOpen={explainerOpen} onClose={() => setExplainerOpen(false)} />

      <footer className="mt-6 text-center">
        <p className="telemetry text-[8px] uppercase tracking-wider text-slate-600 leading-relaxed">
          Node telemetry from GET /api/villages/{village.id} and the /ws/risk feed · route
          costing from GET /api/villages/{village.id}/evacuation · SIH 2026 · Problem ID 26192
        </p>
      </footer>
    </div>
  );
}





