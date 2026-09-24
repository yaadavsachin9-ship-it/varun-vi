import React, { useEffect, useState } from 'react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, 
  Tooltip, CartesianGrid, Legend, AreaChart, Area 
} from 'recharts';
import { 
  Clock, CloudRain, Activity, Droplets, Mountain, 
  AlertOctagon, CheckCircle2, AlertTriangle, ShieldCheck, Info 
} from 'lucide-react';

const API_BASE = "http://localhost:8000/api";

export default function VillageDetailPanel({ village, onOpenExplainer }) {
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!village) return;
    
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const resp = await fetch(`${API_BASE}/villages/${village.id}/history?limit=30`);
        if (resp.ok) {
          const data = await resp.json();
          setHistoryData(data.history || []);
        }
      } catch (err) {
        console.error("Failed to fetch village history", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
    const interval = setInterval(fetchHistory, 4000);
    return () => clearInterval(interval);
  }, [village]);

  if (!village) {
    return (
      <div className="glass-panel rounded-xl p-8 flex flex-col items-center justify-center text-center h-[520px]">
        <Mountain className="w-12 h-12 text-gray-500 mb-3 animate-pulse-slow" />
        <h3 className="text-lg font-semibold text-gray-300">Select a Village Node</h3>
        <p className="text-xs text-gray-500 max-w-xs mt-1">
          Click any village polygon on the map or select from the authority ranking table to view real-time hydro-meteorological telemetry and forecast charts.
        </p>
      </div>
    );
  }

  const isRed = village.current_risk_level === 'red';
  const isYellow = village.current_risk_level === 'yellow';

  const riskBadgeColor = isRed 
    ? 'bg-rose-500/20 text-rose-400 border-rose-500/50'
    : isYellow
    ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';

  return (
    <div className={`glass-panel rounded-xl p-5 border flex flex-col justify-between h-[520px] transition-all duration-300 ${isRed ? 'border-rose-500/60 shadow-xl shadow-rose-950/40' : 'border-disaster-border'}`}>
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-heading text-white">{village.name}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${riskBadgeColor}`}>
                {village.current_risk_level}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {village.district} District, {village.state} • Elev: {village.elevation_m}m • Slope: {village.avg_slope_deg}°
            </p>
          </div>

          <button
            onClick={onOpenExplainer}
            className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-2.5 py-1 rounded-lg transition"
            title="How Lead Time and Risk are Calculated"
          >
            <Info className="w-3.5 h-3.5" />
            <span>Formula</span>
          </button>
        </div>

        {/* Vital Score Cards */}
        <div className="grid grid-cols-3 gap-2.5 mb-3">
          {/* Risk Score */}
          <div className="bg-disaster-card/80 border border-disaster-border p-2.5 rounded-lg">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block mb-0.5">Composite Risk</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-extrabold font-heading ${isRed ? 'text-rose-500' : isYellow ? 'text-amber-400' : 'text-emerald-400'}`}>
                {village.current_risk_score}
              </span>
              <span className="text-xs text-gray-500 font-semibold">/100</span>
            </div>
          </div>

          {/* Lead Time */}
          <div className="bg-disaster-card/80 border border-disaster-border p-2.5 rounded-lg">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block mb-0.5">Evac Lead Time</span>
            <div className="flex items-baseline gap-1">
              <Clock className="w-4 h-4 text-amber-400 inline" />
              <span className="text-2xl font-extrabold font-heading text-amber-300">
                {village.current_lead_time_hrs}
              </span>
              <span className="text-xs text-gray-400 font-medium">hrs</span>
            </div>
          </div>

          {/* Infiltration & Soil Moisture */}
          <div className="bg-disaster-card/80 border border-disaster-border p-2.5 rounded-lg">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block mb-0.5">Soil Saturation</span>
            <div className="flex items-baseline gap-1">
              <Droplets className="w-4 h-4 text-emerald-400 inline" />
              <span className="text-2xl font-extrabold font-heading text-emerald-300">
                {village.latest_soil_moisture_pct}%
              </span>
            </div>
          </div>
        </div>

        {/* Real-time Dynamic Telemetry Bar */}
        <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-disaster-dark/60 rounded-lg border border-disaster-border/60 text-xs mb-3">
          <div>
            <span className="text-gray-400 block text-[10px]">Precipitation Rate</span>
            <span className="font-semibold text-blue-400">{village.latest_rainfall_mm} mm/h</span>
          </div>
          <div>
            <span className="text-gray-400 block text-[10px]">Geophone Vibration</span>
            <span className="font-semibold text-purple-400">{village.latest_vibration_index} index</span>
          </div>
          <div>
            <span className="text-gray-400 block text-[10px]">Stream Stage</span>
            <span className="font-semibold text-cyan-400">{village.latest_stream_level_m} m</span>
          </div>
        </div>
      </div>

      {/* Recharts Live Dual Axis Trend Chart */}
      <div className="flex-1 w-full min-h-[160px] bg-disaster-dark/50 rounded-lg p-2 border border-disaster-border/40">
        <span className="text-[10px] font-semibold text-gray-400 block mb-1">
          Sensor Telemetry Stream (Past Readings)
        </span>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={historyData.length > 0 ? historyData : [
            { time: '00:00', rainfall_mm: village.latest_rainfall_mm, soil_moisture_pct: village.latest_soil_moisture_pct, risk_score: village.current_risk_score }
          ]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#164E63" strokeOpacity={0.5} />
            <XAxis dataKey="time" stroke="#94A3B8" strokeOpacity={0.6} tick={{ fontSize: 9, fill: '#94A3B8' }} />
            <YAxis yAxisId="left" stroke="#06B6D4" tick={{ fontSize: 9, fill: '#06B6D4' }} domain={[0, 'auto']} />
            <YAxis yAxisId="right" orientation="right" stroke="#10B981" tick={{ fontSize: 9, fill: '#10B981' }} domain={[0, 100]} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#071F30', borderColor: '#164E63', color: '#F8FAFC', fontSize: '11px', borderRadius: '4px' }}
            />
            <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />
            <Line yAxisId="left" type="monotone" dataKey="rainfall_mm" name="Rain (mm/h)" stroke="#06B6D4" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="soil_moisture_pct" name="Soil Moisture (%)" stroke="#10B981" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="risk_score" name="Risk Score" stroke="#EF4444" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Primary Trigger Note Footer */}
      <div className="mt-2 text-[11px] text-gray-400 flex items-center justify-between">
        <div className="flex items-center gap-1.5 truncate">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate"><strong>Dominant Factor:</strong> {village.latest_primary_factor}</span>
        </div>
        <span className="text-[10px] text-gray-500 whitespace-nowrap ml-2">Hist Incidents: {village.historical_incident_count}</span>
      </div>
    </div>
  );
}
