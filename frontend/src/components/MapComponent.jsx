import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, Polyline, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ShieldAlert, AlertTriangle, CheckCircle, Waves, Mountain, Globe2 } from 'lucide-react';

// Custom Map center reposition helper
function SetMapView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && (map.getCenter().lat !== center[0] || map.getCenter().lng !== center[1] || map.getZoom() !== zoom)) {
      map.setView(center, zoom);
    }
  }, [center?.[0], center?.[1], zoom, map]);
  return null;
}

const getRiskColor = (level) => {
  switch (level?.toLowerCase()) {
    case 'red':
      return '#ef4444';
    case 'yellow':
      return '#f59e0b';
    case 'green':
    default:
      return '#10b981';
  }
};

// Route colour by feasibility verdict from backend/evacuation.py -- the map should make an
// unreachable shelter look unreachable, not just render every route the same shade.
const FEASIBILITY_COLOR = {
  feasible: '#34d399',
  tight: '#fbbf24',
  not_feasible_on_foot: '#f43f5e',
  unknown: '#94a3b8',
};

const SHELTER_ICON = L.divIcon({
  className: 'custom-shelter-pin',
  html: `
    <div style="width: 18px; height: 18px; border-radius: 3px; background: #04121f; border: 2px solid #34d399; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 8px #34d39999;">
      <span style="font-size: 9px; line-height: 1; color: #34d399; font-weight: 800;">S</span>
    </div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});


const createCustomMarkerIcon = (riskLevel, score, isNepal) => {
  const color = getRiskColor(riskLevel);
  const pulseClass = riskLevel === 'red' ? 'animate-ping' : '';

  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center;">
        ${riskLevel === 'red' ? `<div style="position: absolute; width: 28px; height: 28px; border-radius: 50%; background: ${color}; opacity: 0.4;" class="${pulseClass}"></div>` : ''}
        <div style="width: 24px; height: 24px; border-radius: 50%; background: #111827; border: 2.5px solid ${color}; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px ${color}99; font-weight: 800; font-size: 10px; color: ${color};">
          ${Math.round(score || 0)}
        </div>
        ${isNepal ? `<div style="position: absolute; top: -6px; right: -6px; font-size: 9px; line-height: 1;">🇳🇵</div>` : ''}
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });
};

export default function MapComponent({
  villages,
  selectedVillage,
  onSelectVillage,
  onOpenVillage,
  shelters = [],
  routes = [],
  heightClass = 'h-[520px]',
}) {
  // Region Presets
  const [activeRegion, setActiveRegion] = useState('all');

  // Center coordinate presets
  const regionCoords = {
    all: { center: [29.35, 82.20], zoom: 7 },
    india: { center: [30.55, 79.56], zoom: 11 },
    nepal: { center: [28.60, 83.20], zoom: 8 }
  };

  const mapCenter = selectedVillage
    ? [selectedVillage.latitude, selectedVillage.longitude]
    : regionCoords[activeRegion].center;

  const mapZoom = selectedVillage
    ? 12
    : regionCoords[activeRegion].zoom;

  const handleRegionSwitch = (regionKey) => {
    setActiveRegion(regionKey);
    // If selecting a region, clear selection so camera pans to region center
    if (selectedVillage) {
      onSelectVillage(null);
    }
  };

  return (
    <div className={`relative w-full ${heightClass} rounded-xl overflow-hidden glass-panel border border-disaster-border shadow-2xl`}>
      {/* Top Left: Risk Legend HUD */}
      <div className="absolute top-4 left-4 z-[1000] glass-panel px-3 py-1.5 rounded-lg text-xs flex items-center gap-3">
        <div className="flex items-center gap-1 text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500"></span>
          <span className="text-[11px]">Normal (&lt;40)</span>
        </div>
        <div className="flex items-center gap-1 text-amber-400">
          <span className="w-2 h-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500"></span>
          <span className="text-[11px]">Moderate (40-70)</span>
        </div>
        <div className="flex items-center gap-1 text-rose-400">
          <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500 animate-pulse"></span>
          <span className="text-[11px]">Critical Red (&gt;70)</span>
        </div>
      </div>

      {/* Top Right: Region Selector Quick Tabs */}
      <div className="absolute top-4 right-4 z-[1000] glass-panel p-1 rounded-lg text-xs flex items-center gap-1 border border-disaster-border">
        <button
          onClick={() => handleRegionSwitch('all')}
          className={`px-2.5 py-1 rounded font-medium transition flex items-center gap-1 ${
            activeRegion === 'all' && !selectedVillage 
              ? 'bg-disaster-accent text-white shadow' 
              : 'text-gray-300 hover:text-white hover:bg-disaster-card'
          }`}
          title="View full India-Nepal Himalayan Transboundary corridor"
        >
          <Globe2 className="w-3.5 h-3.5" />
          <span>All Basins</span>
        </button>

        <button
          onClick={() => handleRegionSwitch('india')}
          className={`px-2.5 py-1 rounded font-medium transition flex items-center gap-1 ${
            activeRegion === 'india' && !selectedVillage
              ? 'bg-disaster-accent text-white shadow' 
              : 'text-gray-300 hover:text-white hover:bg-disaster-card'
          }`}
          title="Focus on Chamoli & Alaknanda Valley, Uttarakhand"
        >
          <span>🇮🇳 Chamoli (India)</span>
        </button>

        <button
          onClick={() => handleRegionSwitch('nepal')}
          className={`px-2.5 py-1 rounded font-medium transition flex items-center gap-1 ${
            activeRegion === 'nepal' && !selectedVillage
              ? 'bg-disaster-accent text-white shadow' 
              : 'text-gray-300 hover:text-white hover:bg-disaster-card'
          }`}
          title="Focus on Mahakali, Karnali, Gandaki & Melamchi Basins, Nepal"
        >
          <span>🇳🇵 Nepal Environment</span>
        </button>
      </div>

      <MapContainer
        center={regionCoords.all.center}
        zoom={regionCoords.all.zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <SetMapView center={mapCenter} zoom={mapZoom} />
        <ZoomControl position="bottomright" />

        {/* Satellite imagery basemap */}
        <TileLayer
          attribution='&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />

        {/* Village & Nepal Station Polygons */}
        {villages.map((v) => {
          let geoData = null;
          try {
            if (v.boundary_geojson) {
              geoData = typeof v.boundary_geojson === 'string'
                ? JSON.parse(v.boundary_geojson)
                : v.boundary_geojson;
            }
          } catch (e) {
            console.error("GeoJSON parse error", e);
          }

          const isSelected = selectedVillage?.id === v.id;
          const color = getRiskColor(v.current_risk_level);
          const isNepal = v.state?.toLowerCase().includes('nepal');

          return (
            <React.Fragment key={v.id}>
              {geoData && (
                <GeoJSON
                  data={geoData}
                  style={() => ({
                    color: color,
                    weight: isSelected ? 3.5 : (isNepal ? 2.5 : 2),
                    opacity: isSelected ? 1.0 : 0.8,
                    fillColor: color,
                    fillOpacity: isSelected ? 0.45 : (v.current_risk_level === 'red' ? 0.35 : 0.20),
                    dashArray: isNepal ? '3, 4' : (isSelected ? '4' : null)
                  })}
                  eventHandlers={{
                    click: () => onSelectVillage(v)
                  }}
                />
              )}

              <Marker
                position={[v.latitude, v.longitude]}
                icon={createCustomMarkerIcon(v.current_risk_level, v.current_risk_score, isNepal)}
                eventHandlers={{
                  click: () => onSelectVillage(v)
                }}
              >
                <Popup>
                  <div className="p-1 min-w-[200px]">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <h4 className="font-bold text-sm text-gray-100">{v.name}</h4>
                      <span className="text-xs">{isNepal ? '🇳🇵' : '🇮🇳'}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mb-1.5">{v.district} • {v.state}</p>
                    
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-400">Risk Score:</span>
                      <span className="font-bold" style={{ color: getRiskColor(v.current_risk_level) }}>
                        {v.current_risk_score}/100 ({v.current_risk_level?.toUpperCase()})
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-400">Precipitation:</span>
                      <span className="text-blue-400 font-medium">{v.latest_rainfall_mm} mm/h</span>
                    </div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-400">Soil Saturation:</span>
                      <span className="text-emerald-400 font-medium">{v.latest_soil_moisture_pct}%</span>
                    </div>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-gray-400">Evac Lead Time:</span>
                      <span className="text-amber-400 font-semibold">~{v.current_lead_time_hrs} hrs</span>
                    </div>
                    <button
                      onClick={() => onSelectVillage(v)}
                      className="w-full text-center py-1 bg-disaster-accent hover:bg-blue-600 text-white rounded text-xs font-medium transition"
                    >
                      View Node Telemetry
                    </button>
                    {onOpenVillage && (
                      <button
                        onClick={() => onOpenVillage(v)}
                        className="w-full text-center py-1 mt-1 bg-cyan-500/20 border border-cyan-500/50 hover:bg-cyan-500/30 text-cyan-200 rounded text-xs font-medium transition"
                      >
                        Open Full Node Page ↗
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}

        {/* ---- Evacuation routes (indicative switchback alignments, see backend/evacuation.py) ---- */}
        {routes.filter((r) => r?.geometry?.length > 1).map((r, i) => (
          <Polyline
            key={`route-${r.shelter_id ?? i}`}
            positions={r.geometry}
            pathOptions={{
              color: FEASIBILITY_COLOR[r.feasibility] || FEASIBILITY_COLOR.unknown,
              weight: 3.5,
              opacity: 0.9,
              // Dashed, because this is a modelled alignment rather than a surveyed centreline.
              dashArray: '7 5',
            }}
          >
            <Popup>
              <div className="p-1 min-w-[190px]">
                <h4 className="font-bold text-sm text-gray-100 mb-1">{r.shelter_name}</h4>
                <p className="text-[10px] text-gray-400 mb-1.5">
                  {r.route_surface?.replace(/_/g, ' ')} · indicative alignment
                </p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">On foot:</span>
                  <span className="font-semibold text-white">
                    {Math.round(r.walking_time_min)} min
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Climb:</span>
                  <span className="font-semibold text-white">
                    {Math.round(r.elevation_gain_m)} m
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Verdict:</span>
                  <span
                    className="font-semibold"
                    style={{ color: FEASIBILITY_COLOR[r.feasibility] }}
                  >
                    {r.feasibility?.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            </Popup>
          </Polyline>
        ))}

        {/* ---- Shelter markers ---- */}
        {shelters
          .filter((s) => typeof s.latitude === 'number' && typeof s.longitude === 'number')
          .map((s, i) => (
            <Marker
              key={`shelter-${s.shelter_id ?? s.id ?? i}`}
              position={[s.latitude, s.longitude]}
              icon={SHELTER_ICON}
            >
              <Popup>
                <div className="p-1 min-w-[190px]">
                  <h4 className="font-bold text-sm text-gray-100 mb-1">
                    {s.shelter_name || s.name}
                  </h4>
                  <p className="text-[10px] text-gray-400 mb-1.5">
                    {(s.shelter_type || '').replace(/_/g, ' ')} · {Math.round(s.elevation_m)} m
                  </p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Capacity:</span>
                    <span className="font-semibold text-white">{s.capacity}</span>
                  </div>
                  {s.contact_phone && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">Contact:</span>
                      <a href={`tel:${s.contact_phone}`} className="font-semibold text-cyan-300">
                        {s.contact_phone}
                      </a>
                    </div>
                  )}
                  {s.crosses_stream && (
                    <p className="text-[10px] text-rose-400 mt-1.5">
                      Route crosses the hazard channel.
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}
