/**
 * Citizen-facing view (routes: /citizen and /citizen/:villageId).
 *
 * This is the only screen in the project that a person being evacuated will ever see, so it
 * is built to a different standard than the control room:
 *
 *   - PUBLIC. No login. A villager will never hold EOC credentials, and a warning behind an
 *     auth wall is not a warning.
 *   - HINDI FIRST. Hindi is the default language and English is the toggle, not the reverse.
 *   - THREE QUESTIONS ONLY: how bad is it, what do I do, where do I go. Everything the
 *     operator console shows about model internals is deliberately absent here.
 *   - THUMB-SIZED TARGETS and one column, because it will be read on a low-end phone held in
 *     one hand, possibly in the rain, possibly at night.
 *   - OFFLINE-TOLERANT. The service worker caches the shell, and the chosen village is kept
 *     in localStorage, so reopening the app on a dead network still shows the last known
 *     state with an explicit "you are offline" banner rather than an empty screen.
 *
 * The risk numbers come from the same live WebSocket feed as the dashboard (RiskDataContext),
 * so the village screen and the control room can never disagree about a village's level.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Search, ChevronRight, ArrowLeft, Phone, Footprints, ArrowUpRight,
  TriangleAlert, CloudRain, Droplets, Waves, Clock, WifiOff, Radio,
  Download, MapPin, CheckCircle2, ShieldAlert, RefreshCw,
} from 'lucide-react';
import { useRiskData } from '../context/RiskDataContext';
import { getEvacuationPlan, getVillage } from '../lib/api';
import { t, riskWord, feasibilityWord, factorWord } from '../lib/i18n';

const LANG_KEY = 'drainguard.citizen.lang';
const VILLAGE_KEY = 'drainguard.citizen.village';

// Emergency numbers are published state helplines, never personal contacts.
const HELPLINES = [
  { number: '1070', hi: 'राज्य आपदा नियंत्रण (उत्तराखंड)', en: 'State Disaster Control (Uttarakhand)' },
  { number: '1077', hi: 'जिला आपदा नियंत्रण कक्ष', en: 'District Disaster Control Room' },
  { number: '112', hi: 'आपातकालीन सेवा', en: 'Emergency services' },
];

const LEVEL_SKIN = {
  red: {
    card: 'border-rose-500/60 bg-gradient-to-b from-rose-600/25 to-rose-950/10',
    text: 'text-rose-200',
    bar: 'bg-rose-500',
    chip: 'bg-rose-500 text-white',
  },
  yellow: {
    card: 'border-amber-400/60 bg-gradient-to-b from-amber-500/20 to-amber-950/10',
    text: 'text-amber-200',
    bar: 'bg-amber-400',
    chip: 'bg-amber-400 text-[#3d2600]',
  },
  green: {
    card: 'border-emerald-500/50 bg-gradient-to-b from-emerald-600/15 to-emerald-950/10',
    text: 'text-emerald-200',
    bar: 'bg-emerald-400',
    chip: 'bg-emerald-400 text-[#04281a]',
  },
};

const skin = (level) => LEVEL_SKIN[level] || LEVEL_SKIN.green;

/** Language choice survives reloads -- nobody should have to re-pick Hindi every time. */
function useLang() {
  const [lang, setLang] = useState(() => {
    try {
      return window.localStorage.getItem(LANG_KEY) || 'hi';
    } catch {
      return 'hi';
    }
  });
  const change = useCallback((next) => {
    setLang(next);
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      // Private mode / storage disabled -- language just resets next visit.
    }
  }, []);
  return [lang, change];
}

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

/** Captures the browser's install prompt so the page can offer "add to home screen" itself. */
function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(null);
  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setPromptEvent(e);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);
  const install = useCallback(async () => {
    if (!promptEvent) return;
    promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  }, [promptEvent]);
  return [Boolean(promptEvent), install];
}

/** Lead time as a plain sentence. "2 घंटे 20 मिनट" reads better than "2.3 h" to a non-expert. */
function humanWindow(lang, hours) {
  const s = t(lang);
  if (hours == null || Number.isNaN(hours)) return '—';
  const total = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} ${s.minutes}`;
  if (m === 0) return `${h} ${s.hours}`;
  return `${h} ${s.hours} ${m} ${s.minutes}`;
}

function TopBar({ lang, setLang, wsConnected, online, canInstall, install, back }) {
  const s = t(lang);
  return (
    <header className="sticky top-0 z-20 border-b border-[#273647] bg-[#061625]/95 backdrop-blur">
      <div className="max-w-md mx-auto px-3 py-2.5 flex items-center gap-2">
        {back ? (
          <Link
            to="/citizen"
            aria-label={s.back}
            className="w-9 h-9 rounded-lg border border-[#273647] bg-[#071a2c] flex items-center justify-center shrink-0 active:scale-95 transition"
          >
            <ArrowLeft className="w-4 h-4 text-slate-300" />
          </Link>
        ) : (
          <div className="w-9 h-9 rounded-lg bg-[#122131] border border-[#273647] flex items-center justify-center shrink-0">
            <img src="/varun-vi-logo.png" alt="VARUN logo" className="w-full h-full rounded-lg object-contain p-1" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <span className="block text-[15px] font-black font-heading tracking-tight text-white leading-none">
            {s.appName}
          </span>
          <span className="block text-[10px] text-slate-500 leading-tight mt-0.5 truncate">
            {s.tagline}
          </span>
        </div>

        {canInstall && (
          <button
            onClick={install}
            aria-label={s.installApp}
            className="w-9 h-9 rounded-lg border border-cyan-500/40 bg-cyan-500/10 flex items-center justify-center shrink-0 active:scale-95 transition"
            title={s.installApp}
          >
            <Download className="w-4 h-4 text-cyan-300" />
          </button>
        )}

        {/* Language is a single tap, always visible, never buried in a menu. */}
        <div className="flex rounded-lg border border-[#273647] overflow-hidden shrink-0">
          <button
            onClick={() => setLang('hi')}
            className={`px-2.5 h-9 text-[12px] font-bold transition ${
              lang === 'hi' ? 'bg-[#ffb3ad] text-[#68000a]' : 'bg-[#071a2c] text-slate-400'
            }`}
          >
            हिं
          </button>
          <button
            onClick={() => setLang('en')}
            className={`px-2.5 h-9 text-[12px] font-bold transition ${
              lang === 'en' ? 'bg-[#ffb3ad] text-[#68000a]' : 'bg-[#071a2c] text-slate-400'
            }`}
          >
            EN
          </button>
        </div>
      </div>

      {/* Connection state is stated, not hidden -- stale data must look stale. */}
      {!online ? (
        <div className="bg-amber-500/15 border-t border-amber-500/30 px-3 py-1.5">
          <div className="max-w-md mx-auto flex items-center gap-1.5">
            <WifiOff className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span className="text-[11px] text-amber-100">{s.offline}</span>
          </div>
        </div>
      ) : (
        <div className="max-w-md mx-auto px-3 pb-1.5 flex items-center gap-1.5">
          <Radio
            className={`w-3 h-3 shrink-0 ${
              wsConnected ? 'text-emerald-400' : 'text-slate-500 animate-pulse'
            }`}
          />
          <span
            className={`text-[10px] ${wsConnected ? 'text-emerald-400/80' : 'text-slate-500'}`}
          >
            {wsConnected ? s.liveLabel : s.connecting}
          </span>
        </div>
      )}
    </header>
  );
}

/**
 * Set once per page load, after the remembered village has been opened automatically. Without
 * this flag, pressing Back from the village screen would silently bounce straight forward
 * again and the back button would look broken.
 */
let autoOpened = false;

function VillagePicker({ lang, villages, loading, loadError, onPick }) {
  const s = t(lang);
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? villages.filter((v) =>
          [v.name, v.district, v.state].some((f) => (f || '').toLowerCase().includes(q))
        )
      : villages;
    // Highest risk first: if any village in the list is in danger, it belongs at the top of a
    // screen someone is scrolling in a hurry.
    return [...list].sort((a, b) => (b.current_risk_score || 0) - (a.current_risk_score || 0));
  }, [villages, query]);

  return (
    <div className="max-w-md mx-auto px-3 py-4">
      <h2 className="text-lg font-bold text-white mb-1">{s.chooseVillage}</h2>
      <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
        {lang === 'hi'
          ? 'एक बार चुनने के बाद यह ऐप हर बार सीधे आपके गाँव की स्थिति दिखाएगा।'
          : 'Once chosen, the app will open straight to your village every time.'}
      </p>

      <div className="relative mb-3">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={s.searchPlaceholder}
          className="w-full h-11 bg-[#071a2c] border border-[#273647] rounded-lg pl-9 pr-3 text-[14px] text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60"
        />
      </div>

      {loading && villages.length === 0 && (
        <div className="rounded-lg border border-[#273647] bg-[#071a2c] p-4 text-center">
          <span className="text-[12px] text-slate-400">
            {lang === 'hi' ? 'गाँवों की सूची आ रही है…' : 'Loading villages…'}
          </span>
        </div>
      )}

      {loadError && villages.length === 0 && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 mb-3">
          <span className="text-[12px] text-rose-200">{loadError}</span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {matches.map((v) => {
          const sk = skin(v.current_risk_level);
          return (
            <button
              key={v.id}
              onClick={() => onPick(v.id)}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left active:scale-[0.99] transition ${
                v.current_risk_level === 'red'
                  ? 'border-rose-500/50 bg-rose-500/10'
                  : 'border-[#273647] bg-[#071a2c]'
              }`}
            >
              <span
                className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 font-black text-[15px] ${sk.chip}`}
              >
                {Math.round(v.current_risk_score || 0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-white truncate">
                  {v.name}
                </span>
                <span className="block text-[11px] text-slate-500 truncate">
                  {v.district} · {v.state}
                </span>
                <span className={`block text-[11px] font-semibold mt-0.5 ${sk.text}`}>
                  {riskWord(lang, v.current_risk_level)}
                </span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
            </button>
          );
        })}
        {!loading && matches.length === 0 && villages.length > 0 && (
          <div className="rounded-lg border border-[#273647] bg-[#071a2c] p-4 text-center">
            <span className="text-[12px] text-slate-400">
              {lang === 'hi' ? 'कोई गाँव नहीं मिला।' : 'No village matched.'}
            </span>
          </div>
        )}
      </div>

      {/* The operator console is not hidden, just clearly not for this audience. */}
      <Link
        to="/login"
        className="block text-center text-[10px] text-slate-600 hover:text-slate-400 mt-6 py-2"
      >
        {lang === 'hi' ? 'नियंत्रण कक्ष लॉगिन' : 'Control-room login'}
      </Link>
    </div>
  );
}

function SensorTile({ icon: Icon, label, value, unit, note, tone }) {
  return (
    <div className="rounded-lg border border-[#273647] bg-[#071a2c] p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 shrink-0 ${tone}`} />
        <span className="text-[10px] text-slate-500 leading-tight">{label}</span>
      </div>
      <span className="text-[16px] font-bold text-white leading-none">
        {value}
        <small className="text-[10px] text-slate-500 ml-1 font-normal">{unit}</small>
      </span>
      {note && <span className="block text-[9px] text-slate-500 mt-1 leading-tight">{note}</span>}
    </div>
  );
}

/** The one card that has to be right: which shelter, how long on foot, does the clock allow it. */
function ShelterCard({ lang, opt, primary, leadTimeHrs }) {
  const s = t(lang);
  const verdict = feasibilityWord(lang, opt.feasibility);
  const tone =
    opt.feasibility === 'feasible'
      ? 'text-emerald-300'
      : opt.feasibility === 'tight'
        ? 'text-amber-300'
        : 'text-rose-300';
  const usable = opt.usable_window_min ?? (leadTimeHrs != null ? leadTimeHrs * 60 * 0.7 : null);
  const margin = usable != null ? Math.round(usable - opt.walking_time_min) : null;
  // A shelter below the village is the wrong direction for a debris flow. The backend sinks
  // these to the bottom of the ranking and flags them; this card must not render the drop as
  // a bare "-145 m", which reads like a typo instead of a warning.
  const gain = Math.round(opt.elevation_gain_m);
  const below = opt.below_settlement ?? gain < 0;

  return (
    <div
      className={`rounded-lg border p-3 ${
        primary ? 'border-cyan-400/60 bg-cyan-500/10' : 'border-[#273647] bg-[#071a2c]'
      }`}
    >
      <div className="flex items-start gap-2 mb-2">
        <MapPin className={`w-4 h-4 shrink-0 mt-0.5 ${primary ? 'text-cyan-300' : 'text-slate-500'}`} />
        <div className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold text-white leading-tight">
            {opt.shelter_name}
          </span>
          <span className="block text-[10px] text-slate-500 mt-0.5">
            {(opt.shelter_type || '').replace(/_/g, ' ')} · {Math.round(opt.elevation_m)} m
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <div>
          <span className="block text-[9px] text-slate-500 mb-0.5">{s.walkTime}</span>
          <strong className="text-[15px] text-white">
            {Math.round(opt.walking_time_min)}
            <small className="text-[9px] text-slate-500 ml-0.5 font-normal">{s.minutes}</small>
          </strong>
        </div>
        <div>
          <span className="block text-[9px] text-slate-500 mb-0.5">{s.climb}</span>
          <strong className={`text-[15px] ${below ? 'text-rose-300' : 'text-white'}`}>
            {Math.abs(gain)}
            <small className="text-[9px] text-slate-500 ml-0.5 font-normal">
              m{below ? ` ${s.downhill}` : ''}
            </small>
          </strong>
        </div>
        <div>
          <span className="block text-[9px] text-slate-500 mb-0.5">{s.capacity}</span>
          <strong className="text-[15px] text-white">
            {opt.capacity}
            <small className="text-[9px] text-slate-500 ml-0.5 font-normal">{s.people}</small>
          </strong>
        </div>
      </div>

      {verdict && (
        <div className={`flex items-center gap-1.5 mb-2 ${tone}`}>
          {opt.feasibility === 'feasible' ? (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <TriangleAlert className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="text-[12px] font-semibold leading-tight">{verdict}</span>
          {margin != null && (
            <span className="text-[10px] text-slate-500 ml-auto shrink-0">
              {Math.abs(margin)} {margin >= 0 ? s.minSpare : s.minShort}
            </span>
          )}
        </div>
      )}

      {below && (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 mb-2">
          <span className="text-[11px] text-rose-200 leading-snug">{s.belowVillage}</span>
        </div>
      )}

      {opt.crosses_stream && (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 mb-2">
          <span className="text-[11px] text-rose-200 leading-snug">{s.crossesStream}</span>
        </div>
      )}

      <div className="flex gap-2">
        {opt.contact_phone && (
          <a
            href={`tel:${opt.contact_phone}`}
            className="flex-1 h-10 rounded-lg bg-[#0d2b3f] border border-cyan-500/40 flex items-center justify-center gap-1.5 active:scale-95 transition"
          >
            <Phone className="w-3.5 h-3.5 text-cyan-300" />
            <span className="text-[12px] font-semibold text-cyan-200">{opt.contact_phone}</span>
          </a>
        )}
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${opt.latitude},${opt.longitude}&travelmode=walking`}
          target="_blank"
          rel="noreferrer"
          className="flex-1 h-10 rounded-lg bg-[#071a2c] border border-[#273647] flex items-center justify-center gap-1.5 active:scale-95 transition"
        >
          <Footprints className="w-3.5 h-3.5 text-slate-300" />
          <span className="text-[12px] font-semibold text-slate-200">
            {lang === 'hi' ? 'रास्ता देखें' : 'Show route'}
          </span>
          <ArrowUpRight className="w-3 h-3 text-slate-500" />
        </a>
      </div>
    </div>
  );
}

export default function CitizenPage() {
  const { villageId } = useParams();
  const navigate = useNavigate();
  const [lang, setLang] = useLang();
  const online = useOnline();
  const [canInstall, install] = useInstallPrompt();
  const { villages, wsConnected, loading, loadError, lastUpdated, villageById } = useRiskData();

  const [coldVillage, setColdVillage] = useState(null);
  const [plan, setPlan] = useState(null);
  const [planError, setPlanError] = useState(null);

  const s = t(lang);
  const live = villageId ? villageById(villageId) : null;
  const village = live || (String(coldVillage?.id) === String(villageId) ? coldVillage : null);

  // Remember the choice so the home-screen icon opens straight onto this village next time.
  useEffect(() => {
    if (!villageId) return;
    try {
      window.localStorage.setItem(VILLAGE_KEY, String(villageId));
    } catch {
      // Storage unavailable -- the picker will simply be shown again next visit.
    }
  }, [villageId]);

  // Auto-open the remembered village, but only once per page load (see `autoOpened`).
  useEffect(() => {
    if (villageId || autoOpened || villages.length === 0) return;
    let saved = null;
    try {
      saved = window.localStorage.getItem(VILLAGE_KEY);
    } catch {
      saved = null;
    }
    if (saved && villages.some((v) => String(v.id) === saved)) {
      autoOpened = true;
      navigate(`/citizen/${saved}`, { replace: true });
    }
  }, [villageId, villages, navigate]);

  // A shared SMS link lands here with an empty village list for a moment; fetch that one
  // village directly so a cold deep link is not a blank screen.
  useEffect(() => {
    if (!villageId || live) return;
    const ctrl = new AbortController();
    getVillage(villageId, ctrl.signal)
      .then(setColdVillage)
      .catch(() => {
        // Offline or unknown id -- the render path below already states this plainly.
      });
    return () => ctrl.abort();
  }, [villageId, live]);

  // Evacuation options for this village. Re-costed on a slow cadence because the ranking only
  // moves when the lead time does.
  const loadPlan = useCallback(async (id, signal) => {
    if (!id) return;
    try {
      const data = await getEvacuationPlan(id, {}, signal);
      setPlan(data);
      setPlanError(null);
    } catch (err) {
      if (err.name !== 'AbortError') setPlanError(err.message);
    }
  }, []);

  useEffect(() => {
    if (!villageId) return;
    setPlan(null);
    setPlanError(null);
    const ctrl = new AbortController();
    loadPlan(villageId, ctrl.signal);
    const id = window.setInterval(() => loadPlan(villageId), 20000);
    return () => {
      ctrl.abort();
      window.clearInterval(id);
    };
  }, [villageId, loadPlan]);

  const pick = (id) => {
    autoOpened = true;
    navigate(`/citizen/${id}`);
  };

  const bar = (
    <TopBar
      lang={lang}
      setLang={setLang}
      wsConnected={wsConnected}
      online={online}
      canInstall={canInstall}
      install={install}
      back={Boolean(villageId)}
    />
  );

  // ---- Village picker ----
  if (!villageId) {
    return (
      <div className="min-h-screen bg-[#04101d] text-slate-100">
        {bar}
        <VillagePicker
          lang={lang}
          villages={villages}
          loading={loading}
          loadError={loadError}
          onPick={pick}
        />
      </div>
    );
  }

  // ---- Village not resolved yet (or not found) ----
  if (!village) {
    return (
      <div className="min-h-screen bg-[#04101d] text-slate-100">
        {bar}
        <div className="max-w-md mx-auto px-3 py-10 text-center">
          {loading || online ? (
            <span className="text-[13px] text-slate-400">
              {lang === 'hi' ? 'गाँव की जानकारी आ रही है…' : 'Loading your village…'}
            </span>
          ) : (
            <span className="text-[13px] text-amber-200">{s.offline}</span>
          )}
          <Link
            to="/citizen"
            onClick={() => {
              autoOpened = true;
            }}
            className="block mt-4 text-[12px] text-cyan-300"
          >
            {s.chooseVillage}
          </Link>
        </div>
      </div>
    );
  }

  const level = village.current_risk_level || 'green';
  const sk = skin(level);
  const steps = level === 'red' ? s.dangerSteps : level === 'yellow' ? s.watchSteps : s.safeSteps;
  const rec = plan?.recommended;
  const others = (plan?.options || []).filter((o) => o.shelter_id !== rec?.shelter_id).slice(0, 2);

  return (
    <div className="min-h-screen bg-[#04101d] text-slate-100 pb-8">
      {bar}

      <div className="max-w-md mx-auto px-3 py-3 flex flex-col gap-3">
        {/* ---- Which village, and a way out of it ---- */}
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <span className="block text-[10px] text-slate-500">{s.myVillage}</span>
            <h2 className="text-xl font-black font-heading text-white leading-tight truncate">
              {village.name}
            </h2>
            <span className="block text-[11px] text-slate-500 truncate">
              {village.district} · {village.state}
            </span>
          </div>
          <Link
            to="/citizen"
            onClick={() => {
              autoOpened = true;
            }}
            className="shrink-0 h-8 px-3 rounded-lg border border-[#273647] bg-[#071a2c] flex items-center text-[11px] text-slate-300 active:scale-95 transition"
          >
            {s.change}
          </Link>
        </div>

        {/* ---- The status card. One glance has to be enough. ---- */}
        <div className={`rounded-xl border p-4 ${sk.card}`}>
          <span className="block text-[11px] text-slate-400 mb-1">{s.riskNow}</span>
          <div className="flex items-end gap-3 mb-2">
            <span className={`text-4xl font-black font-heading leading-none ${sk.text}`}>
              {Math.round(village.current_risk_score || 0)}
            </span>
            <span className="text-[11px] text-slate-400 pb-1">{s.outOf}</span>
          </div>

          <div className="h-2 rounded-full bg-black/40 overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all duration-700 ${sk.bar}`}
              style={{ width: `${Math.min(100, village.current_risk_score || 0)}%` }}
            />
          </div>

          <div className="flex items-center gap-2">
            {level === 'red' ? (
              <ShieldAlert className="w-5 h-5 text-rose-300 shrink-0" />
            ) : level === 'yellow' ? (
              <TriangleAlert className="w-5 h-5 text-amber-300 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
            )}
            <span className={`text-[17px] font-bold leading-tight ${sk.text}`}>
              {riskWord(lang, level)}
            </span>
          </div>

          {village.latest_primary_factor && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <span className="block text-[10px] text-slate-400 mb-0.5">{s.cause}</span>
              <span className="text-[12px] text-slate-200 leading-snug">
                {factorWord(lang, village.latest_primary_factor)}
              </span>
            </div>
          )}
        </div>

        {/* ---- How long they have. Shown for watch and danger only; a green village has no
                meaningful countdown and a fake one would train people to ignore it. ---- */}
        {level !== 'green' && (
          <div className="rounded-xl border border-[#273647] bg-[#071a2c] p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-4 h-4 text-amber-300 shrink-0" />
              <span className="text-[11px] text-slate-400">{s.timeAvailable}</span>
            </div>
            <span className="text-2xl font-black font-heading text-amber-200 leading-none">
              {humanWindow(lang, village.current_lead_time_hrs)}
            </span>
            <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
              {lang === 'hi'
                ? 'यह अनुमान है, गारंटी नहीं। स्थिति तेज़ी से बदल सकती है — इंतज़ार न करें।'
                : 'This is an estimate, not a guarantee. Conditions can change faster — do not wait.'}
            </p>
          </div>
        )}

        {/* ---- What to do now ---- */}
        <div className="rounded-xl border border-[#273647] bg-[#071a2c] p-3">
          <span className="block text-[13px] font-bold text-white mb-2">{s.whatToDo}</span>
          <ol className="flex flex-col gap-2">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-2.5">
                <span
                  className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] font-black ${sk.chip}`}
                >
                  {i + 1}
                </span>
                <span className="text-[13px] text-slate-200 leading-snug">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* ---- Where to go ---- */}
        <div className="flex flex-col gap-2">
          <span className="block text-[13px] font-bold text-white">{s.whereToGo}</span>

          {planError && !plan && (
            <div className="rounded-lg border border-[#273647] bg-[#071a2c] p-3 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-[11px] text-slate-400">{planError}</span>
            </div>
          )}

          {!plan && !planError && (
            <div className="rounded-lg border border-[#273647] bg-[#071a2c] p-3">
              <span className="text-[11px] text-slate-500">
                {lang === 'hi' ? 'रास्ते की गणना हो रही है…' : 'Working out your route…'}
              </span>
            </div>
          )}

          {plan && !rec && (
            <div className="rounded-lg border border-[#273647] bg-[#071a2c] p-3">
              <span className="text-[12px] text-slate-300">{s.noShelter}</span>
            </div>
          )}

          {rec && (
            <ShelterCard
              lang={lang}
              opt={rec}
              primary
              leadTimeHrs={plan?.lead_time_hrs ?? village.current_lead_time_hrs}
            />
          )}

          {others.length > 0 && (
            <>
              <span className="block text-[11px] text-slate-500 mt-1">{s.otherShelters}</span>
              {others.map((o) => (
                <ShelterCard
                  key={o.shelter_id}
                  lang={lang}
                  opt={o}
                  leadTimeHrs={plan?.lead_time_hrs ?? village.current_lead_time_hrs}
                />
              ))}
            </>
          )}
        </div>

        {/* ---- The measurements behind the number, in plain words ---- */}
        <div>
          <span className="block text-[11px] text-slate-500 mb-1.5">
            {lang === 'hi' ? 'आपके गाँव के सेंसर' : 'Sensors in your village'}
          </span>
          <div className="grid grid-cols-3 gap-2">
            <SensorTile
              icon={CloudRain}
              label={s.rainfall}
              value={(village.latest_rainfall_mm ?? 0).toFixed(1)}
              unit="mm/h"
              tone="text-cyan-300"
              note={
                (village.latest_rainfall_mm ?? 0) > 45
                  ? lang === 'hi'
                    ? 'बादल फटने जैसी वर्षा'
                    : 'Cloudburst band'
                  : null
              }
            />
            <SensorTile
              icon={Droplets}
              label={s.soilWater}
              value={(village.latest_soil_moisture_pct ?? 0).toFixed(0)}
              unit="%"
              tone="text-emerald-300"
              note={
                (village.latest_soil_moisture_pct ?? 0) > 85
                  ? lang === 'hi'
                    ? 'ज़मीन भर चुकी है'
                    : 'Ground saturated'
                  : null
              }
            />
            <SensorTile
              icon={Waves}
              label={s.streamLevel}
              value={(village.latest_stream_level_m ?? 0).toFixed(2)}
              unit="m"
              tone="text-blue-300"
              note={
                (village.latest_stream_level_m ?? 0) > 2.5
                  ? lang === 'hi'
                    ? 'बाढ़ स्तर से ऊपर'
                    : 'Above flood stage'
                  : null
              }
            />
          </div>
          <span className="block text-[10px] text-slate-600 mt-1.5">
            {s.lastUpdate}:{' '}
            {village.latest_reading_time
              ? new Date(village.latest_reading_time).toLocaleString(
                  lang === 'hi' ? 'hi-IN' : 'en-IN'
                )
              : lastUpdated
                ? lastUpdated.toLocaleTimeString(lang === 'hi' ? 'hi-IN' : 'en-IN')
                : '—'}
          </span>
        </div>

        {/* ---- Calling for help must never be more than one tap away ---- */}
        <div className="rounded-xl border border-[#273647] bg-[#071a2c] p-3">
          <span className="block text-[13px] font-bold text-white mb-2">{s.callHelp}</span>
          <div className="flex flex-col gap-2">
            {HELPLINES.map((h) => (
              <a
                key={h.number}
                href={`tel:${h.number}`}
                className="flex items-center gap-2.5 h-12 rounded-lg border border-[#273647] bg-[#04101d] px-3 active:scale-[0.99] transition"
              >
                <Phone className="w-4 h-4 text-emerald-300 shrink-0" />
                <span className="text-[17px] font-black font-heading text-white w-14 shrink-0">
                  {h.number}
                </span>
                <span className="text-[11px] text-slate-400 leading-tight">
                  {lang === 'hi' ? h.hi : h.en}
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* ---- What this app is and is not ---- */}
        <p className="text-[10px] text-slate-600 leading-relaxed">
          {lang === 'hi'
            ? 'यह एक पूर्व-चेतावनी सहायक प्रणाली है। आधिकारिक निर्देश NDRF / SDMA / जिला प्रशासन के होते हैं — उनके आदेश का पालन करें। खतरे की स्थिति में इस स्क्रीन के इंतज़ार में न रुकें।'
            : 'This is an early-warning aid. Official instructions come from NDRF / SDMA / the district administration — follow their orders. In danger, do not wait for this screen to update.'}
        </p>
      </div>
    </div>
  );
}
