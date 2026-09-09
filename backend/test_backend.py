"""
Backend API & Prediction Engine Unit Tests
SIH 2026 Problem ID: 26192 - Flash Flood Prediction System for Hilly Regions
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from backend.main import app
from backend.evacuation import rank_evacuation_options, build_advisory
from ml.prediction_engine import prediction_engine

@pytest.mark.asyncio
async def test_root_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["problem_id"] == 26192
        assert data["status"] == "operational"

@pytest.mark.asyncio
async def test_get_villages():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/villages")
        assert resp.status_code == 200
        villages = resp.json()
        assert len(villages) >= 10
        assert "Raini" in villages[0]["name"] or any("Raini" in v["name"] for v in villages)
        assert "current_risk_score" in villages[0]
        assert "current_risk_level" in villages[0]

@pytest.mark.asyncio
async def test_ingest_and_evaluate_risk():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Ingest severe cloudburst reading for village 1 (Raini)
        payload = {
            "village_id": 1,
            "rainfall_mm": 88.0,
            "rainfall_1h_mm": 72.0,
            "rainfall_24h_mm": 130.0,
            "soil_moisture_pct": 92.0,
            "pore_water_pressure_kpa": 24.5,
            "vibration_index": 0.65,
            "water_level_stream_m": 3.4,
            "source": "unit-test"
        }
        resp = await client.post("/api/ingest", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        eval_res = data["risk_evaluation"]
        assert eval_res["risk_level"] == "red"
        assert eval_res["risk_score"] >= 70.0
        assert eval_res["estimated_lead_time_hrs"] < 3.0

def test_intensity_duration_physics():
    i_crit, ratio = prediction_engine.compute_physical_id_threshold(rainfall_1h_mm=50.0, duration_hrs=1.0)
    assert i_crit > 10.0
    assert ratio > 1.0 # 50mm/hr exceeds critical threshold for central Himalayas

def test_lead_time_formula():
    lead_time = prediction_engine.compute_lead_time_hours(
        current_moisture_pct=30.0,
        rainfall_1h_mm=5.0,
        slope_deg=35.0,
        drainage_capacity=0.6,
        vibration_index=0.03
    )
    assert lead_time > 5.0 # safe lead time for low rain & dry soil


def test_downhill_shelter_never_recommended():
    """
    A shelter below the settlement must never be ranked first, however convenient it looks.

    The debris flow travels down the same valley, so descending means moving with the flow.
    This test deliberately stacks the deck in the downhill shelter's favour -- it is close,
    motorable, roomy and comfortably inside the lead time, while the uphill option is a long
    footpath slog that only just fits. The uphill option must still win.
    """
    village = {
        "latitude": 30.4852,
        "longitude": 79.6978,
        "elevation_m": 2000.0,
        "population": 300,
    }
    downhill = {
        "id": 1,
        "name": "Valley Floor School",
        "latitude": 30.4870,
        "longitude": 79.6990,
        "elevation_m": 1850.0,          # 150 m BELOW the village
        "capacity": 900,
        "route_surface": "motorable",
        "crosses_stream": False,
        "is_active": True,
    }
    uphill = {
        "id": 2,
        "name": "Ridge Community Hall",
        "latitude": 30.4960,
        "longitude": 79.7090,
        "elevation_m": 2140.0,          # 140 m above the village
        "capacity": 320,
        "route_surface": "footpath",
        "crosses_stream": False,
        "is_active": True,
    }

    options = rank_evacuation_options(
        village, [downhill, uphill], rainfall_1h_mm=40.0, lead_time_hrs=3.0
    )

    assert options[0]["shelter_name"] == "Ridge Community Hall"
    assert options[0]["below_settlement"] is False
    assert options[-1]["shelter_name"] == "Valley Floor School"
    assert options[-1]["below_settlement"] is True
    # The downhill option is still returned -- an operator needs to see what exists when
    # nothing uphill is reachable -- but it carries the penalty on its safety score.
    assert options[-1]["safety_score"] < options[0]["safety_score"]


def test_advisory_never_says_climbing_a_negative_height():
    """When the only shelter on record is downhill, the wording must say so, not print a minus."""
    option = {
        "shelter_name": "Valley Floor School",
        "walking_time_min": 24.0,
        "elevation_gain_m": -150.0,
        "below_settlement": True,
        "feasibility": "feasible",
        "crosses_stream": False,
    }
    advisory = build_advisory("Raini", option, "red")

    assert "climbing -" not in advisory["en"]
    assert "-150" not in advisory["en"] and "-150" not in advisory["hi"]
    assert "descending 150 m" in advisory["en"]
    assert "below the settlement" in advisory["en"]
    assert "नीचे" in advisory["hi"]

