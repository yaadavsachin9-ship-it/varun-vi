"""
FastAPI Backend Application
SIH 2026 Problem ID: 26192 - Flash Flood Prediction System for Hilly Regions
Ministry of Home Affairs | NDRF & Disaster Management Division
"""

import asyncio
import datetime
import json
import os
import sys
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.config import settings
from backend.database import get_db, engine, Base
from backend.models import Village, Reading, RiskScore, Alert, Shelter
from backend.schemas import (
    ReadingCreate, ReadingResponse,
    VillageResponse, RiskScoreResponse,
    AlertResponse, StormTriggerRequest,
    ShelterResponse, AlertDispatchRequest
)
from backend.websocket_manager import ws_manager
from backend.alert_service import check_and_dispatch_alert, translate_primary_factor
from backend.evacuation import rank_evacuation_options, build_advisory, haversine_m
from backend.backtest import run_backtest, run_all_backtests, event_catalogue
from ml.prediction_engine import prediction_engine

app = FastAPI(
    title="Flash Flood Early Warning System API",
    description="Hyper-local Flash Flood & Landslide Risk Prediction Engine for Hilly Regions (SIH 2026)",
    version="1.0.0"
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Background simulator state
active_storm_state = {
    "is_active": False,
    "intensity": "extreme",
    "started_at": None,
    "target_villages": [1, 2, 5, 8]
}

@app.on_event("startup")
async def startup_event():
    print("Initializing Database & Prediction Engine...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Backend server started successfully!")

@app.get("/")
async def root():
    return {
        "system": "Flash Flood Prediction System for Hilly Regions",
        "sih_year": 2026,
        "problem_id": 26192,
        "status": "operational",
        "region": settings.DEFAULT_REGION,
        "endpoints": {
            "villages": "/api/villages",
            "village_detail": "/api/villages/{id}",
            "ingest": "/api/ingest",
            "alerts": "/api/alerts",
            "alert_dispatch": "/api/alerts/dispatch",
            "shelters": "/api/shelters",
            "evacuation": "/api/villages/{id}/evacuation",
            "backtest_events": "/api/backtest/events",
            "backtest_run": "/api/backtest/{event_id}",
            "storm_trigger": "/api/demo/storm",
            "websocket": "/ws/risk"
        }
    }

async def _village_payload(db: AsyncSession, v: Village) -> dict:
    """
    Static village attributes joined to its latest risk score and latest sensor reading.
    Shared by the list endpoint and the single-village detail endpoint so the dashboard
    and the village page can never disagree about what the current state is.
    """
    latest_risk = (await db.execute(
        select(RiskScore).where(RiskScore.village_id == v.id).order_by(desc(RiskScore.time)).limit(1)
    )).scalar_one_or_none()

    latest_read = (await db.execute(
        select(Reading).where(Reading.village_id == v.id).order_by(desc(Reading.time)).limit(1)
    )).scalar_one_or_none()

    return {
        "id": v.id,
        "name": v.name,
        "district": v.district,
        "state": v.state,
        "latitude": v.latitude,
        "longitude": v.longitude,
        "boundary_geojson": v.boundary_geojson,
        "elevation_m": v.elevation_m,
        "avg_slope_deg": v.avg_slope_deg,
        "distance_to_stream_m": v.distance_to_stream_m,
        "soil_type": v.soil_type,
        "drainage_capacity_index": v.drainage_capacity_index,
        "historical_incident_count": v.historical_incident_count,
        "population": v.population or 0,
        "river_basin": v.river_basin or "",
        "current_risk_score": latest_risk.risk_score if latest_risk else 15.0,
        "current_risk_level": latest_risk.risk_level if latest_risk else "green",
        "current_lead_time_hrs": latest_risk.estimated_lead_time_hrs if latest_risk else 12.0,
        "latest_rainfall_mm": latest_read.rainfall_mm if latest_read else 0.0,
        "latest_soil_moisture_pct": latest_read.soil_moisture_pct if latest_read else 20.0,
        "latest_vibration_index": latest_read.vibration_index if latest_read else 0.04,
        "latest_stream_level_m": latest_read.water_level_stream_m if latest_read else 0.8,
        "latest_primary_factor": latest_risk.primary_factor if latest_risk else "Normal Hydrological Conditions",
        "latest_reading_time": latest_read.time if latest_read else None
    }


# C3. GET /api/villages — returns all villages with current risk score/level & telemetry
@app.get("/api/villages", response_model=List[VillageResponse])
async def get_villages(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Village))
    villages = result.scalars().all()

    response_list = [await _village_payload(db, v) for v in villages]

    # Sort by risk score descending
    response_list.sort(key=lambda x: x["current_risk_score"], reverse=True)
    return response_list


# GET /api/villages/{id} — single settlement, for the village detail page
@app.get("/api/villages/{village_id}", response_model=VillageResponse)
async def get_village(village_id: int, db: AsyncSession = Depends(get_db)):
    village = await db.get(Village, village_id)
    if not village:
        raise HTTPException(status_code=404, detail="Village not found")
    return await _village_payload(db, village)

# C2. POST /api/ingest — accepts reading, computes risk, logs alert if needed, broadcasts via WS
@app.post("/api/ingest")
async def ingest_reading(reading_in: ReadingCreate, db: AsyncSession = Depends(get_db)):
    village = await db.get(Village, reading_in.village_id)
    if not village:
        raise HTTPException(status_code=404, detail="Village not found")

    timestamp = reading_in.time or datetime.datetime.now(datetime.timezone.utc)
    
    # 1. Save reading
    reading = Reading(
        village_id=reading_in.village_id,
        time=timestamp,
        rainfall_mm=reading_in.rainfall_mm,
        rainfall_1h_mm=reading_in.rainfall_1h_mm or (reading_in.rainfall_mm * 1.5),
        rainfall_24h_mm=reading_in.rainfall_24h_mm or (reading_in.rainfall_mm * 3.5),
        soil_moisture_pct=reading_in.soil_moisture_pct,
        pore_water_pressure_kpa=reading_in.pore_water_pressure_kpa or (reading_in.soil_moisture_pct * 0.22),
        vibration_index=reading_in.vibration_index or 0.04,
        water_level_stream_m=reading_in.water_level_stream_m or 0.8,
        source=reading_in.source or "simulator"
    )
    db.add(reading)

    # 2. Run prediction engine
    village_static = {
        "elevation_m": village.elevation_m,
        "avg_slope_deg": village.avg_slope_deg,
        "distance_to_stream_m": village.distance_to_stream_m,
        "drainage_capacity_index": village.drainage_capacity_index,
        "historical_incident_count": village.historical_incident_count
    }
    reading_dict = {
        "rainfall_mm": reading.rainfall_mm,
        "rainfall_1h_mm": reading.rainfall_1h_mm,
        "rainfall_24h_mm": reading.rainfall_24h_mm,
        "soil_moisture_pct": reading.soil_moisture_pct,
        "pore_water_pressure_kpa": reading.pore_water_pressure_kpa,
        "vibration_index": reading.vibration_index
    }

    eval_result = prediction_engine.evaluate_risk(village_static, reading_dict)

    # 3. Save computed risk score
    risk_score_obj = RiskScore(
        village_id=village.id,
        time=timestamp,
        risk_score=eval_result["risk_score"],
        risk_level=eval_result["risk_level"],
        ml_susceptibility=eval_result["ml_susceptibility"],
        intensity_duration_ratio=eval_result["intensity_duration_ratio"],
        estimated_lead_time_hrs=eval_result["estimated_lead_time_hrs"],
        primary_factor=eval_result["primary_factor"],
        model_version="v1.0-hybrid-rf-physics"
    )
    db.add(risk_score_obj)
    await db.commit()

    # 4. Check for Alert Dispatch
    alert_info = await check_and_dispatch_alert(
        village_id=village.id,
        village_name=village.name,
        risk_level=eval_result["risk_level"],
        risk_score=eval_result["risk_score"],
        lead_time_hrs=eval_result["estimated_lead_time_hrs"],
        primary_factor=eval_result["primary_factor"]
    )

    # 5. Real-time WebSocket Broadcast
    broadcast_payload = {
        "event": "telemetry_update",
        "village_id": village.id,
        "village_name": village.name,
        "timestamp": timestamp.isoformat(),
        "reading": {
            "rainfall_mm": reading.rainfall_mm,
            "soil_moisture_pct": reading.soil_moisture_pct,
            "vibration_index": reading.vibration_index,
            "water_level_stream_m": reading.water_level_stream_m
        },
        "risk_evaluation": eval_result,
        "alert": alert_info
    }
    await ws_manager.broadcast_json(broadcast_payload)

    return {
        "status": "ingested",
        "village_id": village.id,
        "risk_evaluation": eval_result,
        "alert_fired": bool(alert_info)
    }

# C4. GET /api/villages/{id}/history — returns rainfall + risk score time-series
@app.get("/api/villages/{village_id}/history")
async def get_village_history(village_id: int, limit: int = 50, db: AsyncSession = Depends(get_db)):
    village = await db.get(Village, village_id)
    if not village:
        raise HTTPException(status_code=404, detail="Village not found")

    r_stmt = (
        select(Reading)
        .where(Reading.village_id == village_id)
        .order_by(desc(Reading.time))
        .limit(limit)
    )
    r_res = await db.execute(r_stmt)
    readings = list(reversed(r_res.scalars().all()))

    k_stmt = (
        select(RiskScore)
        .where(RiskScore.village_id == village_id)
        .order_by(desc(RiskScore.time))
        .limit(limit)
    )
    k_res = await db.execute(k_stmt)
    risks = list(reversed(k_res.scalars().all()))

    # Zip into unified history
    history = []
    for r in readings:
        matched_risk = next((k for k in risks if abs((k.time - r.time).total_seconds()) < 10), None)
        history.append({
            "time": r.time.strftime("%H:%M:%S"),
            "rainfall_mm": r.rainfall_mm,
            "soil_moisture_pct": r.soil_moisture_pct,
            "vibration_index": r.vibration_index,
            "water_level_stream_m": r.water_level_stream_m,
            "risk_score": matched_risk.risk_score if matched_risk else 15.0,
            "risk_level": matched_risk.risk_level if matched_risk else "green",
            "lead_time_hrs": matched_risk.estimated_lead_time_hrs if matched_risk else 12.0
        })

    return {
        "village_id": village_id,
        "village_name": village.name,
        "elevation_m": village.elevation_m,
        "avg_slope_deg": village.avg_slope_deg,
        "distance_to_stream_m": village.distance_to_stream_m,
        "history": history
    }

# Alerts Feed Endpoint
@app.get("/api/alerts", response_model=List[AlertResponse])
async def get_recent_alerts(limit: int = 25, db: AsyncSession = Depends(get_db)):
    stmt = select(Alert).order_by(desc(Alert.fired_at)).limit(limit)
    result = await db.execute(stmt)
    alerts = result.scalars().all()
    
    response = []
    for a in alerts:
        v = await db.get(Village, a.village_id)
        response.append({
            "id": a.id,
            "village_id": a.village_id,
            "village_name": v.name if v else "Unknown Village",
            "fired_at": a.fired_at,
            "risk_level": a.risk_level,
            "risk_score": a.risk_score,
            "channel": a.channel,
            "message_en": a.message_en,
            "message_hi": a.message_hi,
            "estimated_lead_time_hrs": a.estimated_lead_time_hrs,
            "delivered": a.delivered,
            "dispatched_by": a.dispatched_by or "auto-threshold",
            "cap_identifier": a.cap_identifier
        })
    return response


# ============================  SHELTERS & EVACUATION ROUTING  ============================

@app.get("/api/shelters", response_model=List[ShelterResponse])
async def get_shelters(village_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    """Every registered shelter, or only those primarily serving one settlement."""
    stmt = select(Shelter).where(Shelter.is_active == True)  # noqa: E712 - SQL boolean
    if village_id is not None:
        stmt = stmt.where(Shelter.village_id == village_id)
    result = await db.execute(stmt.order_by(desc(Shelter.elevation_m)))
    return result.scalars().all()


@app.get("/api/villages/{village_id}/evacuation")
async def get_evacuation_plan(
    village_id: int,
    radius_km: float = 12.0,
    is_night: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """
    Rank every reachable shelter for one settlement against its CURRENT modelled lead time.

    Candidate set = shelters registered to this village plus any shelter within
    `radius_km`, because in a real evacuation the neighbouring village's ridge school is
    often the better destination. Costing is done by backend/evacuation.py: haversine
    distance, terrain sinuosity, Tobler's hiking function, rain/darkness slowdown and
    footpath congestion. Nothing here is a fixed lookup.
    """
    village = await db.get(Village, village_id)
    if not village:
        raise HTTPException(status_code=404, detail="Village not found")

    latest_risk = (await db.execute(
        select(RiskScore).where(RiskScore.village_id == village_id).order_by(desc(RiskScore.time)).limit(1)
    )).scalar_one_or_none()
    latest_read = (await db.execute(
        select(Reading).where(Reading.village_id == village_id).order_by(desc(Reading.time)).limit(1)
    )).scalar_one_or_none()

    risk_level = latest_risk.risk_level if latest_risk else "green"
    risk_score = latest_risk.risk_score if latest_risk else 15.0
    lead_time_hrs = latest_risk.estimated_lead_time_hrs if latest_risk else 12.0
    rainfall_1h = latest_read.rainfall_1h_mm if latest_read else 0.0

    village_dict = {
        "id": village.id,
        "name": village.name,
        "latitude": village.latitude,
        "longitude": village.longitude,
        "elevation_m": village.elevation_m,
        "population": village.population or 0,
    }

    all_shelters = (await db.execute(
        select(Shelter).where(Shelter.is_active == True)  # noqa: E712
    )).scalars().all()

    # Own shelters always qualify; others must fall inside the search radius.
    radius_m = radius_km * 1000.0
    candidates = []
    for s in all_shelters:
        if s.village_id == village.id:
            candidates.append(s)
            continue
        if haversine_m(village.latitude, village.longitude, s.latitude, s.longitude) <= radius_m:
            candidates.append(s)

    shelter_dicts = [{
        "id": s.id,
        "name": s.name,
        "shelter_type": s.shelter_type,
        "latitude": s.latitude,
        "longitude": s.longitude,
        "elevation_m": s.elevation_m,
        "capacity": s.capacity,
        "contact_phone": s.contact_phone,
        "facilities": s.facilities,
        "is_active": s.is_active,
        "crosses_stream": s.crosses_stream,
        "route_surface": s.route_surface,
        "serves_this_village": s.village_id == village.id,
    } for s in candidates]

    options = rank_evacuation_options(
        village_dict, shelter_dicts,
        rainfall_1h_mm=rainfall_1h,
        lead_time_hrs=lead_time_hrs,
        is_night=is_night
    )
    recommended = options[0] if options else None

    return {
        "village_id": village.id,
        "village_name": village.name,
        "population": village.population or 0,
        "river_basin": village.river_basin or "",
        "risk_level": risk_level,
        "risk_score": risk_score,
        "lead_time_hrs": lead_time_hrs,
        "rainfall_1h_mm": rainfall_1h,
        "is_night": is_night,
        "search_radius_km": radius_km,
        "candidates_considered": len(shelter_dicts),
        "recommended": recommended,
        "options": options,
        "advisory": build_advisory(village.name, recommended, risk_level),
        "model": {
            "speed_model": "Tobler hiking function W = 6*exp(-3.5*|S+0.05|) km/h",
            "distance_model": "Haversine great-circle x terrain sinuosity multiplier",
            "lead_time_safety_fraction": 0.70,
            "route_geometry": "indicative switchback alignment, not a surveyed centreline"
        }
    }


# ==============================  OPERATOR CAP DISPATCH  ==================================

@app.post("/api/alerts/dispatch", response_model=AlertResponse)
async def dispatch_alert(req: AlertDispatchRequest, db: AsyncSession = Depends(get_db)):
    """
    Operator-initiated bilingual CAP alert. This is the real write path behind the control
    room's DISPATCH button: it persists an Alert row with the operator identity and a CAP
    identifier, then broadcasts it on the WebSocket so every connected console updates.

    Unlike the automatic threshold alert in alert_service.py this has NO cooldown and NO
    risk-level gate -- a human has decided to send it, and suppressing a deliberate
    operator dispatch would be the wrong failure mode.
    """
    village = await db.get(Village, req.village_id)
    if not village:
        raise HTTPException(status_code=404, detail="Village not found")

    latest_risk = (await db.execute(
        select(RiskScore).where(RiskScore.village_id == village.id).order_by(desc(RiskScore.time)).limit(1)
    )).scalar_one_or_none()
    latest_read = (await db.execute(
        select(Reading).where(Reading.village_id == village.id).order_by(desc(Reading.time)).limit(1)
    )).scalar_one_or_none()

    risk_level = latest_risk.risk_level if latest_risk else "green"
    risk_score = latest_risk.risk_score if latest_risk else 15.0
    lead_time_hrs = latest_risk.estimated_lead_time_hrs if latest_risk else 12.0
    primary_factor = latest_risk.primary_factor if latest_risk else "Normal Hydrological Baseline"

    now = datetime.datetime.now(datetime.timezone.utc)
    # CAP identifier convention: urn:drainguard:<village-id>:<UTC compact timestamp>
    cap_identifier = f"urn:drainguard:{village.id}:{now.strftime('%Y%m%dT%H%M%SZ')}"

    if req.override_message_en and req.override_message_hi:
        msg_en = req.override_message_en
        msg_hi = req.override_message_hi
    else:
        header_en = "[URGENT EVACUATION WARNING - NDRF/SDMA]" if risk_level == "red" else "[FLOOD WATCH - NDRF/SDMA]"
        header_hi = "[आपातकालीन चेतावनी - एनडीआरएफ / राज्य आपदा प्रबंधन]" if risk_level == "red" else "[बाढ़ निगरानी - एनडीआरएफ / राज्य आपदा प्रबंधन]"
        msg_en = (
            f"{header_en} {village.name}, {village.district}: flash-flood risk {risk_score:.0f}/100. "
            f"Estimated window {lead_time_hrs:.1f} h. Driver: {primary_factor}. "
            f"Population at risk approx {village.population or 0}. Helpline 1070."
        )
        msg_hi = (
            f"{header_hi} {village.name}, {village.district}: बाढ़ जोखिम {risk_score:.0f}/100। "
            f"अनुमानित समय {lead_time_hrs:.1f} घंटे। कारण: {translate_primary_factor(primary_factor)}। "
            f"अनुमानित प्रभावित जनसंख्या {village.population or 0}। हेल्पलाइन 1070।"
        )

        if req.include_evacuation_advisory:
            plan = await get_evacuation_plan(village.id, db=db)
            advisory = plan["advisory"]
            msg_en = f"{msg_en} {advisory['en']}"
            msg_hi = f"{msg_hi} {advisory['hi']}"

    alert = Alert(
        village_id=village.id,
        fired_at=now,
        risk_level=risk_level,
        risk_score=risk_score,
        channel=req.channel,
        message_en=msg_en,
        message_hi=msg_hi,
        estimated_lead_time_hrs=lead_time_hrs,
        delivered=True,
        dispatched_by=req.dispatched_by,
        cap_identifier=cap_identifier,
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)

    await ws_manager.broadcast_json({
        "event": "alert_dispatched",
        "village_id": village.id,
        "village_name": village.name,
        "risk_level": risk_level,
        "risk_score": risk_score,
        "channel": req.channel,
        "dispatched_by": req.dispatched_by,
        "cap_identifier": cap_identifier,
        "message_en": msg_en,
        "message_hi": msg_hi,
        "timestamp": now.isoformat(),
    })

    return {
        "id": alert.id,
        "village_id": alert.village_id,
        "village_name": village.name,
        "fired_at": alert.fired_at,
        "risk_level": alert.risk_level,
        "risk_score": alert.risk_score,
        "channel": alert.channel,
        "message_en": alert.message_en,
        "message_hi": alert.message_hi,
        "estimated_lead_time_hrs": alert.estimated_lead_time_hrs,
        "delivered": alert.delivered,
        "dispatched_by": alert.dispatched_by,
        "cap_identifier": alert.cap_identifier,
    }


# ===========================  HISTORICAL EVENT BACKTEST  ================================
# NOTE: the literal /events route MUST be declared before /{event_id}, otherwise Starlette
# matches "events" as an event id.

@app.get("/api/backtest/events")
async def list_backtest_events():
    """Catalogue of replayable historical disasters, plus the headline result for each."""
    return {
        "catalogue": event_catalogue(),
        "results": run_all_backtests(),
    }


@app.get("/api/backtest/{event_id}")
async def run_event_backtest(event_id: str):
    """
    Replay one documented event through the shipped prediction engine and report when it
    would have gone yellow and red. See data/historical_events.py for input provenance --
    the timelines are reconstructions consistent with published totals, not raw gauge data.
    """
    result = run_backtest(event_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Unknown historical event '{event_id}'")
    return result

# C6. POST /api/demo/storm — triggers storm mode simulation
@app.post("/api/demo/storm")
async def trigger_storm_scenario(req: StormTriggerRequest, db: AsyncSession = Depends(get_db)):
    active_storm_state["is_active"] = True
    active_storm_state["intensity"] = req.intensity or "extreme"
    active_storm_state["started_at"] = datetime.datetime.now(datetime.timezone.utc)
    if req.village_ids:
        active_storm_state["target_villages"] = req.village_ids

    # Broadcast storm trigger event to all clients
    await ws_manager.broadcast_json({
        "event": "storm_scenario_triggered",
        "intensity": active_storm_state["intensity"],
        "target_villages": active_storm_state["target_villages"],
        "message": "Cloudburst & storm scenario activated across catchment area!"
    })

    # Rapidly inject escalating telemetry to demonstrate immediate risk spike
    villages = (await db.execute(select(Village))).scalars().all()
    target_villages = [v for v in villages if v.id in active_storm_state["target_villages"]]
    
    injected_results = []
    for v in target_villages:
        # High intensity cloudburst reading
        reading_in = ReadingCreate(
            village_id=v.id,
            rainfall_mm=req.target_rainfall_rate_mm_hr or 92.5,
            rainfall_1h_mm=75.0,
            rainfall_24h_mm=140.0,
            soil_moisture_pct=req.target_soil_moisture_pct or 91.0,
            pore_water_pressure_kpa=26.5,
            vibration_index=0.62,
            water_level_stream_m=3.8,
            source="cloudburst-simulator-trigger"
        )
        res = await ingest_reading(reading_in, db)
        injected_results.append(res)

    return {
        "status": "storm_scenario_active",
        "intensity": active_storm_state["intensity"],
        "target_villages_count": len(target_villages),
        "escalated_villages": injected_results
    }

@app.post("/api/demo/reset")
async def reset_demo_scenario(db: AsyncSession = Depends(get_db)):
    active_storm_state["is_active"] = False
    active_storm_state["started_at"] = None

    villages = (await db.execute(select(Village))).scalars().all()
    for v in villages:
        reading_in = ReadingCreate(
            village_id=v.id,
            rainfall_mm=0.2,
            rainfall_1h_mm=1.5,
            rainfall_24h_mm=10.0,
            soil_moisture_pct=22.0,
            pore_water_pressure_kpa=4.5,
            vibration_index=0.03,
            water_level_stream_m=0.8,
            source="normal-baseline-reset"
        )
        await ingest_reading(reading_in, db)

    await ws_manager.broadcast_json({
        "event": "scenario_reset",
        "message": "Demo reset to normal baseline conditions."
    })

    return {"status": "reset_to_baseline"}

# C5. WebSocket endpoint /ws/risk
@app.websocket("/ws/risk")
async def websocket_risk_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        # Send initial connection greeting
        await websocket.send_json({
            "event": "connected",
            "message": "Real-time Flash Flood Risk Channel Connected",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        })
        while True:
            # Keep-alive receive
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)
