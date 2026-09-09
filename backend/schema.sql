-- Database Schema for Flash Flood Prediction System for Hilly Regions
-- SIH 2026 Problem ID: 26192

-- Extensions for PostgreSQL (if running in PostgreSQL / PostGIS / TimescaleDB)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Villages / Wards Table
CREATE TABLE IF NOT EXISTS villages (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    district TEXT,
    state TEXT,
    latitude FLOAT,
    longitude FLOAT,
    boundary_geojson TEXT,
    elevation_m FLOAT,
    avg_slope_deg FLOAT,
    distance_to_stream_m FLOAT,
    soil_type TEXT DEFAULT 'Loamy Silt',
    drainage_capacity_index FLOAT DEFAULT 0.65,
    historical_incident_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Time-series Sensor & Meteorological Readings Table
CREATE TABLE IF NOT EXISTS readings (
    id SERIAL PRIMARY KEY,
    time TIMESTAMP WITH TIME ZONE NOT NULL,
    village_id INT REFERENCES villages(id) ON DELETE CASCADE,
    rainfall_mm FLOAT DEFAULT 0.0,
    rainfall_1h_mm FLOAT DEFAULT 0.0,
    rainfall_24h_mm FLOAT DEFAULT 0.0,
    soil_moisture_pct FLOAT DEFAULT 20.0,
    pore_water_pressure_kpa FLOAT DEFAULT 5.0,
    vibration_index FLOAT DEFAULT 0.05,
    water_level_stream_m FLOAT DEFAULT 0.8,
    source TEXT DEFAULT 'simulator' -- 'imd', 'open-meteo', 'smap', 'simulator', 'iot-lora'
);

-- Model Risk Scores Output Table
CREATE TABLE IF NOT EXISTS risk_scores (
    id SERIAL PRIMARY KEY,
    time TIMESTAMP WITH TIME ZONE NOT NULL,
    village_id INT REFERENCES villages(id) ON DELETE CASCADE,
    risk_score FLOAT NOT NULL, -- 0.0 to 100.0
    risk_level TEXT NOT NULL,  -- 'green' | 'yellow' | 'red'
    ml_susceptibility FLOAT,   -- 0.0 to 1.0
    intensity_duration_ratio FLOAT,
    estimated_lead_time_hrs FLOAT,
    primary_factor TEXT,       -- 'Extreme Rain Rate' | 'Soil Saturation' | 'Debris Vibration'
    model_version TEXT DEFAULT 'v1.0-hybrid-rf-physics'
);

-- Early Warnings & Alerts Fired Table
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    village_id INT REFERENCES villages(id) ON DELETE CASCADE,
    fired_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    risk_level TEXT NOT NULL,
    risk_score FLOAT NOT NULL,
    channel TEXT DEFAULT 'sms', -- 'sms' | 'sachet_cap' | 'dashboard' | 'siren'
    message_en TEXT NOT NULL,
    message_hi TEXT NOT NULL,
    estimated_lead_time_hrs FLOAT,
    delivered BOOLEAN DEFAULT true
);

-- Indices for rapid querying
CREATE INDEX IF NOT EXISTS idx_readings_village_time ON readings(village_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_risk_village_time ON risk_scores(village_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_village_time ON alerts(village_id, fired_at DESC);
