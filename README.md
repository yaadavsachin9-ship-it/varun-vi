# DRAIN-GUARD AI: Flash Flood Prediction System for Hilly Regions
**SIH 2026 | Problem Statement ID: 26192 | Theme: Disaster Management**
**Ministry of Home Affairs | Department: NDRF & Disaster Management Division**

---

## ⚡ Quick Start Guide (Run Live in Under 2 Minutes)

### 1. Start Backend API & Realtime Gateway
In your first terminal:
```bash
# Activate Python environment
.venv\Scripts\activate

# Start FastAPI server with live WebSockets
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be live at `http://localhost:8000/docs`.

---

### 2. Start Frontend Dashboard
In your second terminal:
```bash
cd frontend
npm run dev
```
Open `http://localhost:5173` in your browser.

---

### 3. (Optional) Run Live IoT Sensor Simulator
In your third terminal:
```bash
# Normal continuous background streaming (5-second intervals)
.venv\Scripts\python simulate_sensors.py

# Or trigger extreme storm mode from CLI:
.venv\Scripts\python simulate_sensors.py --storm
```
*(You can also trigger storm mode directly via the interactive red button on the frontend dashboard!)*

---

## 🧪 Running Automated Tests
```bash
# Run backend API and ML physics tests
.venv\Scripts\pytest backend/test_backend.py -v

# Run full end-to-end integration and scenario tests
.venv\Scripts\pytest backend/test_e2e.py -v
```

---

## 📂 Repository Structure
```
├── backend/
│   ├── main.py              # FastAPI application, REST endpoints & WebSockets
│   ├── models.py            # SQLAlchemy async database models
│   ├── schemas.py           # Pydantic validation schemas
│   ├── database.py          # Dual PostgreSQL / SQLite async engine
│   ├── alert_service.py     # Bilingual SMS & CAP early warning dispatcher
│   ├── websocket_manager.py # Real-time event fan-out manager
│   ├── schema.sql           # PostGIS + TimescaleDB schema
│   ├── test_backend.py      # API unit tests
│   └── test_e2e.py          # End-to-end scenario tests
├── ml/
│   ├── train_model.py       # Random Forest classifier training script
│   ├── prediction_engine.py # Hybrid ML + Intensity-Duration + Lead Time engine
│   └── susceptibility_model.joblib # Serialized model artifact
├── data/
│   ├── process_dem.py       # Digital Elevation Model (DEM) slope/aspect processor
│   ├── seed_villages.py     # 12 real Chamoli Valley villages with GeoJSON polygons
│   ├── rainfall_client.py   # Live Open-Meteo & IMD precipitation client
│   ├── historical_incidents.py # Historical disaster matrix generator
│   └── canned_scenarios.json# Fallback offline judging replay scenarios
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── MapComponent.jsx          # Leaflet map with risk polygons
│   │   │   ├── VillageDetailPanel.jsx    # Recharts telemetry trend charts
│   │   │   ├── AuthorityTableView.jsx    # Sortable SDMA / NDRF priority table
│   │   │   ├── AlertFeedPanel.jsx        # Bilingual SMS feed & CAP exporter
│   │   │   ├── StormControlPanel.jsx     # Live storm simulation trigger
│   │   │   └── LeadTimeExplainerModal.jsx# Mathematical formula modal
│   │   ├── App.jsx                       # Main command center layout
│   │   └── index.css                     # Dark glassmorphic disaster theme
├── docs/
│   └── PITCH_DECK.md        # Complete 6-slide presentation deck & demo script
├── simulate_sensors.py      # Edge IoT sensor telemetry simulator
├── docker-compose.yml       # Production PostGIS + TimescaleDB + Redis container config
├── PROJECT_INSTRUCTIONS.md  # Single source of truth progress tracker
└── README.md
```
