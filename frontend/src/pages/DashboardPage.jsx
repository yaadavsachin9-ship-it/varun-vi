/**
 * Control-room dashboard (route: /dashboard).
 *
 * This was App.jsx before routing was introduced. Four things that used to be theatre are
 * now wired to the backend:
 *
 *   HYDROGRAPH  -- was two copies of a fixed bezier <path>; now <HydrographChart> reading
 *                  GET /api/villages/{id}/history.
 *   DISPATCH    -- was setTimeout(() => setState('SENT TO SACHET'), 1200); now a real
 *                  POST /api/alerts/dispatch that persists an Alert row with the operator
 *                  identity, mints a CAP identifier and broadcasts on the WebSocket.
 *   POPULATION  -- was the hardcoded string "Population: 4,200 · River: Dhauliganga" on
 *                  every village; now village.population / village.river_basin from the DB.
 *   TTI CLOCK   -- was the frozen literal '01:48:12'; now a live countdown seeded from the
 *                  engine's estimated_lead_time_hrs for the selected node.
 *
 * The "Water surge rate ... m/hr" tile was also mislabelled: the sensor reports stream STAGE
 * in metres, not a rate of change, so it now reads as a stage with its own trend note.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Radio, AlertTriangle, Mountain, Bell, RefreshCw, Activity, ShieldAlert,
  ChevronDown, Zap, Send, Siren, BookOpen, Gauge, LogOut, History,
  Smartphone, ExternalLink, Loader2, CheckCircle2, XCircle, Route as RouteIcon,
} from 'lucide-react';

import MapComponent from '../components/MapComponent';
import VillageDetailPanel from '../components/VillageDetailPanel';
import AuthorityTableView from '../components/AuthorityTableView';
import AlertFeedPanel from '../components/AlertFeedPanel';
import StormControlPanel from '../components/StormControlPanel';
import LeadTimeExplainerModal from '../components/LeadTimeExplainerModal';
import HydrographChart from '../components/HydrographChart';
import EvacuationRoutePanel from '../components/EvacuationRoutePanel';
import VillageIdentityBadge from '../components/VillageIdentityBadge';
import { useRiskData } from '../context/RiskDataContext';
import { useAuth } from '../context/AuthContext';
import { dispatchAlert, triggerStorm } from '../lib/api';

/**
 * Live time-to-inundation clock.
 *
 * The engine publishes a lead time in hours; an operator needs a clock that visibly runs
 * down. The deadline is re-seeded whenever the node or its modelled lead time changes, so a
 * fresh engine evaluation resets the countdown rather than letting a stale one keep ticking.
 */
function useCountdown(leadTimeHrs, resetKey) {
  const deadlineRef = useRef(null);
  const [, force] = useState(0);

  useEffect(() => {
    deadlineRef.current =
      typeof leadTimeHrs === 'number' && leadTimeHrs > 0
        ? Date.now() + leadTimeHrs * 3600_000
        : null;
    force((n) => n + 1);
  }, [leadTimeHrs, resetKey]);

  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!deadlineRef.current) return '--:--:--';
  const remainingMs = Math.max(0, deadlineRef.current - Date.now());
  const total = Math.floor(remainingMs / 1000);
  const hh = String(Math.floor(total / 3600)).padStart(2, '0');
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export default function DashboardPage() {
  const { villages, alerts, wsConnected, lastUpdated, criticalCount, loadError, reload, addAlert } =
    useRiskData();
  const { operatorEmail, isDemo, signOut } = useAuth();
  const navigate = useNavigate();

  const [selectedId, setSelectedId] = useState(null);
  const [activeView, setActiveView] = useState('map');
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [dispatch, setDispatch] = useState({ status: 'READY', detail: null });
  const [hoveredRoute, setHoveredRoute] = useState(null);
  const [evacPlan, setEvacPlan] = useState(null);

  // The selected node follows the shared risk feed, so a WebSocket tick updates the panels
  // without a second copy of the state drifting out of step.
  const selectedVillage = useMemo(
    () => villages.find((v) => v.id === selectedId) || villages[0] || null,
    [villages, selectedId]
  );

  const selectedRisk = selectedVillage?.current_risk_score ?? 0;
  const selectedZone = selectedVillage?.current_risk_level || (selectedRisk >= 70 ? 'red' : selectedRisk >= 40 ? 'yellow' : 'green');
  const selectedLeadTime = selectedVillage?.current_lead_time_hrs ?? 0;
  const latestAlert = alerts[0];
  const tti = useCountdown(selectedLeadTime, selectedVillage?.id);

  const openVillage = useCallback((v) => navigate(`/village/${v.id}`), [navigate]);

  // Clear the transient dispatch result so the button returns to READY.
  useEffect(() => {
    if (dispatch.status === 'READY' || dispatch.status === 'SENDING') return undefined;
    const id = window.setTimeout(() => setDispatch({ status: 'READY', detail: null }), 6000);
    return () => window.clearTimeout(id);
  }, [dispatch]);

  /**
   * Real CAP dispatch. The operator identity comes from the signed-in session so the alert
   * row carries a genuine audit trail rather than a generic "dashboard" label.
   */
  const handleDispatch = async () => {
    if (!selectedVillage) return;
    setDispatch({ status: 'SENDING', detail: null });
    try {
      const alert = await dispatchAlert({
        village_id: selectedVillage.id,
        channel: 'sachet_cap',
        dispatched_by: operatorEmail || 'control-room-operator',
        include_evacuation_advisory: true,
      });
      addAlert(alert);
      setDispatch({ status: 'SENT', detail: alert.cap_identifier });
    } catch (err) {
      setDispatch({ status: 'FAILED', detail: err.message });
    }
  };

  const handleEmergencyOverride = async () => {
    try {
      await triggerStorm({
        intensity: 'extreme',
        target_rainfall_rate_mm_hr: 95,
        target_soil_moisture_pct: 92,
      });
      await reload();
    } catch (err) {
      setDispatch({ status: 'FAILED', detail: err.message });
    }
  };

  const dispatchLabel = {
    READY: 'Dispatch CAP alert',
    SENDING: 'Dispatching…',
    SENT: 'Sent to SACHET',
    FAILED: 'Dispatch failed',
  }[dispatch.status];

  return (
    <div className={`app-shell risk-zone-${selectedZone} min-h-screen text-gray-100 px-3 pb-24 pt-0 md:px-5 md:pb-24 font-sans`}>
      <header className="sticky top-0 inset-x-0 z-[1100] bg-[#051424]/95 backdrop-blur-xl border-b border-[#273647] mb-3 md:mb-4 md:border md:rounded-lg">
        <div className="bg-[#010f1f] px-3 py-1.5 flex items-center justify-between gap-2 overflow-hidden">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}
            />
            <span className="telemetry text-[9px] text-emerald-300 uppercase tracking-wider truncate">
              {wsConnected ? 'Live • WebSocket Connected' : 'Connecting Sensor Stream'}
            </span>
            {loadError && (
              <span className="telemetry text-[9px] text-rose-300 uppercase tracking-wider truncate">
                • {loadError}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isDemo && (
              <span className="telemetry text-[9px] text-amber-300 uppercase tracking-wider">
                Demo auth
              </span>
            )}
            <span className="telemetry zone-status-label text-[9px] uppercase tracking-wider hidden sm:inline">
              NDRF-OPS / {selectedZone.toUpperCase()} ZONE
            </span>
          </div>
        </div>

        {criticalCount > 0 && (
          <div className="bg-[#93000a]/45 px-3 py-1.5 flex items-center gap-2 overflow-hidden">
            <AlertTriangle className="w-3.5 h-3.5 text-[#ffb3ad] shrink-0" />
            <span className="telemetry text-[9px] text-[#ffb3ad] uppercase tracking-wider truncate">
              Critical: mandatory evacuation • {criticalCount} sector
              {criticalCount > 1 ? 's' : ''} red alert
            </span>
          </div>
        )}

        <div className="px-3 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded bg-white border border-[#273647] flex items-center justify-center shrink-0 overflow-hidden">
              <img src="/varun-vi-logo.png" alt="VARUN-VI logo" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <span className="telemetry block text-[9px] text-[#ab8986] uppercase tracking-wider truncate">
                {operatorEmail ? `OPERATOR · ${operatorEmail}` : 'EOC COMMAND SHELL'}
              </span>
              <h1 className="text-base md:text-xl font-bold uppercase tracking-tight text-white truncate">
                Command Center <span className="text-cyan-300">|</span> Flash Flood Tactical
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              to="/backtest"
              className="w-10 h-10 rounded bg-[#122131] text-cyan-300 flex items-center justify-center hover:bg-[#1a2c40]"
              title="Historical event backtest"
            >
              <History className="w-4 h-4" />
            </Link>
            <Link
              to="/citizen"
              className="w-10 h-10 rounded bg-[#122131] text-emerald-300 flex items-center justify-center hover:bg-[#1a2c40]"
              title="Citizen view (public)"
            >
              <Smartphone className="w-4 h-4" />
            </Link>
            <button
              onClick={() => setExplainerOpen(true)}
              className="w-10 h-10 rounded bg-[#122131] text-[#ffb3ad] flex items-center justify-center hover:bg-[#1a2c40]"
              title="Open lead-time formula"
            >
              <Bell className="w-4 h-4" />
            </button>
            <button
              onClick={reload}
              className="w-10 h-10 rounded bg-[#ffb3ad] text-[#68000a] flex items-center justify-center hover:bg-[#ffc4bf]"
              title="Reload telemetry"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={signOut}
              className="w-10 h-10 rounded bg-[#122131] text-slate-400 flex items-center justify-center hover:text-rose-300"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <section className="tactical-context flex flex-col gap-2 mb-3">
        <div className="bg-[#1c2b3c] rounded-md p-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <VillageIdentityBadge village={selectedVillage} />
            <div className="min-w-0">
              <span className="telemetry block text-[9px] text-[#ab8986] uppercase tracking-wider">
                Monitoring Sector
              </span>
              <div className="flex items-center gap-1 text-sm font-semibold truncate">
                {selectedVillage?.river_basin || 'Upper Alaknanda Basin'}
                <ChevronDown className="w-4 h-4 text-[#e4beba] shrink-0" />
              </div>
            </div>
          </div>
          <div className="telemetry flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#273647] text-[9px] text-[#ffb95f] uppercase tracking-wider shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#ffb95f] animate-pulse" /> {villages.length} nodes
          </div>
        </div>
        <div className="bg-[#0d1c2d] rounded-md p-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded bg-[#ff5451] flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-[#5c0008]" />
            </div>
            <div className="min-w-0">
              <strong className="block text-sm text-[#ffb3ad] uppercase truncate">
                {criticalCount} Sector Red Alert
              </strong>
              <span className="telemetry text-[9px] text-[#e4beba] truncate">
                Live precipitation and surge watch
              </span>
            </div>
          </div>
          <span className="telemetry px-2 py-1 rounded bg-[#93000a] text-[9px] text-[#ffdad6] uppercase font-bold shrink-0">
            {criticalCount > 0 ? 'Level 4 Active' : 'Level 1 Watch'}
          </span>
        </div>
      </section>

      <div className="tactical-console">
        <aside className="tactical-sidebar">
          <div className="tactical-sidebar-title">
            <span>Operational Sector</span>
            <span className="tactical-chip cyan">Radar Active</span>
          </div>
          <div className="telemetry tactical-region">● Northern Himalayan Region</div>
          <nav className="tactical-nav" aria-label="Operations navigation">
            <button className={activeView === 'map' ? 'active' : ''} onClick={() => setActiveView('map')}>
              <Mountain /> Map View <span>●</span>
            </button>
            <button className={activeView === 'risk' ? 'active' : ''} onClick={() => setActiveView('risk')}>
              <Activity /> Risk Matrix
            </button>
            <button className={activeView === 'sensors' ? 'active' : ''} onClick={() => setActiveView('sensors')}>
              <Radio /> Sensors
            </button>
            <button
              className={activeView === 'evacuation' ? 'active' : ''}
              onClick={() => setActiveView('evacuation')}
            >
              <ShieldAlert /> Evacuation
            </button>
            <button
              className={activeView === 'broadcast' ? 'active' : ''}
              onClick={() => setActiveView('broadcast')}
            >
              <Bell /> SMS/SACHET
            </button>
          </nav>

          <div className="tactical-sidebar-title mt-4">
            Priority Grid <span className="telemetry text-cyan-300">{criticalCount} ACTIVE</span>
          </div>
          <div className="priority-grid">
            {villages.slice(0, 6).map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedId(v.id)}
                onDoubleClick={() => openVillage(v)}
                className={`priority-item ${v.current_risk_level}`}
                title="Click to select · double-click to open the full node page"
              >
                <span>
                  <b>● {v.name.split(' ')[0]}</b>
                  <small>
                    SEC: {String(v.id).padStart(2, '0')}A · {v.district || 'HIMALAYA'}
                  </small>
                </span>
                <strong>
                  {Math.round(v.current_risk_score || 0)}
                  <small>
                    {v.current_risk_level === 'red'
                      ? 'CRIT'
                      : v.current_risk_level === 'yellow'
                        ? 'WARN'
                        : 'NORM'}
                  </small>
                </strong>
              </button>
            ))}
          </div>
          <button className="emergency-override" onClick={handleEmergencyOverride}>
            <ShieldAlert /> Emergency Override
          </button>
        </aside>

        <main className="tactical-main">
          <div className="tactical-section-heading">
            <span>
              <VillageIdentityBadge village={selectedVillage} compact />
              Tactical Risk Map: {selectedVillage?.name || 'Upper Alaknanda Basin'}
            </span>
            {selectedVillage && (
              <button
                onClick={() => openVillage(selectedVillage)}
                className="tactical-chip cyan"
                style={{ cursor: 'pointer' }}
                title="Open this node as its own page"
              >
                Open node page ↗
              </button>
            )}
            <span className="risk-key">
              <i className="red" /> Crit <i className="yellow" /> Warn <i className="cyan" /> Hydro Run
            </span>
          </div>

          {activeView === 'map' && (
            <MapComponent
              villages={villages}
              selectedVillage={selectedVillage}
              onSelectVillage={(v) => setSelectedId(v?.id ?? null)}
              onOpenVillage={openVillage}
              shelters={evacPlan?.options}
              routes={
                hoveredRoute
                  ? [hoveredRoute]
                  : evacPlan?.recommended
                    ? [evacPlan.recommended]
                    : []
              }
            />
          )}
          {activeView === 'risk' && (
            <AuthorityTableView
              villages={villages}
              selectedVillage={selectedVillage}
              onSelectVillage={(v) => setSelectedId(v?.id ?? null)}
            />
          )}
          {activeView === 'sensors' && (
            <VillageDetailPanel
              village={selectedVillage}
              onOpenExplainer={() => setExplainerOpen(true)}
            />
          )}
          {activeView === 'evacuation' && (
            <div className="flex flex-col gap-3">
              <div className="tactical-evacuation-card">
                <Siren />
                <div>
                  <strong>Evacuation protocol</strong>
                  <p>
                    Routes below are costed live for {selectedVillage?.name || 'the selected node'}{' '}
                    against its current modelled lead time.
                  </p>
                </div>
                <button onClick={handleDispatch} disabled={dispatch.status === 'SENDING'}>
                  <Send /> {dispatchLabel}
                </button>
              </div>
              {selectedVillage && (
                <EvacuationRoutePanel
                  villageId={selectedVillage.id}
                  onRouteHover={setHoveredRoute}
                  onPlanLoaded={setEvacPlan}
                />
              )}
            </div>
          )}
          {activeView === 'broadcast' && <AlertFeedPanel alerts={alerts} />}

          <div className="tactical-impact-card">
            <div className="impact-labels">
              <span className="tactical-chip red">
                Flash Flood / {selectedVillage?.district || 'Sector 01'}
              </span>
              <span className="tactical-chip amber">
                Landslide Dam Collapse: {selectedRisk > 70 ? 'Probable' : 'Monitor'}
              </span>
            </div>
            <div className="impact-title">
              <div>
                <h2>{selectedVillage?.name || 'Select a node'}</h2>
                <p>
                  Priority: {selectedRisk > 70 ? 'Alpha' : selectedRisk > 40 ? 'Bravo' : 'Charlie'} ·
                  Population:{' '}
                  {selectedVillage?.population
                    ? selectedVillage.population.toLocaleString('en-IN')
                    : 'not recorded'}{' '}
                  · Basin: {selectedVillage?.river_basin || 'unassigned'}
                </p>
              </div>
              <div className="impact-countdown">
                <span>Impact TTI (from modelled lead time)</span>
                <strong>{tti}</strong>
              </div>
            </div>
            <div className="impact-metrics">
              <div>
                <span>Critical risk score</span>
                <strong>
                  {Math.round(selectedRisk)}
                  <small>/100</small>
                </strong>
                <i style={{ '--risk-width': `${Math.min(100, selectedRisk)}%` }} />
              </div>
              <div>
                <span>Stream stage</span>
                <strong>
                  {(selectedVillage?.latest_stream_level_m ?? 0).toFixed(2)}
                  <small>m</small>
                </strong>
                <em>
                  {(selectedVillage?.latest_stream_level_m ?? 0) >= 2.5
                    ? 'Above flood stage (2.5 m)'
                    : 'Below flood stage (2.5 m)'}
                </em>
              </div>
              <div>
                <span>Civil evac status</span>
                <strong className={selectedRisk > 70 ? '' : 'amber-text'}>
                  {latestAlert && latestAlert.village_id === selectedVillage?.id
                    ? '● DISPATCHED'
                    : '● PENDING'}
                </strong>
                <em>
                  {evacPlan?.recommended
                    ? `${Math.round(evacPlan.recommended.walking_time_min)} min on foot to ${evacPlan.recommended.shelter_name}`
                    : 'SACHET sirens armed'}
                </em>
              </div>
            </div>
          </div>

          <div className="center-hydrograph">
            {selectedVillage ? (
              <HydrographChart villageId={selectedVillage.id} height={150} />
            ) : (
              <span className="telemetry text-[9px] uppercase tracking-wider text-slate-500">
                Select a node to load its hydrograph
              </span>
            )}
          </div>

          <div className="tactical-storm-control">
            <StormControlPanel
              villages={villages}
              onStormTriggered={reload}
              onResetTriggered={reload}
            />
          </div>

          {activeView === 'map' && (
            <AuthorityTableView
              villages={villages}
              selectedVillage={selectedVillage}
              onSelectVillage={(v) => setSelectedId(v?.id ?? null)}
            />
          )}
        </main>

        <aside className="tactical-rail">
          <div className="tactical-section-heading">
            <span>
              <Activity /> Live Telemetry Matrix
            </span>
            <i className="live-dot" />
          </div>
          <div className="telemetry-matrix">
            <div>
              <span>Rainfall</span>
              <strong>{(selectedVillage?.latest_rainfall_mm ?? 0).toFixed(1)}</strong>
              <small>mm/h</small>
            </div>
            <div>
              <span>Soil Moist</span>
              <strong>{(selectedVillage?.latest_soil_moisture_pct ?? 0).toFixed(1)}</strong>
              <small>%</small>
            </div>
            <div>
              <span>Seismic</span>
              <strong>{(selectedVillage?.latest_vibration_index ?? 0).toFixed(2)}</strong>
              <small>idx</small>
            </div>
            <div>
              <span>Slope Int</span>
              <strong>{(selectedVillage?.avg_slope_deg ?? 0).toFixed(1)}</strong>
              <small>°</small>
            </div>
          </div>

          <div className="rail-hydrograph">
            {selectedVillage ? (
              <HydrographChart villageId={selectedVillage.id} height={120} compact />
            ) : (
              <span className="telemetry text-[9px] uppercase tracking-wider text-slate-500">
                No node selected
              </span>
            )}
          </div>

          <div className="tactical-dispatcher">
            <div className="tactical-section-heading">
              <span>
                <Send /> CAP / SACHET Dispatcher
              </span>
              <span className="tactical-chip amber">NDMA Protocol</span>
            </div>
            <label>
              Target tower ID
              <input
                value={
                  selectedVillage
                    ? `TWR-${(selectedVillage.district || 'HIM').slice(0, 3).toUpperCase()}-${String(selectedVillage.id).padStart(2, '0')}`
                    : '—'
                }
                readOnly
              />
            </label>
            <div className="dispatch-preview">
              <span>
                MSG PREVIEW (EN/HI) <b>GEO-FENCED</b>
              </span>
              <p>
                {latestAlert?.message_en ||
                  `No alert dispatched yet for this basin. Pressing dispatch generates the bilingual CAP body for ${selectedVillage?.name || 'the selected node'} from its live risk state.`}
              </p>
              <p className="hindi">
                {latestAlert?.message_hi ||
                  'चेतावनी भेजने पर द्विभाषी संदेश यहाँ दिखेगा।'}
              </p>
            </div>
            <button
              className="dispatch-button"
              onClick={handleDispatch}
              disabled={!selectedVillage || dispatch.status === 'SENDING'}
            >
              {dispatch.status === 'SENDING' ? (
                <Loader2 className="animate-spin" />
              ) : dispatch.status === 'SENT' ? (
                <CheckCircle2 />
              ) : dispatch.status === 'FAILED' ? (
                <XCircle />
              ) : (
                <Send />
              )}{' '}
              {dispatchLabel}
            </button>
            {dispatch.detail && (
              <p
                className={`telemetry text-[8px] uppercase tracking-wider mt-1.5 break-all ${
                  dispatch.status === 'FAILED' ? 'text-rose-300' : 'text-emerald-300'
                }`}
              >
                {dispatch.status === 'SENT' ? `CAP id ${dispatch.detail}` : dispatch.detail}
              </p>
            )}
          </div>

          {selectedVillage && (
            <div className="tactical-dispatcher">
              <div className="tactical-section-heading">
                <span>
                  <RouteIcon /> Nearest safe ground
                </span>
                <button
                  onClick={() => openVillage(selectedVillage)}
                  className="tactical-chip cyan"
                  style={{ cursor: 'pointer' }}
                >
                  Full plan ↗
                </button>
              </div>
              <EvacuationRoutePanel
                villageId={selectedVillage.id}
                onRouteHover={setHoveredRoute}
                onPlanLoaded={setEvacPlan}
                compact
              />
            </div>
          )}

          <button className="methodology-card" onClick={() => setExplainerOpen(true)}>
            <BookOpen />
            <span>
              <small>Methodology Ref</small>
              <strong>Lead-Time & Threshold Model</strong>
            </span>
            <Gauge />
          </button>

          <div className="tactical-rail-secondary">
            <VillageDetailPanel
              village={selectedVillage}
              onOpenExplainer={() => setExplainerOpen(true)}
            />
            <AlertFeedPanel alerts={alerts} />
          </div>
        </aside>
      </div>

      <LeadTimeExplainerModal isOpen={explainerOpen} onClose={() => setExplainerOpen(false)} />

      <footer className="mt-8 text-center text-xs text-gray-500 py-3 border-t border-disaster-border/40 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>SIH 2026 Software Submission • Disaster Management Theme</span>
        <Link to="/backtest" className="hover:text-cyan-300 flex items-center gap-1">
          Historical backtest <ExternalLink className="w-3 h-3" />
        </Link>
        <span>
          Last telemetry sync: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'awaiting feed'}
        </span>
      </footer>
    </div>
  );
}





