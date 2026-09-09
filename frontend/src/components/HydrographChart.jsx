/**
 * Live hydrograph driven by GET /api/villages/{id}/history.
 *
 * This replaces the two hand-drawn <path d="M0 104 C80 99 ..."> SVG curves that used to sit
 * in the dashboard. Those were fixed bezier decorations: they showed the same "rising storm"
 * shape whether the catchment was bone dry or already red, which made the most quantitative
 * looking panel on the screen the only one that was not measuring anything.
 *
 * Every point below is a stored Reading joined to the RiskScore the engine produced for it.
 * The two dashed reference lines are the engine's own published co-trigger thresholds from
 * ml/prediction_engine.py -- risk >= 70 (red) and soil moisture > 85% -- so the chart shows
 * how close the catchment is to the rule that will actually fire, not a decorative guide.
 */

import { useEffect, useState, useRef } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { Activity, WifiOff } from 'lucide-react';
import { getVillageHistory } from '../lib/api';

const RED_THRESHOLD = 70;
const SOIL_CO_TRIGGER = 85;

export default function HydrographChart({
  villageId,
  limit = 60,
  height = 150,
  pollMs = 5000,
  title = 'Hydrograph — rainfall vs soil saturation vs fused risk',
  compact = false,
}) {
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const acRef = useRef(null);

  useEffect(() => {
    if (!villageId) return undefined;
    let cancelled = false;

    const fetchHistory = async () => {
      acRef.current?.abort();
      const ac = new AbortController();
      acRef.current = ac;
      try {
        const data = await getVillageHistory(villageId, limit, ac.signal);
        if (cancelled) return;
        setHistory(data.history || []);
        setError(null);
      } catch (err) {
        if (cancelled || err.name === 'AbortError') return;
        setError(err.message || 'History unavailable');
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };

    fetchHistory();
    const id = window.setInterval(fetchHistory, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      acRef.current?.abort();
    };
  }, [villageId, limit, pollMs]);

  const hasData = history.length > 1;

  return (
    <div className="hydrograph-live">
      <div className="hydrograph-live-head">
        <span className="flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-cyan-300" />
          {title}
        </span>
        <span className="hydrograph-live-legend">
          <b className="lg-cyan" /> Rain mm/h
          <b className="lg-amber" /> Soil %
          <b className="lg-rose" /> Risk
        </span>
      </div>

      {!hasData ? (
        <div
          className="flex flex-col items-center justify-center gap-1.5 text-center"
          style={{ height }}
        >
          {error ? (
            <>
              <WifiOff className="w-4 h-4 text-rose-400" />
              <span className="telemetry text-[9px] uppercase tracking-wider text-rose-300">
                {error}
              </span>
            </>
          ) : (
            <span className="telemetry text-[9px] uppercase tracking-wider text-slate-500">
              {loaded
                ? 'No stored readings yet for this node — start the simulator to build the series'
                : 'Loading telemetry history…'}
            </span>
          )}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={history} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="rainFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 4" stroke="#1d2c3f" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="#5b6b80"
              tick={{ fontSize: 8, fontFamily: 'JetBrains Mono, monospace' }}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              yAxisId="mm"
              stroke="#22d3ee"
              tick={{ fontSize: 8, fontFamily: 'JetBrains Mono, monospace' }}
              domain={[0, 'auto']}
              width={34}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              stroke="#f59e0b"
              tick={{ fontSize: 8, fontFamily: 'JetBrains Mono, monospace' }}
              domain={[0, 100]}
              width={26}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#04121f',
                border: '1px solid #273647',
                borderRadius: 4,
                fontSize: 10,
                fontFamily: 'JetBrains Mono, monospace',
              }}
              labelStyle={{ color: '#67e8f9' }}
              formatter={(value, name) => [typeof value === 'number' ? value.toFixed(2) : value, name]}
            />

            {/* Engine thresholds, not cosmetic gridlines. */}
            <ReferenceLine
              yAxisId="pct"
              y={RED_THRESHOLD}
              stroke="#ef4444"
              strokeDasharray="5 3"
              strokeWidth={1}
              label={
                compact
                  ? undefined
                  : { value: 'RED 70', position: 'right', fill: '#ef4444', fontSize: 7 }
              }
            />
            <ReferenceLine
              yAxisId="pct"
              y={SOIL_CO_TRIGGER}
              stroke="#f59e0b"
              strokeDasharray="2 4"
              strokeWidth={1}
              label={
                compact
                  ? undefined
                  : { value: 'SOIL 85', position: 'right', fill: '#f59e0b', fontSize: 7 }
              }
            />

            <Area
              yAxisId="mm"
              type="monotone"
              dataKey="rainfall_mm"
              name="Rain mm/h"
              stroke="#22d3ee"
              strokeWidth={1.8}
              fill="url(#rainFill)"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="soil_moisture_pct"
              name="Soil %"
              stroke="#f59e0b"
              strokeWidth={1.8}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="risk_score"
              name="Fused risk"
              stroke="#f43f5e"
              strokeWidth={2.2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {hasData && (
        <div className="hydrograph-live-foot">
          <span>{history[0].time}</span>
          <span>{history.length} stored readings</span>
          <strong>NOW · {history[history.length - 1].time}</strong>
        </div>
      )}
    </div>
  );
}
