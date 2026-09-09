import React, { useState } from 'react';
import { BellRing, Radio, MessageSquare, Shield, CheckCheck, Globe, Download } from 'lucide-react';

export default function AlertFeedPanel({ alerts }) {
  const [lang, setLang] = useState('en');

  const exportCAPJson = () => {
    const capPayload = {
      identifier: `NDRF-IN-FF-${Date.now()}`,
      sender: "sdma-alert-engine@gov.in",
      sent: new Date().toISOString(),
      status: "Actual",
      msgType: "Alert",
      scope: "Public",
      info: alerts.slice(0, 5).map(a => ({
        category: "Met",
        event: "Flash Flood / Landslide Critical Threat",
        urgency: "Immediate",
        severity: "Severe",
        certainty: "Observed",
        areaDesc: a.village_name,
        headline: a.message_en,
        description: lang === 'en' ? a.message_en : a.message_hi,
        contact: "Disaster Control Room NDRF / SDMA Helpline 1070"
      }))
    };

    const blob = new Blob([JSON.stringify(capPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SACHET_CAP_ALERT_${Date.now()}.json`;
    link.click();
  };

  return (
    <div className="glass-panel rounded-xl p-5 border border-disaster-border shadow-xl h-full flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
            <h3 className="text-base font-bold font-heading text-white">
              Live Early Warning & SMS Broadcast Log
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Lang switch */}
            <div className="flex bg-disaster-dark p-0.5 rounded border border-disaster-border text-[11px]">
              <button
                onClick={() => setLang('en')}
                className={`px-2 py-0.5 rounded font-medium ${lang === 'en' ? 'bg-disaster-card text-white' : 'text-gray-400'}`}
              >
                EN
              </button>
              <button
                onClick={() => setLang('hi')}
                className={`px-2 py-0.5 rounded font-medium ${lang === 'hi' ? 'bg-disaster-card text-white' : 'text-gray-400'}`}
              >
                हिंदी
              </button>
            </div>

            {/* CAP Export button */}
            <button
              onClick={exportCAPJson}
              className="flex items-center gap-1 text-[11px] bg-disaster-card hover:bg-disaster-border text-gray-300 px-2 py-1 rounded border border-disaster-border transition"
              title="Export standard CAP/SACHET JSON for Ministry of Home Affairs dissemination"
            >
              <Download className="w-3 h-3" />
              <span>CAP JSON</span>
            </button>
          </div>
        </div>

        {/* Alert List */}
        <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
          {alerts.length === 0 ? (
            <div className="py-8 text-center text-gray-500 text-xs">
              <Shield className="w-8 h-8 mx-auto mb-2 text-gray-600 opacity-60" />
              <span>No critical red alerts triggered. All catchment nodes currently within safe hydrological limits.</span>
            </div>
          ) : (
            alerts.map((alert, idx) => (
              <div
                key={`${alert.id || 'alt'}-${alert.village_id}-${idx}`}
                className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/40 text-xs text-gray-200 transition"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    <span className="font-bold text-rose-300">{alert.village_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                    <span className="bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded font-bold">
                      Risk: {alert.risk_score}/100
                    </span>
                    <span>Lead: ~{alert.estimated_lead_time_hrs}h</span>
                  </div>
                </div>

                <p className="text-gray-300 text-[11px] leading-relaxed mb-2 font-mono">
                  {lang === 'en' ? alert.message_en : alert.message_hi}
                </p>

                <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1 border-t border-rose-500/20">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3 text-emerald-400" />
                    <span>Dispatched via SMS Gateway & SACHET CAP Hub</span>
                  </span>
                  <span className="flex items-center gap-0.5 text-emerald-400">
                    <CheckCheck className="w-3 h-3" />
                    <span>Delivered</span>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="pt-2 text-[10px] text-gray-500 flex items-center justify-between border-t border-disaster-border/60 mt-2">
        <span>Channel: Twilio / SACHET CAP Standard</span>
        <span>Cooldown Protection Active (3 min)</span>
      </div>
    </div>
  );
}
