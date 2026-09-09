import React, { useEffect, useState } from 'react';
import { Zap, RotateCcw, CloudLightning } from 'lucide-react';
import { resetScenario, triggerStorm } from '../lib/api';

export default function StormControlPanel({ villages = [], onStormTriggered, onResetTriggered }) {
  const [targetVillageId, setTargetVillageId] = useState('');
  const [zone, setZone] = useState('red');
  const [loading, setLoading] = useState(false);
  const [activeStorm, setActiveStorm] = useState(false);
  const [message, setMessage] = useState('Choose a village and target zone for the next telemetry injection.');

  useEffect(() => {
    if (!targetVillageId && villages.length) {
      setTargetVillageId(String(villages[0].id));
    }
  }, [targetVillageId, villages]);

  const handleTriggerScenario = async () => {
    try {
      setLoading(true);
      const payload = {
        village_ids: targetVillageId ? [Number(targetVillageId)] : undefined,
        zone,
        intensity: zone === 'red' ? 'extreme' : zone === 'yellow' ? 'severe' : 'moderate',
        target_rainfall_rate_mm_hr: zone === 'red' ? 95.0 : zone === 'yellow' ? 35.0 : 0.2,
        target_soil_moisture_pct: zone === 'red' ? 92.0 : zone === 'yellow' ? 70.0 : 22.0,
      };
      await triggerStorm(payload);
      const target = villages.find((v) => String(v.id) === targetVillageId);
      setActiveStorm(zone === 'red');
      setMessage(`${target?.name || 'Selected village'} set to ${zone.toUpperCase()} zone.`);
      if (onStormTriggered) onStormTriggered();
    } catch (err) {
      console.error('Failed to trigger demo zone', err);
      setMessage(`Scenario failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      setLoading(true);
      await resetScenario();
      setActiveStorm(false);
      setMessage('All villages reset to the normal green baseline.');
      if (onResetTriggered) onResetTriggered();
    } catch (err) {
      console.error('Failed to reset scenario', err);
      setMessage(`Reset failed: ${err.message}`);
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
            Target one village at a time and demonstrate green, yellow, and red risk states through the real prediction pipeline.
          </p>
          <p className="text-[10px] text-cyan-300/80 mt-2">{message}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full md:w-auto md:min-w-[430px]">
          <select
            value={targetVillageId}
            onChange={(e) => setTargetVillageId(e.target.value)}
            disabled={loading || !villages.length}
            className="bg-disaster-dark border border-disaster-border text-xs rounded-lg px-2.5 py-1.5 text-gray-200 focus:outline-none sm:col-span-2"
            aria-label="Target village"
          >
            {!villages.length && <option value="">Loading villages...</option>}
            {villages.map((village) => (
              <option key={village.id} value={village.id}>{village.name}</option>
            ))}
          </select>

          <select
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            disabled={loading}
            className="bg-disaster-dark border border-disaster-border text-xs rounded-lg px-2.5 py-1.5 text-gray-200 focus:outline-none"
            aria-label="Target risk zone"
          >
            <option value="green">Green zone / normal</option>
            <option value="yellow">Yellow zone / watch</option>
            <option value="red">Red zone / evacuation</option>
          </select>

          <button
            onClick={handleTriggerScenario}
            disabled={loading || !targetVillageId}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950 transition active:scale-95 disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Apply Zone</span>
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
