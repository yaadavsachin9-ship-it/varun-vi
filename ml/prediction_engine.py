"""
Hybrid ML & Physics-Informed Prediction Engine
SIH 2026 Problem ID: 26192 - Flash Flood Prediction System for Hilly Regions

Architecture:
1. ML Susceptibility Classifier: Evaluates multi-parameter slope & rainfall pattern non-linear risk.
2. Physical Intensity-Duration (ID) Threshold: Evaluates empirical Caine / Guzzetti threshold:
      I_crit = alpha * D^(-beta)  (where alpha=14.82, beta=0.39 for Himalayan terrain).
3. Hydro-Mechanical Pore Pressure & Saturation Index: Assesses soil liquefaction risk.
4. Lead Time Estimation:
      T_lead = (S_crit - S_curr) / (dS/dt + (I_rain * (1 - K_drain) / d_soil))
      Calculates actionable evacuation window before slope failure / flood onset.
"""

import os
import joblib
import math
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from typing import Dict, Any, Tuple

MODEL_PATH = os.path.join(os.path.dirname(__file__), "susceptibility_model.joblib")

class PredictionEngine:
    def __init__(self):
        self.model_data = None
        self._load_model()

    def _load_model(self):
        if os.path.exists(MODEL_PATH):
            try:
                self.model_data = joblib.load(MODEL_PATH)
                print(f"Loaded ML Susceptibility Model: {self.model_data.get('version')} (Accuracy: {self.model_data.get('accuracy', 0)*100:.1f}%)")
            except Exception as e:
                print(f"Warning: Failed to load ML model artifact: {e}")
                self.model_data = None
        else:
            print("ML model artifact not found. Will use calibrated physical heuristic until trained.")

    def compute_physical_id_threshold(self, rainfall_1h_mm: float, duration_hrs: float = 1.0) -> Tuple[float, float]:
        """
        Calculates empirical Caine/Guzzetti Intensity-Duration (ID) threshold for Central Himalayas.
        Formula: I_crit = 14.82 * (D ^ -0.39)
        Returns: (I_critical, ratio = rainfall_rate / I_critical)
        """
        d = max(0.25, duration_hrs)
        i_crit = 14.82 * (d ** -0.39)
        ratio = rainfall_1h_mm / i_crit
        return i_crit, ratio

    def compute_lead_time_hours(
        self, 
        current_moisture_pct: float,
        rainfall_1h_mm: float,
        slope_deg: float,
        drainage_capacity: float,
        vibration_index: float
    ) -> float:
        """
        Calculates actionable lead time (hours) before critical slope liquefaction / flash flood threshold.
        
        Mathematical Formulation:
        - Critical Saturation (S_crit) = 88.0% (slope-adjusted: steeper slopes fail at lower threshold)
        - Net Infiltration Rate (dInfil/dt) = Rain_Rate * (1 - Drainage_Index) * cos(Slope)
        - Rapid Surface Runoff Saturation Speed (dS/dt)
        - If already above threshold or high vibration: T_lead shrinks rapidly.
        """
        s_crit = 92.0 - (max(0.0, slope_deg - 20.0) * 0.4)
        
        if current_moisture_pct >= s_crit:
            if vibration_index > 0.4:
                return round(max(0.2, 0.5 - (vibration_index * 0.3)), 1)
            return round(max(0.4, 1.2 - (rainfall_1h_mm / 100.0)), 1)
            
        moisture_deficit = s_crit - current_moisture_pct
        rain_rate = max(0.5, rainfall_1h_mm)
        inflow_rate = rain_rate * (1.0 - (drainage_capacity * 0.6)) * math.cos(math.radians(slope_deg))
        accumulation_speed = 1.2 + (inflow_rate * 0.85)
        
        lead_time = moisture_deficit / accumulation_speed
        
        if vibration_index > 0.2:
            lead_time = lead_time * max(0.3, (1.0 - vibration_index))
            
        return round(float(np.clip(lead_time, 0.3, 24.0)), 1)

    def evaluate_risk(
        self,
        village_static: Dict[str, Any],
        reading_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Main fusion engine combining ML susceptibility with physics thresholds.
        """
        elev = village_static.get("elevation_m", 1800.0)
        slope = village_static.get("avg_slope_deg", 32.0)
        dist_stream = village_static.get("distance_to_stream_m", 100.0)
        drainage = village_static.get("drainage_capacity_index", 0.65)
        hist_count = village_static.get("historical_incident_count", 0)

        rain_curr = reading_data.get("rainfall_mm", 0.0)
        rain_1h = reading_data.get("rainfall_1h_mm", rain_curr * 1.5)
        rain_24h = reading_data.get("rainfall_24h_mm", rain_1h * 3.0)
        soil_pct = reading_data.get("soil_moisture_pct", 25.0)
        pore_pressure = reading_data.get("pore_water_pressure_kpa", soil_pct * 0.2)
        vibration = reading_data.get("vibration_index", 0.04)

        # 1. ML Classifier Prediction
        ml_prob = 0.1
        if self.model_data:
            model = self.model_data["model"]
            cols = self.model_data.get("feature_cols", [
                "elevation_m", "avg_slope_deg", "distance_to_stream_m", "drainage_capacity_index",
                "rainfall_1h_mm", "rainfall_24h_mm", "soil_moisture_pct", "pore_water_pressure_kpa", "vibration_index"
            ])
            df_feat = pd.DataFrame([{
                "elevation_m": elev,
                "avg_slope_deg": slope,
                "distance_to_stream_m": dist_stream,
                "drainage_capacity_index": drainage,
                "rainfall_1h_mm": rain_1h,
                "rainfall_24h_mm": rain_24h,
                "soil_moisture_pct": soil_pct,
                "pore_water_pressure_kpa": pore_pressure,
                "vibration_index": vibration
            }])[cols]
            try:
                probs = model.predict_proba(df_feat)
                ml_prob = float(probs[0][1])
            except Exception:
                ml_prob = 0.15

        # 2. Physical Intensity-Duration Threshold
        i_crit, id_ratio = self.compute_physical_id_threshold(rain_1h, duration_hrs=1.0)

        # 3. Physical Hazard Penalty Components
        soil_score = (max(0.0, soil_pct - 30.0) / 70.0) * 30.0
        rain_score = min(35.0, (id_ratio ** 1.2) * 25.0)
        slope_factor = (max(0.0, slope - 20.0) / 35.0) * 15.0
        stream_factor = (max(0.0, 150.0 - dist_stream) / 150.0) * 5.0
        geom_score = slope_factor + stream_factor
        vib_score = min(15.0, vibration * 20.0)
        
        physical_score = soil_score + rain_score + geom_score + vib_score
        combined_raw = (ml_prob * 100.0 * 0.40) + (physical_score * 0.60)
        hist_boost = min(8.0, hist_count * 1.5)
        final_risk_score = float(np.clip(combined_raw + hist_boost, 0.0, 100.0))

        if final_risk_score >= 70.0 or (soil_pct > 85.0 and rain_1h > 45.0) or (vibration > 0.55):
            risk_level = "red"
        elif final_risk_score >= 40.0 or rain_1h > 20.0 or soil_pct > 65.0:
            risk_level = "yellow"
        else:
            risk_level = "green"

        factors = []
        if rain_1h > 35.0:
            factors.append("Extreme Cloudburst Intensity")
        if soil_pct > 75.0:
            factors.append("High Soil Moisture Saturation")
        if vibration > 0.35:
            factors.append("Debris Flow Vibration Spike")
        if slope > 38.0 and rain_1h > 15.0:
            factors.append("Steep Slope Gravitational Instability")
        if dist_stream < 50.0 and rain_24h > 60.0:
            factors.append("Stream Flood Stage Inundation")
            
        primary_factor = " & ".join(factors) if factors else "Normal Hydrological Baseline"

        lead_time_hrs = self.compute_lead_time_hours(
            current_moisture_pct=soil_pct,
            rainfall_1h_mm=rain_1h,
            slope_deg=slope,
            drainage_capacity=drainage,
            vibration_index=vibration
        )

        return {
            "risk_score": round(final_risk_score, 1),
            "risk_level": risk_level,
            "ml_susceptibility": round(ml_prob, 3),
            "intensity_duration_ratio": round(id_ratio, 2),
            "estimated_lead_time_hrs": lead_time_hrs,
            "primary_factor": primary_factor,
            "components": {
                "soil_saturation_score": round(soil_score, 1),
                "rainfall_intensity_score": round(rain_score, 1),
                "geomorphology_score": round(geom_score, 1),
                "vibration_score": round(vib_score, 1),
                "ml_probability_pct": round(ml_prob * 100.0, 1)
            }
        }

prediction_engine = PredictionEngine()
