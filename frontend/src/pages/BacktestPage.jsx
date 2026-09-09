/**
 * Historical event backtest (route: /backtest).
 *
 * Section 7 of PROJECT_INSTRUCTIONS asks a single question: replay a real disaster through
 * the engine and say how many hours of warning it would have produced. That number is the
 * only defensible claim a prediction system can make about itself, so this page shows it
 * together with everything needed to attack it:
 *
 *   - the published basis and references for each event's inputs
 *   - an explicit statement that the hourly curve is a RECONSTRUCTION, not gauge telemetry
 *   - the full step-by-step timeline, so the moment of crossing is auditable
 *   - a met-only ablation column: the same step re-run with the seismic channel clamped to
 *     a quiet baseline, which is how the "rainfall alone would have given zero warning"
 *     claim for Chamoli 2021 is measured rather than asserted
 *   - Chamoli 2021 included deliberately as a case the rainfall pathway CANNOT catch
 *
 * Every risk score, level and lead time on this page is computed live by
 * ml/prediction_engine.py at request time. None of it is stored or authored.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, History, TriangleAlert, CheckCircle2, XCircle, Loader2, BookOpen,
  Activity, CloudRain, Layers, Radio, Info, ShieldAlert, Clock,
} from 'lucide-react';
import { getBacktestEvents, getBacktest } from '../lib/api';

const LEVEL_DOT = {
  red: 'bg-rose-500',
  yellow: 'bg-amber-400',
  green: 'bg-emerald-400',
};

const LEVEL_TEXT = {
  red: 'text-rose-300',
  yellow: 'text-amber-300',
  green: 'text-emerald-300',
};

const RULE_LABEL = {
  'fused_risk_score>=70': 'Fused score ≥ 70',
  'saturation+intensity_rule': 'Saturation + intensity co-trigger',
  'seismic_vibration>0.55': 'Seismic vibration > 0.55',
};

// A meteorological driver is one the rainfall channel can see; anything else has to be caught
// by the seismic channel, which is the whole point of the ablation column.
const isMetDriver = (driver = '') => /rain|cloudburst|monsoon/i.test(driver);

function DriverIcon({ driver, className }) {
  const Icon = isMetDriver(driver) ? CloudRain : Layers;
  return <Icon className={className} />;
}

/** Catalogue tile. Shows only what the catalogue endpoint returns -- no result preview, because
 *  the result does not exist until the engine is actually run for that event. */
function EventCard({ ev, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-lg border p-3 transition w-full ${
        active
          ? 'border-cyan-500/60 bg-cyan-500/10'
          : 'border-[#273647] bg-[#071a2c] hover:border-[#3a4d63]'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[13px] font-bold text-white leading-tight">{ev.name}</span>
        <DriverIcon
          driver={ev.driver}
          className={`w-4 h-4 shrink-0 ${active ? 'text-cyan-300' : 'text-slate-500'}`}
        />
      </div>
      <span className="telemetry block text-[9px] uppercase tracking-wider text-slate-500 mb-2">
        {ev.event_date} · {ev.region}
      </span>
      <p className="text-[10px] text-slate-400 leading-relaxed mb-2">{ev.driver_label}</p>
      <div className="flex items-center justify-between text-[9px] telemetry uppercase tracking-wider">
        <span className="text-rose-300/80">{ev.human_cost}</span>
        <span className="text-slate-500">{ev.timeline_points} steps</span>
      </div>
    </button>
  );
}

function WarningStat({ icon: Icon, label, value, sub, tone = 'text-white' }) {
  return (
    <div className="rounded-lg border border-[#273647] bg-[#071a2c] p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span className="telemetry text-[9px] uppercase tracking-wider text-slate-400">
          {label}
        </span>
      </div>
      <span className={`block text-xl font-black font-heading leading-none ${tone}`}>{value}</span>
      {sub && <span className="block text-[10px] text-slate-500 mt-1.5 leading-relaxed">{sub}</span>}
    </div>
  );
}

/** The audit trail. One row per reconstructed hour, with the met-only re-run beside the full
 *  fused score so the contribution of the seismic channel is visible per step rather than
 *  summarised away. */
function StepsTable({ steps, quietBaseline }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#273647]">
      <table className="w-full text-left border-collapse min-w-[860px]">
        <thead>
          <tr className="bg-[#0a1e30] telemetry text-[9px] uppercase tracking-wider text-slate-400">
            <th className="px-2.5 py-2 font-semibold">Clock</th>
            <th className="px-2.5 py-2 font-semibold text-right">Rain 1h</th>
            <th className="px-2.5 py-2 font-semibold text-right">Rain 24h</th>
            <th className="px-2.5 py-2 font-semibold text-right">Soil</th>
            <th className="px-2.5 py-2 font-semibold text-right">Vibration</th>
            <th className="px-2.5 py-2 font-semibold text-right">I/D ratio</th>
            <th className="px-2.5 py-2 font-semibold text-right">ML susc.</th>
            <th className="px-2.5 py-2 font-semibold text-right">Fused</th>
            <th className="px-2.5 py-2 font-semibold text-right border-l border-[#273647]">
              Met-only
            </th>
            <th className="px-2.5 py-2 font-semibold">Lead</th>
            <th className="px-2.5 py-2 font-semibold">Dominant factor / rules</th>
          </tr>
        </thead>
        <tbody className="telemetry text-[10px]">
          {steps.map((s, i) => {
            const isFirstRed = s.risk_level === 'red' && steps[i - 1]?.risk_level !== 'red';
            return (
              <tr
                key={s.t_minus_hrs}
                className={`border-t border-[#182a3c] ${
                  isFirstRed ? 'bg-rose-500/10' : i % 2 ? 'bg-[#061625]' : ''
                }`}
              >
                <td className="px-2.5 py-1.5 whitespace-nowrap">
                  <span className="text-slate-200 font-semibold">{s.clock_label}</span>
                  {isFirstRed && (
                    <span className="ml-1.5 text-[8px] uppercase text-rose-300 font-bold">
                      ← first red
                    </span>
                  )}
                </td>
                <td className="px-2.5 py-1.5 text-right text-cyan-300">
                  {s.inputs.rainfall_1h_mm.toFixed(1)}
                </td>
                <td className="px-2.5 py-1.5 text-right text-cyan-300/70">
                  {s.inputs.rainfall_24h_mm.toFixed(0)}
                </td>
                <td className="px-2.5 py-1.5 text-right text-emerald-300">
                  {s.inputs.soil_moisture_pct.toFixed(1)}%
                </td>
                <td className="px-2.5 py-1.5 text-right text-fuchsia-300">
                  {s.inputs.vibration_index.toFixed(3)}
                </td>
                <td className="px-2.5 py-1.5 text-right text-slate-400">
                  {s.intensity_duration_ratio.toFixed(2)}
                </td>
                <td className="px-2.5 py-1.5 text-right text-slate-400">
                  {s.ml_susceptibility.toFixed(0)}%
                </td>
                <td className="px-2.5 py-1.5 text-right">
                  <span className="inline-flex items-center gap-1.5 justify-end">
                    <span className={`w-1.5 h-1.5 rounded-full ${LEVEL_DOT[s.risk_level]}`} />
                    <span className={`font-bold ${LEVEL_TEXT[s.risk_level]}`}>
                      {s.risk_score.toFixed(1)}
                    </span>
                  </span>
                </td>
                <td className="px-2.5 py-1.5 text-right border-l border-[#273647]">
                  <span className="inline-flex items-center gap-1.5 justify-end">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${LEVEL_DOT[s.met_only_risk_level]}`}
                    />
                    <span className={LEVEL_TEXT[s.met_only_risk_level]}>
                      {s.met_only_risk_score.toFixed(1)}
                    </span>
                  </span>
                </td>
                <td className="px-2.5 py-1.5 text-amber-300 whitespace-nowrap">
                  {s.estimated_lead_time_hrs.toFixed(1)} h
                </td>
                <td className="px-2.5 py-1.5">
                  <span className="text-slate-300">{s.primary_factor}</span>
                  {s.red_trigger_rules?.length > 0 && (
                    <span className="block text-[8px] uppercase tracking-wider text-rose-300/70 mt-0.5">
                      {s.red_trigger_rules.map((r) => RULE_LABEL[r] || r).join(' · ')}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="bg-[#0a1e30] px-2.5 py-2 border-t border-[#273647]">
        <p className="text-[10px] text-slate-500 leading-relaxed">
          <span className="text-slate-300 font-semibold">Met-only column:</span> the identical step
          re-scored with <code className="text-fuchsia-300">vibration_index</code> clamped to a
          quiet baseline of {quietBaseline}. It answers one question — would the rainfall and
          soil-moisture channels alone have raised this alarm?
        </p>
      </div>
    </div>
  );
}

export default function BacktestPage() {
  const [events, setEvents] = useState([]);
  const [catalogueError, setCatalogueError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Catalogue once. The first event becomes the default selection so the page is never empty.
  useEffect(() => {
    let alive = true;
    getBacktestEvents()
      .then((list) => {
        if (!alive) return;
        setEvents(list);
        if (list.length > 0) setSelectedId(list[0].id);
        else setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setCatalogueError(e.message);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Each selection re-runs the engine server-side. Aborted on switch so a slow earlier replay
  // cannot land after a faster later one and show the wrong event's numbers.
  useEffect(() => {
    if (!selectedId) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    getBacktest(selectedId, ctrl.signal)
      .then((r) => {
        setResult(r);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name === 'AbortError') return;
        setError(e.message);
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [selectedId]);

  const ev = result?.event;
  const sum = result?.summary;
  const detected = sum?.detected;
  const metBlind = sum && sum.seismic_channel_essential;

  return (
    <div className="min-h-screen bg-[#04101d] text-slate-100">
      {/* ---- Header ---- */}
      <header className="border-b border-[#273647] bg-[#061625]/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-[1500px] mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white transition shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="telemetry uppercase tracking-wider text-[9px]">Console</span>
          </Link>
          <div className="w-px h-6 bg-[#273647]" />
          <History className="w-4 h-4 text-[#ffb3ad] shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-black font-heading tracking-tight text-white leading-none">
              HISTORICAL EVENT BACKTEST
            </h1>
            <span className="telemetry text-[9px] uppercase tracking-[0.15em] text-slate-500">
              Would this system have warned in time?
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto px-4 py-4">
        {/* ---- The honesty banner. Nothing on this page means anything without it. ---- */}
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 mb-4">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="telemetry block text-[9px] uppercase tracking-wider text-amber-200 font-bold mb-1">
                Read this before reading the numbers
              </span>
              <p className="text-[11px] text-amber-100/85 leading-relaxed">
                The hourly input curves below are a{' '}
                <span className="font-bold">reconstruction</span> built from published rainfall
                totals, post-event scientific reports and news timelines — they are{' '}
                <span className="font-bold">not</span> archived gauge telemetry, because
                minute-resolution instrument records for these catchments are not public. The
                risk scores, alert levels and lead times, however, are computed live by the same{' '}
                <code className="text-amber-200">ml/prediction_engine.py</code> that drives the
                console; nothing here is a stored or hand-written result. Treat the warning hours
                as an indication of the method's sensitivity, not as a validated skill score.
              </p>
              {result && (
                <p className="telemetry text-[9px] uppercase tracking-wider text-amber-200/70 mt-2">
                  Engine {result.model_version} · {result.data_provenance}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          {/* ---- Event catalogue ---- */}
          <aside className="flex flex-col gap-2">
            <span className="telemetry text-[9px] uppercase tracking-wider text-slate-500 px-1">
              Replay catalogue
            </span>
            {catalogueError && (
              <div className="rounded border border-rose-500/40 bg-rose-500/10 p-2.5">
                <span className="text-[11px] text-rose-200">
                  Could not load the event catalogue: {catalogueError}
                </span>
              </div>
            )}
            {events.map((e) => (
              <EventCard
                key={e.id}
                ev={e}
                active={e.id === selectedId}
                onClick={() => setSelectedId(e.id)}
              />
            ))}
            <p className="text-[10px] text-slate-500 leading-relaxed px-1 mt-1">
              Chamoli 2021 is in this list on purpose. It was a rock–ice avalanche on a dry
              winter day, so the rainfall pathway cannot see it at all — the met-only column is
              there to prove that rather than let the claim stand unmeasured.
            </p>
          </aside>

          {/* ---- Replay result ---- */}
          <section className="min-w-0">
            {loading && (
              <div className="rounded-lg border border-[#273647] bg-[#071a2c] p-10 flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 text-cyan-300 animate-spin" />
                <span className="telemetry text-[10px] uppercase tracking-wider text-slate-400">
                  Re-running the engine over the reconstructed timeline…
                </span>
              </div>
            )}

            {!loading && error && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TriangleAlert className="w-4 h-4 text-rose-300" />
                  <span className="telemetry text-[10px] uppercase tracking-wider text-rose-200 font-bold">
                    Replay failed
                  </span>
                </div>
                <p className="text-[11px] text-rose-100/80">{error}</p>
              </div>
            )}

            {!loading && !error && result && (
              <div className="flex flex-col gap-4">
                {/* ---- Verdict ---- */}
                <div
                  className={`rounded-lg border p-4 ${
                    detected
                      ? 'border-emerald-500/50 bg-emerald-500/10'
                      : 'border-rose-500/50 bg-rose-500/10'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {detected ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <span className="telemetry block text-[9px] uppercase tracking-wider text-slate-400 mb-1">
                        {ev.name} · {ev.event_date} · {ev.region}
                      </span>
                      <h2
                        className={`text-lg font-black font-heading leading-tight mb-2 ${
                          detected ? 'text-emerald-200' : 'text-rose-200'
                        }`}
                      >
                        {sum.verdict.headline}
                      </h2>
                      <p className="text-[12px] text-slate-200 leading-relaxed mb-2">
                        {sum.verdict.detail}
                      </p>
                      <div className="rounded border border-[#273647] bg-[#04101d]/60 p-2.5">
                        <span className="telemetry block text-[9px] uppercase tracking-wider text-slate-500 mb-1">
                          Limitation
                        </span>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          {sum.verdict.limitation}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ---- The headline numbers ---- */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  <WarningStat
                    icon={ShieldAlert}
                    label="Red warning ahead"
                    value={sum.red_warning_label || '—'}
                    tone={sum.red_warning_hrs ? 'text-rose-300' : 'text-slate-500'}
                    sub="Time between the first RED evaluation and the destructive surge."
                  />
                  <WarningStat
                    icon={TriangleAlert}
                    label="Yellow watch ahead"
                    value={sum.yellow_warning_label || '—'}
                    tone={sum.yellow_warning_hrs ? 'text-amber-300' : 'text-slate-500'}
                    sub="First moment the console would have raised a watch."
                  />
                  <WarningStat
                    icon={CloudRain}
                    label="Met-only red warning"
                    value={sum.met_only_red_warning_label || 'never'}
                    tone={sum.met_only_red_warning_hrs ? 'text-cyan-300' : 'text-rose-300'}
                    sub={
                      metBlind
                        ? 'Rainfall + soil alone: no red. The seismic channel is what catches this event.'
                        : 'Rainfall + soil alone would also have reached red here.'
                    }
                  />
                  <WarningStat
                    icon={Activity}
                    label="Peak fused score"
                    value={sum.peak_risk_score.toFixed(1)}
                    tone="text-white"
                    sub={
                      sum.red_trigger_rules?.length
                        ? `Triggered by: ${sum.red_trigger_rules
                            .map((r) => RULE_LABEL[r] || r)
                            .join(', ')}`
                        : 'No red rule was ever satisfied.'
                    }
                  />
                </div>

                {/* ---- Two clocks. These get confused constantly, so they are named. ---- */}
                <div className="rounded-lg border border-[#273647] bg-[#071a2c] p-3">
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="telemetry block text-[9px] uppercase tracking-wider text-slate-400 mb-1.5">
                        Two different clocks
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2">
                        <div className="rounded border border-[#182a3c] bg-[#04101d] px-2.5 py-2">
                          <span className="telemetry block text-[8px] uppercase tracking-wider text-slate-500">
                            Warning ahead of surge
                          </span>
                          <span className="text-sm font-bold text-rose-300">
                            {sum.red_warning_label || '—'}
                          </span>
                        </div>
                        <div className="rounded border border-[#182a3c] bg-[#04101d] px-2.5 py-2">
                          <span className="telemetry block text-[8px] uppercase tracking-wider text-slate-500">
                            Engine saturation window at first red
                          </span>
                          <span className="text-sm font-bold text-amber-300">
                            {sum.saturation_window_at_first_red_hrs != null
                              ? `${sum.saturation_window_at_first_red_hrs.toFixed(1)} h`
                              : '—'}
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed">{sum.clock_note}</p>
                    </div>
                  </div>
                </div>

                {/* ---- Ablation verdict, spelled out ---- */}
                <div
                  className={`rounded-lg border p-3 ${
                    metBlind
                      ? 'border-fuchsia-500/40 bg-fuchsia-500/10'
                      : 'border-[#273647] bg-[#071a2c]'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Radio
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        metBlind ? 'text-fuchsia-300' : 'text-slate-500'
                      }`}
                    />
                    <div className="min-w-0">
                      <span className="telemetry block text-[9px] uppercase tracking-wider text-slate-400 mb-1">
                        Seismic channel ablation
                      </span>
                      <p className="text-[11px] text-slate-200 leading-relaxed">
                        {metBlind ? (
                          <>
                            With the vibration input clamped to a quiet baseline of{' '}
                            {result.quiet_vibration_baseline}, this event{' '}
                            <span className="font-bold text-fuchsia-200">never reaches red</span>.
                            The seismic channel is not a bonus feature for this hazard class — it
                            is the only channel that sees it. A rainfall-threshold system would
                            have issued nothing.
                          </>
                        ) : (
                          <>
                            With the vibration input clamped to a quiet baseline of{' '}
                            {result.quiet_vibration_baseline}, this event still reaches red at{' '}
                            <span className="font-bold text-cyan-200">
                              {sum.met_only_red_warning_label}
                            </span>
                            . This was a rainfall-driven event, so the meteorological pathway
                            carries the warning on its own; the seismic channel adds confirmation
                            rather than detection.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ---- What actually happened, and where the inputs came from ---- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div className="rounded-lg border border-[#273647] bg-[#071a2c] p-3">
                    <span className="telemetry block text-[9px] uppercase tracking-wider text-slate-400 mb-1.5">
                      The event
                    </span>
                    <p className="text-[11px] text-slate-300 leading-relaxed mb-2">
                      {ev.impact_summary}
                    </p>
                    <div className="flex items-center gap-1.5 mb-2">
                      <DriverIcon driver={ev.driver} className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-[10px] text-slate-400">{ev.driver_label}</span>
                    </div>
                    <div className="rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5">
                      <span className="telemetry text-[8px] uppercase tracking-wider text-rose-200/70">
                        Human cost
                      </span>
                      <span className="block text-[11px] text-rose-100 font-semibold">
                        {ev.human_cost}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#273647] bg-[#071a2c] p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                      <span className="telemetry text-[9px] uppercase tracking-wider text-slate-400">
                        Where the input curve comes from
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed mb-2">
                      {ev.published_basis}
                    </p>
                    <ul className="flex flex-col gap-1">
                      {ev.references?.map((r, i) => (
                        <li key={i} className="text-[10px] text-slate-500 leading-relaxed flex gap-1.5">
                          <span className="text-slate-600 shrink-0">[{i + 1}]</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* ---- Site parameters actually fed to the engine ---- */}
                <div className="rounded-lg border border-[#273647] bg-[#071a2c] p-3">
                  <span className="telemetry block text-[9px] uppercase tracking-wider text-slate-400 mb-2">
                    Static site inputs · {ev.site.name}
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    {[
                      ['Elevation', `${ev.site.elevation_m} m`],
                      ['Mean slope', `${ev.site.avg_slope_deg}°`],
                      ['Dist. to stream', `${ev.site.distance_to_stream_m} m`],
                      ['Drainage index', ev.site.drainage_capacity_index],
                      ['Past incidents', ev.site.historical_incident_count],
                    ].map(([k, v]) => (
                      <div
                        key={k}
                        className="rounded border border-[#182a3c] bg-[#04101d] px-2.5 py-1.5"
                      >
                        <span className="telemetry block text-[8px] uppercase tracking-wider text-slate-500">
                          {k}
                        </span>
                        <span className="telemetry text-[12px] font-bold text-slate-200">{v}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed mt-2">
                    Terrain values are taken from the same 30 m SRTM-derived parameters the live
                    nodes use, so the replay and the console are scoring on identical geometry.
                  </p>
                </div>

                {/* ---- The auditable timeline ---- */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    <span className="telemetry text-[9px] uppercase tracking-wider text-slate-400">
                      Step-by-step replay · {result.steps.length} evaluations
                    </span>
                  </div>
                  <StepsTable
                    steps={result.steps}
                    quietBaseline={result.quiet_vibration_baseline}
                  />
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
