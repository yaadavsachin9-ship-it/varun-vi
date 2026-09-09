import React, { useState } from 'react';
import { ShieldAlert, ArrowUpDown, ChevronRight, Filter, Search, Download } from 'lucide-react';

export default function AuthorityTableView({ villages, selectedVillage, onSelectVillage }) {
  const [filterLevel, setFilterLevel] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('current_risk_score');
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = villages
    .filter(v => {
      if (filterLevel !== 'all' && v.current_risk_level?.toLowerCase() !== filterLevel) return false;
      if (searchTerm && !v.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const valA = a[sortField] || 0;
      const valB = b[sortField] || 0;
      return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const getBadge = (level) => {
    switch (level?.toLowerCase()) {
      case 'red':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">CRITICAL RED</span>;
      case 'yellow':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">WARNING</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">NORMAL</span>;
    }
  };

  return (
    <div className="glass-panel rounded-xl p-5 border border-disaster-border shadow-xl">
      {/* Table Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-disaster-accent" />
            <h3 className="text-lg font-bold font-heading text-white">
              NDRF / SDMA Disaster Authority Priority Grid
            </h3>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Real-time multi-criteria risk sorting across all monitored Himalayan catchment nodes.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search village..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-disaster-card border border-disaster-border text-xs rounded-lg pl-8 pr-2.5 py-1.5 text-gray-200 focus:outline-none focus:border-disaster-accent"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center bg-disaster-dark p-1 rounded-lg border border-disaster-border text-xs">
            {['all', 'red', 'yellow', 'green'].map(lvl => (
              <button
                key={lvl}
                onClick={() => setFilterLevel(lvl)}
                className={`px-2.5 py-1 rounded-md capitalize font-medium transition ${
                  filterLevel === lvl 
                    ? 'bg-disaster-card text-white shadow-sm border border-gray-700' 
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto rounded-lg border border-disaster-border/60">
        <table className="w-full text-left text-xs">
          <thead className="bg-disaster-dark/80 text-gray-400 uppercase text-[10px] tracking-wider border-b border-disaster-border">
            <tr>
              <th className="py-2.5 px-3">Village Node</th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('current_risk_score')}>
                <div className="flex items-center gap-1">
                  <span>Risk Score</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('current_lead_time_hrs')}>
                <div className="flex items-center gap-1">
                  <span>Lead Time</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('latest_rainfall_mm')}>
                <div className="flex items-center gap-1">
                  <span>Rain Rate</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('latest_soil_moisture_pct')}>
                <div className="flex items-center gap-1">
                  <span>Soil Moisture</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3">Slope / Elev</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-disaster-border/40 bg-disaster-card/40">
            {filtered.map((v) => {
              const isSelected = selectedVillage?.id === v.id;
              const isRed = v.current_risk_level === 'red';

              return (
                <tr 
                  key={v.id}
                  onClick={() => onSelectVillage(v)}
                  className={`hover:bg-disaster-border/40 cursor-pointer transition ${
                    isSelected ? 'bg-disaster-border/60' : ''
                  } ${isRed ? 'bg-rose-950/20' : ''}`}
                >
                  <td className="py-2.5 px-3 font-semibold text-gray-200">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        isRed ? 'bg-rose-500 animate-ping' : v.current_risk_level === 'yellow' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />
                      <span>{v.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`font-extrabold text-sm ${
                      isRed ? 'text-rose-400' : v.current_risk_level === 'yellow' ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {v.current_risk_score}
                    </span>
                    <span className="text-[10px] text-gray-500">/100</span>
                  </td>
                  <td className="py-2.5 px-3">
                    {getBadge(v.current_risk_level)}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-amber-300">
                    ~{v.current_lead_time_hrs} hrs
                  </td>
                  <td className="py-2.5 px-3 text-blue-400 font-medium">
                    {v.latest_rainfall_mm} mm/h
                  </td>
                  <td className="py-2.5 px-3 text-emerald-400 font-medium">
                    {v.latest_soil_moisture_pct}%
                  </td>
                  <td className="py-2.5 px-3 text-gray-400 text-[11px]">
                    {v.avg_slope_deg}° • {v.elevation_m}m
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectVillage(v);
                      }}
                      className="p-1 rounded bg-disaster-border/60 hover:bg-disaster-accent text-gray-300 hover:text-white transition"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
