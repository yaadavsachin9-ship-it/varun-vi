import React, { useState } from 'react';
import { Zap, RotateCcw, CloudLightning, ShieldAlert, Play, Check } from 'lucide-react';

const API_BASE = "http://localhost:8000/api";

export default function StormControlPanel({ onStormTriggered, onResetTriggered }) {
  const [intensity, setIntensity] = useState('extreme');
  const [loading, setLoading] = useState(false);
  const [activeStorm, setActiveStorm] = useState(false);

  const handleTriggerStorm = async () => {
    try {
      setLoading(true);
      const resp = await fetch(`${API_BASE}/demo/storm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intensity: intensity,
          target_rainfall_rate_mm_hr: intensity === 'extreme' ? 95.0 : intensity === 'severe' ? 65.0 : 40.0,
          target_soil_moisture_pct: intensity === 'extreme' ? 92.0 : intensity === 'severe' ? 82.0 : 70.0
        })
      });
      if (resp.ok) {
        setActiveStorm(true);
        if (onStormTriggered) onStormTriggered();
      }
    } catch (err) {
      console.error("Failed to trigger storm scenario", err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      setLoading(true);
      const resp = await fetch(`${API_BASE}/demo/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (resp.ok) {
        setActiveStorm(false);
        if (onResetTriggered) onResetTriggered();
      }
    } catch (err) {
      console.error("Failed to reset scenario", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`rounded-md p-4 transition-all duration-300 ${
      activeStorm 
        ? 'glass-panel-glow-red border-rose-500/60' 
        : 'glass-panel border-disaster-border'
    }`}>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Left info */}
        <div>
          <div className="flex items-center gap-2">
            <CloudLightning className={`w-5 h-5 ${activeStorm ? 'text-rose-400 animate-bounce' : 'text-amber-400'}`} />
            <h3 className="text-sm font-bold font-heading text-white">
              Scenario control / cloudburst simulation
            </h3>
            {activeStorm && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                STORM ACTIVE
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Escalate precipitation and soil saturation live in &lt;5 seconds to demonstrate real-time risk escalation and early warning dispatch.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={intensity}
            onChange={(e) => setIntensity(e.target.value)}
            disabled={loading}
            className="bg-disaster-dark border border-disaster-border text-xs rounded-lg px-2.5 py-1.5 text-gray-200 focus:outline-none"
          >
            <option value="moderate">Moderate Storm (40 mm/h)</option>
            <option value="severe">Severe Cloudburst (65 mm/h)</option>
            <option value="extreme">Extreme 2021-Scale Event (95 mm/h)</option>
          </select>

          <button
            onClick={handleTriggerStorm}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950 transition active:scale-95 disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Trigger Storm Scenario</span>
          </button>

          <button
            onClick={handleReset}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-disaster-card hover:bg-disaster-border text-gray-300 text-xs font-medium border border-disaster-border transition disabled:opacity-50"
            title="Reset telemetry to normal baseline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
}
