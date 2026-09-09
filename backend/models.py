import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.database import Base

class Village(Base):
    __tablename__ = "villages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True, index=True)
    district = Column(String(100), default="Chamoli")
    state = Column(String(100), default="Uttarakhand")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    boundary_geojson = Column(Text, nullable=True) # GeoJSON representation of polygon
    elevation_m = Column(Float, default=1800.0)
    avg_slope_deg = Column(Float, default=32.0)
    distance_to_stream_m = Column(Float, default=120.0)
    soil_type = Column(String(100), default="Loamy Silt")
    drainage_capacity_index = Column(Float, default=0.65) # 0.0 to 1.0
    historical_incident_count = Column(Integer, default=0)
    population = Column(Integer, default=0)          # census/estimated resident population at risk
    river_basin = Column(String(100), default="")    # named river/stream the settlement sits on
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.now(datetime.timezone.utc))

    readings = relationship("Reading", back_populates="village", cascade="all, delete-orphan")
    risk_scores = relationship("RiskScore", back_populates="village", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="village", cascade="all, delete-orphan")
    shelters = relationship("Shelter", back_populates="village", cascade="all, delete-orphan")


class Reading(Base):
    __tablename__ = "readings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    time = Column(DateTime(timezone=True), nullable=False, index=True, default=datetime.datetime.now(datetime.timezone.utc))
    village_id = Column(Integer, ForeignKey("villages.id", ondelete="CASCADE"), nullable=False, index=True)
    rainfall_mm = Column(Float, default=0.0)
    rainfall_1h_mm = Column(Float, default=0.0)
    rainfall_24h_mm = Column(Float, default=0.0)
    soil_moisture_pct = Column(Float, default=20.0)
    pore_water_pressure_kpa = Column(Float, default=5.0)
    vibration_index = Column(Float, default=0.05) # geophone/accelerometer seismic trigger index
    water_level_stream_m = Column(Float, default=0.8)
    source = Column(String(50), default="simulator") # 'imd', 'open-meteo', 'simulator', 'iot-lora'

    village = relationship("Village", back_populates="readings")


class RiskScore(Base):
    __tablename__ = "risk_scores"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    time = Column(DateTime(timezone=True), nullable=False, index=True, default=datetime.datetime.now(datetime.timezone.utc))
    village_id = Column(Integer, ForeignKey("villages.id", ondelete="CASCADE"), nullable=False, index=True)
    risk_score = Column(Float, nullable=False) # 0.0 to 100.0
    risk_level = Column(String(20), nullable=False) # 'green', 'yellow', 'red'
    ml_susceptibility = Column(Float, default=0.1) # 0.0 to 1.0 from ML model
    intensity_duration_ratio = Column(Float, default=0.2) # ratio vs physical ID threshold
    estimated_lead_time_hrs = Column(Float, default=12.0)
    primary_factor = Column(String(100), default="Normal Hydrological Conditions")
    model_version = Column(String(50), default="v1.0-hybrid-rf-physics")

    village = relationship("Village", back_populates="risk_scores")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    village_id = Column(Integer, ForeignKey("villages.id", ondelete="CASCADE"), nullable=False, index=True)
    fired_at = Column(DateTime(timezone=True), default=datetime.datetime.now(datetime.timezone.utc))
    risk_level = Column(String(20), nullable=False) # 'yellow', 'red'
    risk_score = Column(Float, nullable=False)
    channel = Column(String(50), default="sms") # 'sms', 'sachet_cap', 'dashboard'
    message_en = Column(Text, nullable=False)
    message_hi = Column(Text, nullable=False)
    estimated_lead_time_hrs = Column(Float, default=2.0)
    delivered = Column(Boolean, default=True)
    dispatched_by = Column(String(120), default="auto-threshold") # 'auto-threshold' or an operator identity
    cap_identifier = Column(String(120), nullable=True)           # CAP/SACHET message identifier

    village = relationship("Village", back_populates="alerts")


class Shelter(Base):
    """
    Designated high-ground relief shelter / evacuation destination.

    Shelters are real-world safe-haven categories used by SDMA in hill districts:
    schools on ridge terraces, temple complexes, ITBP/army posts, and helipads.
    `village_id` is the primary settlement this shelter serves; a shelter can still be
    offered to neighbouring villages when it scores better on the evacuation cost model.
    """
    __tablename__ = "shelters"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(150), nullable=False)
    village_id = Column(Integer, ForeignKey("villages.id", ondelete="CASCADE"), nullable=False, index=True)
    shelter_type = Column(String(60), default="school")  # 'school' | 'temple' | 'army_post' | 'helipad' | 'community_hall'
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    elevation_m = Column(Float, default=2000.0)
    capacity = Column(Integer, default=200)
    contact_phone = Column(String(40), default="1070")
    facilities = Column(String(255), default="Shelter, Drinking water, First aid")
    is_active = Column(Boolean, default=True)
    # Terrain characteristics of the approach route, used by the evacuation cost model
    crosses_stream = Column(Boolean, default=False)  # route must ford/bridge the hazard channel
    route_surface = Column(String(40), default="motorable")  # 'motorable' | 'footpath' | 'mule_track'

    village = relationship("Village", back_populates="shelters")

