"""
Sensor Telemetry & IoT Simulator
SIH 2026 Problem ID: 26192 - Flash Flood Prediction System for Hilly Regions
Mimics real-time edge IoT sensors (rain gauges, TDR soil moisture sensors, vibrating wire piezometers,
and geophone vibration accelerometers) streaming at 5-second intervals with interactive storm simulation.
"""

import argparse
import asyncio
import httpx
import json
import math
import os
import random
import sys
import time
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

from backend.database import AsyncSessionLocal
from backend.models import Village, Reading
from sqlalchemy import select

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000/api")

# State tracking for continuous streaming
simulator_state = {
    "storm_active": False,
    "storm_start_time": None,
    "storm_target_villages": [1, 2, 5, 8], # Raini, Tapovan, Helang, Govindghat
    "storm_intensity": "extreme",
    "storm_ramp_duration_s": 30.0,
    "tick_count": 0
}

def get_simulated_reading(village, is_storm=False, storm_progress=0.0):
    """
    Computes a realistic sensor payload for a village based on terrain and weather mode.
    """
    v_id = village.id
    slope = village.avg_slope_deg or 35.0
    drainage = village.drainage_capacity_index or 0.6
    
    # Baseline normal fluctuations
    base_rain = random.uniform(0.0, 1.2)
    base_soil = 22.0 + math.sin(simulator_state["tick_count"] * 0.1 + v_id) * 3.0
    base_vibration = random.uniform(0.02, 0.05)
    base_water_level = 0.75 + random.uniform(-0.05, 0.05)
    base_pore_pressure = base_soil * 0.2
    
    if is_storm and v_id in simulator_state["storm_target_villages"]:
        # Scale with storm progress (0.0 to 1.0)
        p = min(1.0, max(0.0, storm_progress))
        
        # Exponential cloudburst ramp
        rain_rate = base_rain + (p ** 1.5) * random.uniform(75.0, 115.0)
        rain_1h = rain_rate * 0.8 + 25.0 * p
        rain_24h = 35.0 + 120.0 * p
        
        # Rapid soil saturation due to steep slope runoff infiltration
        soil_moisture = min(96.0, base_soil + (p * (72.0 - (drainage * 15.0))))
        pore_pressure = 4.0 + (p * 22.0)
        
        # Vibration index spikes as debris/boulders collide in torrent bed
        vibration = base_vibration + (p * random.uniform(0.45, 0.88))
        water_level = base_water_level + (p * random.uniform(2.8, 5.2))
        
        return {
            "village_id": v_id,
            "rainfall_mm": round(rain_rate, 2),
            "rainfall_1h_mm": round(rain_1h, 2),
            "rainfall_24h_mm": round(rain_24h, 2),
            "soil_moisture_pct": round(soil_moisture, 2),
            "pore_water_pressure_kpa": round(pore_pressure, 2),
            "vibration_index": round(vibration, 3),
            "water_level_stream_m": round(water_level, 2),
            "source": "iot-sensor-stream (storm-mode)"
        }
    else:
        return {
            "village_id": v_id,
            "rainfall_mm": round(base_rain, 2),
            "rainfall_1h_mm": round(base_rain * 2.0 + 1.0, 2),
            "rainfall_24h_mm": round(random.uniform(5.0, 18.0), 2),
            "soil_moisture_pct": round(base_soil, 2),
            "pore_water_pressure_kpa": round(base_pore_pressure, 2),
            "vibration_index": round(base_vibration, 3),
            "water_level_stream_m": round(base_water_level, 2),
            "source": "iot-sensor-stream (normal)"
        }

async def run_simulation_loop(interval_sec=4.0, storm_mode=False, max_ticks=None):
    if storm_mode:
        simulator_state["storm_active"] = True
        simulator_state["storm_start_time"] = time.time()
        print(">>> STARTING IN STORM / CLOUDBURST SIMULATION MODE <<<")
    else:
        print(">>> STARTING IN NORMAL CONTINUOUS IoT TELEMETRY MODE <<<")

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Village))
        villages = result.scalars().all()
        
    if not villages:
        print("Error: No villages found in DB. Run seed_villages.py first.")
        return

    print(f"Streaming live telemetry for {len(villages)} village nodes...")
    
    async with httpx.AsyncClient(timeout=4.0) as client:
        while True:
            simulator_state["tick_count"] += 1
            now = time.time()
            
            # Compute storm progression
            if simulator_state["storm_active"]:
                elapsed = now - simulator_state["storm_start_time"]
                progress = min(1.0, elapsed / simulator_state["storm_ramp_duration_s"])
            else:
                progress = 0.0

            print(f"\n--- [TICK #{simulator_state['tick_count']}] Storm: {simulator_state['storm_active']} (Progress: {int(progress*100)}%) ---")
            
            for v in villages:
                payload = get_simulated_reading(
                    v, 
                    is_storm=simulator_state["storm_active"], 
                    storm_progress=progress
                )
                
                # Attempt sending to REST API endpoint if backend is running, otherwise direct DB write
                try:
                    resp = await client.post(f"{API_BASE_URL}/ingest", json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        risk_info = data.get("risk_evaluation", {})
                        print(f" -> [{v.name[:18]:18s}] Rain: {payload['rainfall_mm']:5.1f} mm/h | Soil: {payload['soil_moisture_pct']:4.1f}% | Vib: {payload['vibration_index']:.2f} | Risk: {risk_info.get('risk_score', 0):4.1f} ({risk_info.get('risk_level', 'green').upper()})")
                    else:
                        print(f" -> [{v.name[:18]:18s}] API status {resp.status_code}")
                except Exception:
                    # Fallback direct DB insert + local evaluation
                    async with AsyncSessionLocal() as local_session:
                        reading = Reading(
                            village_id=payload["village_id"],
                            time=datetime.now(timezone.utc),
                            rainfall_mm=payload["rainfall_mm"],
                            rainfall_1h_mm=payload["rainfall_1h_mm"],
                            rainfall_24h_mm=payload["rainfall_24h_mm"],
                            soil_moisture_pct=payload["soil_moisture_pct"],
                            pore_water_pressure_kpa=payload["pore_water_pressure_kpa"],
                            vibration_index=payload["vibration_index"],
                            water_level_stream_m=payload["water_level_stream_m"],
                            source=payload["source"]
                        )
                        local_session.add(reading)
                        await local_session.commit()
                    print(f" -> [{v.name[:18]:18s}] (DB fallback) Rain: {payload['rainfall_mm']:5.1f} mm/h | Soil: {payload['soil_moisture_pct']:4.1f}% | Vib: {payload['vibration_index']:.2f}")

            if max_ticks and simulator_state["tick_count"] >= max_ticks:
                print("Completed requested simulation ticks.")
                break
                
            await asyncio.sleep(interval_sec)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Flash Flood Sensor Simulator")
    parser.add_argument("--storm", action="store_true", help="Trigger storm / cloudburst scenario immediately")
    parser.add_argument("--interval", type=float, default=3.0, help="Tick interval in seconds")
    parser.add_argument("--ticks", type=int, default=None, help="Number of ticks to run (default: infinite)")
    args = parser.parse_args()

    asyncio.run(run_simulation_loop(interval_sec=args.interval, storm_mode=args.storm, max_ticks=args.ticks))
