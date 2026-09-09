"""
End-to-End Automated Integration & Scenario Tests
SIH 2026 Problem ID: 26192 - Flash Flood Prediction System for Hilly Regions
Validates normal baseline behavior and storm scenario escalation.
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from backend.main import app

@pytest.mark.asyncio
async def test_e2e_normal_baseline_mode():
    """G1: Verify normal mode keeps catchment risk scores in safe/moderate range"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Reset to baseline
        reset_resp = await client.post("/api/demo/reset")
        assert reset_resp.status_code == 200
        
        # Verify villages
        v_resp = await client.get("/api/villages")
        assert v_resp.status_code == 200
        villages = v_resp.json()
        
        # In normal mode, no village should have critical red risk
        red_villages = [v for v in villages if v["current_risk_level"] == "red"]
        assert len(red_villages) == 0, "Normal mode should not trigger false positive red alerts"

@pytest.mark.asyncio
async def test_e2e_storm_escalation_and_alert_dispatch():
    """G2: Verify storm trigger escalates target nodes to Red and records bilingual alert"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Trigger extreme storm scenario
        storm_req = {
            "intensity": "extreme",
            "target_rainfall_rate_mm_hr": 95.0,
            "target_soil_moisture_pct": 93.0
        }
        resp = await client.post("/api/demo/storm", json=storm_req)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "storm_scenario_active"
        
        # Verify villages updated to Red
        v_resp = await client.get("/api/villages")
        assert v_resp.status_code == 200
        villages = v_resp.json()
        red_villages = [v for v in villages if v["current_risk_level"] == "red"]
        assert len(red_villages) >= 1, "Storm mode must escalate affected villages to red risk"
        
        # Verify alerts log contains bilingual warning
        a_resp = await client.get("/api/alerts")
        assert a_resp.status_code == 200
        alerts = a_resp.json()
        assert len(alerts) > 0, "Red risk must log an alert record"
        latest_alert = alerts[0]
        assert "EVACUATION WARNING" in latest_alert["message_en"]
        assert "आपातकालीन चेतावनी" in latest_alert["message_hi"]
        assert latest_alert["estimated_lead_time_hrs"] < 3.0
