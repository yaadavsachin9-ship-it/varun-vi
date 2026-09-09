# DRAIN-GUARD AI: Flash Flood Prediction System for Hilly Regions
**SIH 2026 | Problem Statement ID: 26192 | Theme: Disaster Management**
**Ministry of Home Affairs | Department: NDRF & Disaster Management Division**

---

## Installation

### Prerequisites

Install Python 3.11 or newer, Node.js 20 or newer with npm, Git, and optionally Docker Desktop. Check the tools with:

```powershell
python --version
node --version
npm --version
git --version
```

### 1. Clone the repository

```powershell
git clone https://github.com/yaadavsachin9-ship-it/varun-vi.git
cd varun-vi
```

### 2. Create the Python environment

Windows PowerShell:

```powershell
python -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

macOS/Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
```

### 3. Install backend and ML dependencies

With the virtual environment active:

```powershell
python -m pip install fastapi "uvicorn[standard]" sqlalchemy aiosqlite pydantic pydantic-settings python-dotenv httpx pytest numpy pandas scikit-learn joblib shapely
```

The included model at `ml/susceptibility_model.joblib` means model training is optional.

### 4. Configure environment files

The default setup uses SQLite and simulated alerts, so no API keys are required for a local demo:

```powershell
Copy-Item .env.example .env
Copy-Item frontend\.env.example frontend\.env.local
```

Keep `ALERT_SIMULATION_MODE=true` for local development. The frontend expects the backend at `http://localhost:8000`; change `VITE_API_BASE` in `frontend/.env.local` if needed. Never put a Supabase service-role key in a frontend environment file.

### 5. Install frontend dependencies

```powershell
Set-Location frontend
npm install
Set-Location ..
```

### 6. Create and seed the local database

The backend creates tables automatically, but the village seed script populates the dashboard data:

```powershell
python -m backend.migrate
python data\seed_villages.py
```

This creates `data/flood_prediction.db`, which is generated local state and is ignored by Git.

## Quick Start

Run the application with three terminals. Activate `.venv` in each terminal.

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

## Optional Docker Setup

The default local setup uses SQLite and does not need Docker. To run PostgreSQL and Redis:

```powershell
docker compose up -d postgres redis
docker compose ps
```

Change `.env` to use the container services:

```dotenv
DATABASE_URL=postgresql+asyncpg://sih_user:sih_password@localhost:5432/sih_flood_db
REDIS_URL=redis://localhost:6379/0
USE_REDIS=true
```

Install the optional Python drivers before starting the backend:

```powershell
python -m pip install asyncpg redis
```

Stop the services with `docker compose down`. Add `-v` only when you also want to delete the database volumes.

## Frontend Checks

With the virtual environment active, run the backend tests and frontend checks:

```powershell
python -m pytest backend/test_backend.py -v
python -m pytest backend/test_e2e.py -v
Set-Location frontend
npm run lint
npm run build
```

## Troubleshooting

### PowerShell blocks virtual environment activation

Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned` and activate `.venv` again. This applies only to the current terminal.

### The dashboard shows no villages

Stop the backend, run `python data\seed_villages.py`, and restart the backend. Confirm that `data/flood_prediction.db` exists.

### The frontend cannot connect to the backend

Confirm that the backend is running on port 8000 and that `frontend/.env.local` contains `VITE_API_BASE=http://localhost:8000`. Restart Vite after changing an environment file.

### Port 8000 or 5173 is already in use

Start the backend with another `--port` and update `VITE_API_BASE`, or start Vite with `npm run dev -- --port 5174`.

### `python` is not recognized

Install Python with **Add Python to PATH** enabled, or use the `py` launcher in place of `python`.

## Repository Structure
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
