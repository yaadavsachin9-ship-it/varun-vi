from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class ReadingCreate(BaseModel):
    village_id: int
    rainfall_mm: float = Field(default=0.0, description="Current minute/instant rainfall in mm")
    rainfall_1h_mm: Optional[float] = Field(default=0.0, description="1-hour cumulative rainfall in mm")
    rainfall_24h_mm: Optional[float] = Field(default=0.0, description="24-hour antecedent rainfall in mm")
    soil_moisture_pct: float = Field(default=20.0, ge=0.0, le=100.0, description="Volumetric soil moisture percentage")
    pore_water_pressure_kpa: Optional[float] = Field(default=5.0, description="Piezometer pore water pressure in kPa")
    vibration_index: Optional[float] = Field(default=0.05, ge=0.0, description="Seismic/geophone vibration index")
    water_level_stream_m: Optional[float] = Field(default=0.8, description="River/stream water level in meters")
    source: Optional[str] = "simulator"
    time: Optional[datetime] = None

class ReadingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    time: datetime
    village_id: int
    rainfall_mm: float
    rainfall_1h_mm: float
    rainfall_24h_mm: float
    soil_moisture_pct: float
    pore_water_pressure_kpa: float
    vibration_index: float
    water_level_stream_m: float
    source: str

class RiskScoreResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    time: datetime
    village_id: int
    risk_score: float
    risk_level: str
    ml_susceptibility: float
    intensity_duration_ratio: float
    estimated_lead_time_hrs: float
    primary_factor: str
    model_version: str

class VillageBase(BaseModel):
    name: str
    district: str
    state: str
    latitude: float
    longitude: float
    boundary_geojson: Optional[str] = None
    elevation_m: float
    avg_slope_deg: float
    distance_to_stream_m: float
    soil_type: str = "Loamy Silt"
    drainage_capacity_index: float = 0.65
    historical_incident_count: int = 0
    population: int = 0
    river_basin: str = ""

class VillageCreate(VillageBase):
    pass

class VillageResponse(VillageBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    current_risk_score: Optional[float] = 15.0
    current_risk_level: Optional[str] = "green"
    current_lead_time_hrs: Optional[float] = 12.0
    latest_rainfall_mm: Optional[float] = 0.0
    latest_soil_moisture_pct: Optional[float] = 20.0
    latest_vibration_index: Optional[float] = 0.05
    latest_stream_level_m: Optional[float] = 0.8
    latest_primary_factor: Optional[str] = "Normal Hydrological Conditions"
    latest_reading_time: Optional[datetime] = None

class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    village_id: int
    village_name: Optional[str] = None
    fired_at: datetime
    risk_level: str
    risk_score: float
    channel: str
    message_en: str
    message_hi: str
    estimated_lead_time_hrs: float
    delivered: bool
    dispatched_by: Optional[str] = "auto-threshold"
    cap_identifier: Optional[str] = None


class ShelterResponse(BaseModel):
    """A designated high-ground relief shelter."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    village_id: int
    shelter_type: str
    latitude: float
    longitude: float
    elevation_m: float
    capacity: int
    contact_phone: str
    facilities: str
    is_active: bool
    crosses_stream: bool
    route_surface: str


class AlertDispatchRequest(BaseModel):
    """
    Operator-initiated CAP dispatch. Unlike the automatic threshold alert, this is an
    explicit human decision, so `dispatched_by` is recorded on the alert row.
    """
    village_id: int
    channel: str = Field(default="sachet_cap", description="'sms' | 'sachet_cap' | 'dashboard'")
    dispatched_by: str = Field(default="control-room-operator", description="Operator identity for the audit trail")
    override_message_en: Optional[str] = Field(default=None, description="Replaces the generated English body")
    override_message_hi: Optional[str] = Field(default=None, description="Replaces the generated Hindi body")
    include_evacuation_advisory: bool = Field(default=True, description="Append the ranked shelter advisory")


class StormTriggerRequest(BaseModel):
    village_ids: Optional[List[int]] = None
    intensity: Optional[str] = "extreme"
    zone: Optional[str] = Field(default=None, description="Demo target zone: green, yellow, or red")
    ramp_duration_seconds: Optional[int] = 30
    target_rainfall_rate_mm_hr: Optional[float] = 95.0
    target_soil_moisture_pct: Optional[float] = 92.0
