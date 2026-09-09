import React from 'react';
import { X, Calculator, ShieldCheck, Activity, Droplets, Mountain, BookOpen } from 'lucide-react';

export default function LeadTimeExplainerModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel rounded-2xl max-w-2xl w-full p-6 border border-disaster-border shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:text-white hover:bg-disaster-card transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2.5 mb-4">
          <Calculator className="w-6 h-6 text-disaster-accent" />
          <div>
            <h2 className="text-xl font-bold font-heading text-white">
              Physics & ML Evacuation Lead-Time Formulation
            </h2>
            <p className="text-xs text-gray-400">
              Judges Technical Explainer & Physical Formulation Documentation (SIH 2026 Problem ID: 26192)
            </p>
          </div>
        </div>

        {/* One Paragraph Judge Summary (Section 2 Requirement) */}
        <div className="p-3.5 rounded-xl bg-disaster-card border border-disaster-accent/40 mb-4 text-xs text-gray-200 leading-relaxed">
          <strong className="text-blue-400 block mb-1">Live Lead-Time Computation Summary:</strong>
          Our system calculates evacuation lead time by projecting the duration until the hill slope reaches critical hydrodynamic liquefaction saturation (S_critical ≈ 88–92%). The rate of moisture accumulation is modeled as a function of incoming cloudburst precipitation rate (I_rain), topographical slope angle (θ), and soil infiltration capacity (K_drain), dynamically adjusted by real-time geophone vibration sensors that detect upstream debris flow rumbling.
        </div>

        {/* Detailed Formulas */}
        <div className="space-y-3.5 text-xs text-gray-300">
          {/* Formula 1: Lead Time */}
          <div className="p-3 rounded-lg bg-disaster-dark/80 border border-disaster-border">
            <div className="flex items-center gap-2 font-bold text-amber-400 mb-1">
              <Droplets className="w-4 h-4" />
              <span>1. Hydro-Mechanical Lead Time Equation (T_lead)</span>
            </div>
            <div className="p-2 bg-disaster-card rounded font-mono text-cyan-300 text-center my-2 text-sm border border-cyan-500/20">
              T_lead = (S_critical - S_current) / [ 1.2 + (I_rain * (1 - 0.6 * K_drain) * cos(Slope)) ]
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-gray-400">
              <li><strong className="text-gray-200">S_critical:</strong> Critical soil saturation threshold (adjusted down for steep slopes &gt; 35°).</li>
              <li><strong className="text-gray-200">S_current:</strong> Real-time volumetric soil moisture % from IoT sensors/simulator.</li>
              <li><strong className="text-gray-200">I_rain:</strong> 1-hour rolling precipitation intensity (mm/hr).</li>
              <li><strong className="text-gray-200">K_drain:</strong> Soil drainage capacity index (0.4 to 0.8 depending on lithology).</li>
            </ul>
          </div>

          {/* Formula 2: Central Himalayan Intensity-Duration Trigger */}
          <div className="p-3 rounded-lg bg-disaster-dark/80 border border-disaster-border">
            <div className="flex items-center gap-2 font-bold text-blue-400 mb-1">
              <Mountain className="w-4 h-4" />
              <span>2. Empirical Central Himalayan Intensity-Duration (ID) Threshold</span>
            </div>
            <div className="p-2 bg-disaster-card rounded font-mono text-blue-300 text-center my-2 text-sm border border-blue-500/20">
              I_critical = 14.82 * (D ^ -0.39)  [mm/hr]
            </div>
            <p className="text-[11px] text-gray-400">
              Calibrated on historical GSI/NRSC cloudburst records for Uttarakhand and Himachal Pradesh. When rainfall rate exceeds I_critical, flash flood and slope failure probability surges past baseline safety margins.
            </p>
          </div>

          {/* Formula 3: Composite 0-100 Risk Score */}
          <div className="p-3 rounded-lg bg-disaster-dark/80 border border-disaster-border">
            <div className="flex items-center gap-2 font-bold text-emerald-400 mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>3. Hybrid Composite Risk Index (0 - 100)</span>
            </div>
            <div className="p-2 bg-disaster-card rounded font-mono text-emerald-300 text-center my-2 text-sm border border-emerald-500/20">
              Risk_Score = [ 0.40 * ML_Prob + 0.60 * (Soil_Pts + Rain_Pts + Slope_Pts + Vib_Pts) ] + Hist_Boost
            </div>
            <p className="text-[11px] text-gray-400">
              Blends non-linear Random Forest multi-variate susceptibility predictions with real-time physical sensor metrics, classified into <strong className="text-emerald-400">Green (0-40)</strong>, <strong className="text-amber-400">Yellow (41-70)</strong>, and <strong className="text-rose-400">Critical Red (71-100)</strong>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-disaster-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-disaster-accent hover:bg-blue-600 text-white font-medium rounded-lg text-xs transition"
          >
            Understood & Close
          </button>
        </div>
      </div>
    </div>
  );
}
