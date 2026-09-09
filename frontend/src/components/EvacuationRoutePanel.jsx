/**
 * Ranked evacuation options for one settlement, from GET /api/villages/{id}/evacuation.
 *
 * The number this panel exists to show is the comparison in the header: WALKING TIME against
 * USABLE WINDOW. A prediction system that says "you have 40 minutes" is only useful if
 * somebody can also answer "and the walk takes 55" -- that gap is the difference between an
 * alert and an evacuation. Every figure here is computed server-side by backend/evacuation.py
 * (Haversine distance, terrain sinuosity, Tobler hiking speed, rain and darkness slowdown,
 * footpath congestion); this component only formats it.
 *
 * The night toggle is not decoration either: unlit hill tracks carry a 1.20x time penalty in
 * the model, which is often enough to move an option from `feasible` to `tight`.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Footprints,
  MoonStar,
  Sun,
  TriangleAlert,
  Mountain,
  Phone,
  Users,
  ArrowUpRight,
  RefreshCw,
  Route as RouteIcon,
} from 'lucide-react';
import { getEvacuationPlan } from '../lib/api';

const FEASIBILITY_STYLE = {
  feasible: { label: 'REACHABLE IN TIME', cls: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' },
  tight: { label: 'TIGHT WINDOW', cls: 'text-amber-300 border-amber-500/40 bg-amber-500/10' },
  not_feasible_on_foot: {
    label: 'NOT FEASIBLE ON FOOT',
    cls: 'text-rose-300 border-rose-500/40 bg-rose-500/10',
  },
  unknown: { label: 'NO LEAD TIME YET', cls: 'text-slate-300 border-slate-500/40 bg-slate-500/10' },
};

const SURFACE_LABEL = {
  motorable: 'Motorable road',
  mule_track: 'Mule track',
  footpath: 'Footpath',
};

function OptionRow({ opt, recommended, onHover }) {
  const style = FEASIBILITY_STYLE[opt.feasibility] || FEASIBILITY_STYLE.unknown;
  return (
    <div
      onMouseEnter={() => onHover?.(opt)}
      onMouseLeave={() => onHover?.(null)}
      className={`rounded-md border p-2.5 transition ${
        recommended
          ? 'border-cyan-400/50 bg-cyan-500/[0.07]'
          : 'border-[#273647] bg-[#071a2c] hover:border-[#3a4d63]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[13px] font-semibold text-white truncate">{opt.shelter_name}</span>
            {recommended && (
              <span className="telemetry text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-400 text-[#04121f] font-bold">
                Recommended
              </span>
            )}
            {!opt.serves_this_village && (
              <span className="telemetry text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#1c2b3c] text-slate-400">
                Neighbouring village
              </span>
            )}
            {(opt.below_settlement ?? opt.elevation_gain_m < 0) && (
              <span className="telemetry text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                Below settlement
              </span>
            )}
          </div>
          <span className="telemetry text-[9px] uppercase tracking-wider text-slate-500">
            {opt.shelter_type?.replace(/_/g, ' ')} · {SURFACE_LABEL[opt.route_surface] || opt.route_surface}
          </span>
        </div>
        <span
          className={`telemetry shrink-0 text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${style.cls}`}
        >
          {style.label}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-2">
        <div>
          <span className="telemetry block text-[8px] uppercase tracking-wider text-slate-500">On foot</span>
          <strong className="text-sm text-white">
            {Math.round(opt.walking_time_min)}
            <small className="text-[9px] text-slate-400 ml-0.5">min</small>
          </strong>
        </div>
        <div>
          <span className="telemetry block text-[8px] uppercase tracking-wider text-slate-500">
            {opt.elevation_gain_m < 0 ? 'Descent' : 'Climb'}
          </span>
          <strong className={`text-sm ${opt.elevation_gain_m < 0 ? 'text-rose-300' : 'text-white'}`}>
            {Math.abs(Math.round(opt.elevation_gain_m))}
            <small className="text-[9px] text-slate-400 ml-0.5">m</small>
          </strong>
        </div>
        <div>
          <span className="telemetry block text-[8px] uppercase tracking-wider text-slate-500">Path</span>
          <strong className="text-sm text-white">
            {(opt.path_length_m / 1000).toFixed(2)}
            <small className="text-[9px] text-slate-400 ml-0.5">km</small>
          </strong>
        </div>
        <div>
          <span className="telemetry block text-[8px] uppercase tracking-wider text-slate-500">Safety</span>
          <strong
            className={`text-sm ${
              opt.safety_score >= 70
                ? 'text-emerald-300'
                : opt.safety_score >= 45
                  ? 'text-amber-300'
                  : 'text-rose-300'
            }`}
          >
            {opt.safety_score}
            <small className="text-[9px] text-slate-400 ml-0.5">/100</small>
          </strong>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap mt-2 pt-2 border-t border-[#1d2c3f]">
        <span className="telemetry text-[9px] text-slate-400 flex items-center gap-1">
          <Mountain className="w-3 h-3" /> {Math.round(opt.elevation_m)} m · {opt.grade_pct}% grade
        </span>
        <span className="telemetry text-[9px] text-slate-400 flex items-center gap-1">
          <Footprints className="w-3 h-3" /> {opt.tobler_speed_kmh} km/h Tobler
        </span>
        <span className="telemetry text-[9px] text-slate-400 flex items-center gap-1">
          <Users className="w-3 h-3" /> {opt.capacity}
        </span>
        {opt.contact_phone && (
          <a
            href={`tel:${opt.contact_phone}`}
            className="telemetry text-[9px] text-cyan-300 hover:text-cyan-200 flex items-center gap-1"
          >
            <Phone className="w-3 h-3" /> {opt.contact_phone}
          </a>
        )}
        {opt.crosses_stream && (
          <span className="telemetry text-[9px] text-rose-300 flex items-center gap-1">
            <TriangleAlert className="w-3 h-3" /> Crosses hazard channel
          </span>
        )}
      </div>
    </div>
  );
}

export default function EvacuationRoutePanel({ villageId, onRouteHover, onPlanLoaded, compact = false }) {
  const [plan, setPlan] = useState(null);
  const [isNight, setIsNight] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(
    async (night = isNight) => {
      if (!villageId) return;
      setBusy(true);
      try {
        const data = await getEvacuationPlan(villageId, { isNight: night });
        setPlan(data);
        setError(null);
        onPlanLoaded?.(data);
      } catch (err) {
        setError(err.message || 'Evacuation plan unavailable');
      } finally {
        setBusy(false);
      }
    },
    [villageId, isNight, onPlanLoaded]
  );

  useEffect(() => {
    load(isNight);
    // Re-cost on a slow cadence: the ranking only changes when the lead time or the rain
    // rate moves, so there is no reason to hammer this the way telemetry is polled.
    const id = window.setInterval(() => load(isNight), 15000);
    return () => window.clearInterval(id);
  }, [load, isNight]);

  if (error) {
    return (
      <div className="rounded-md border border-rose-500/40 bg-rose-950/20 p-3">
        <span className="telemetry text-[9px] uppercase tracking-wider text-rose-300">
          {error}
        </span>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="rounded-md border border-[#273647] bg-[#071a2c] p-3">
        <span className="telemetry text-[9px] uppercase tracking-wider text-slate-500">
          Costing evacuation routes…
        </span>
      </div>
    );
  }

  const rec = plan.recommended;
  const usable = rec?.usable_window_min ?? null;
  const walk = rec?.walking_time_min ?? null;
  const margin = usable !== null && walk !== null ? usable - walk : null;
  const visible = showAll ? plan.options : plan.options.slice(0, compact ? 2 : 3);

  return (
    <div className="flex flex-col gap-2.5">
      {/* ---- The headline comparison: time needed vs time available ---- */}
      <div className="rounded-md border border-[#273647] bg-[#0d1c2d] p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="telemetry text-[9px] uppercase tracking-wider text-[#ab8986] flex items-center gap-1.5">
            <RouteIcon className="w-3.5 h-3.5 text-cyan-300" />
            Can they get out in time?
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsNight((n) => !n)}
              className={`telemetry flex items-center gap-1 text-[9px] uppercase tracking-wider px-2 py-1 rounded border transition ${
                isNight
                  ? 'border-indigo-400/50 bg-indigo-500/15 text-indigo-200'
                  : 'border-[#273647] bg-[#071a2c] text-slate-400 hover:text-slate-200'
              }`}
              title="Night raises walking time by 1.20x on unlit hill tracks"
            >
              {isNight ? <MoonStar className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
              {isNight ? 'Night' : 'Day'}
            </button>
            <button
              onClick={() => load(isNight)}
              className="p-1 rounded border border-[#273647] bg-[#071a2c] text-slate-400 hover:text-cyan-300"
              title="Re-cost routes now"
            >
              <RefreshCw className={`w-3 h-3 ${busy ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <span className="telemetry block text-[8px] uppercase tracking-wider text-slate-500">
              Walk needed
            </span>
            <strong className="text-lg font-bold text-white">
              {walk !== null ? Math.round(walk) : '—'}
              <small className="text-[10px] text-slate-400 ml-1">min</small>
            </strong>
          </div>
          <div>
            <span className="telemetry block text-[8px] uppercase tracking-wider text-slate-500">
              Usable window
            </span>
            <strong className="text-lg font-bold text-amber-300">
              {usable !== null ? Math.round(usable) : '—'}
              <small className="text-[10px] text-slate-400 ml-1">min</small>
            </strong>
          </div>
          <div>
            <span className="telemetry block text-[8px] uppercase tracking-wider text-slate-500">
              Margin
            </span>
            <strong
              className={`text-lg font-bold ${
                margin === null ? 'text-slate-400' : margin >= 0 ? 'text-emerald-300' : 'text-rose-400'
              }`}
            >
              {margin === null ? '—' : `${margin >= 0 ? '+' : ''}${Math.round(margin)}`}
              <small className="text-[10px] text-slate-400 ml-1">min</small>
            </strong>
          </div>
        </div>

        <p className="telemetry text-[8px] uppercase tracking-wider text-slate-500 mt-2 leading-relaxed">
          Window = {plan.lead_time_hrs.toFixed(1)} h modelled lead time x 0.70 safety fraction.
          The remaining 30% absorbs alerting latency, household mobilisation and the
          elderly/child tail of the crowd.
        </p>
      </div>

      {/* ---- Bilingual advisory: the actual instruction that goes out ---- */}
      {plan.advisory && (
        <div className="rounded-md border-l-2 border-l-cyan-400 border border-[#273647] bg-[#071a2c] p-2.5">
          <span className="telemetry block text-[8px] uppercase tracking-wider text-[#ab8986] mb-1">
            Advisory dispatched with the alert
          </span>
          <p className="text-[11px] text-slate-200 leading-relaxed">{plan.advisory.en}</p>
          <p className="text-[11px] text-amber-100/90 leading-relaxed mt-1.5">{plan.advisory.hi}</p>
        </div>
      )}

      {/* ---- Ranked options ---- */}
      <div className="flex flex-col gap-2">
        {visible.map((opt, i) => (
          <OptionRow
            key={opt.shelter_id ?? i}
            opt={opt}
            recommended={i === 0 && !showAll ? true : opt.shelter_id === rec?.shelter_id}
            onHover={onRouteHover}
          />
        ))}
      </div>

      {plan.options.length > visible.length && (
        <button
          onClick={() => setShowAll(true)}
          className="telemetry text-[9px] uppercase tracking-wider text-cyan-300 hover:text-cyan-200 flex items-center justify-center gap-1 py-1"
        >
          Show all {plan.options.length} costed shelters <ArrowUpRight className="w-3 h-3" />
        </button>
      )}
      {showAll && (
        <button
          onClick={() => setShowAll(false)}
          className="telemetry text-[9px] uppercase tracking-wider text-slate-500 hover:text-slate-300 py-1"
        >
          Collapse
        </button>
      )}

      <p className="telemetry text-[8px] uppercase tracking-wider text-slate-600 leading-relaxed">
        {plan.candidates_considered} shelters costed within {plan.search_radius_km} km ·{' '}
        {plan.model.speed_model} · route lines are an {rec?.alignment || 'indicative'} alignment,
        not a surveyed centreline
      </p>
    </div>
  );
}
