"""
Seed Villages & Ward Boundaries Dataset (Trans-Boundary Himalayan Network: India & Nepal)
SIH 2026 Problem ID: 26192 - Flash Flood Prediction System for Hilly Regions
Covers Chamoli Valley (Uttarakhand, India) and Western/Central Nepal River Catchments

Coordinates, elevations and river basins are real. Slope, soil type, drainage index and
`population` are ORDER-OF-MAGNITUDE ESTIMATES for the settlement, used to weight exposure
in the risk and evacuation models -- they are not authoritative Census 2011 / Nepal CBS
ward figures. Replace them with the official ward-level tables before any operational use.
"""

import asyncio
import json
import os
import sys
from shapely.geometry import Polygon, mapping

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.database import AsyncSessionLocal
from backend.models import Village, Reading, RiskScore
from sqlalchemy import select

def create_village_polygon(lat: float, lon: float, radius_deg: float = 0.015, jitter: float = 0.004):
    """
    Creates a realistic multi-vertex polygon for a village boundary in hilly terrain.
    """
    coords = [
        [lon - radius_deg + jitter, lat - radius_deg/2],
        [lon - radius_deg/2, lat - radius_deg - jitter],
        [lon + radius_deg/3, lat - radius_deg + jitter],
        [lon + radius_deg + jitter, lat - radius_deg/3],
        [lon + radius_deg, lat + radius_deg/2],
        [lon + radius_deg/2 - jitter, lat + radius_deg + jitter],
        [lon - radius_deg/3, lat + radius_deg],
        [lon - radius_deg, lat + radius_deg/3 - jitter],
        [lon - radius_deg + jitter, lat - radius_deg/2], # close polygon
    ]
    poly = Polygon(coords)
    return json.dumps(mapping(poly))

VILLAGE_DATA = [
    # --- Chamoli & Alaknanda Corridor (Uttarakhand, India) ---
    {
        "name": "Raini (Rishiganga Confluence)",
        "district": "Chamoli",
        "state": "Uttarakhand, India",
        "latitude": 30.4852,
        "longitude": 79.6978,
        "elevation_m": 2050.0,
        "avg_slope_deg": 44.5,
        "distance_to_stream_m": 35.0,
        "population": 250,
        "river_basin": "Rishiganga - Dhauliganga confluence",
        "soil_type": "Glacio-fluvial Gravel & Silt",
        "drainage_capacity_index": 0.45,
        "historical_incident_count": 6,
    },
    {
        "name": "Tapovan Valley",
        "district": "Chamoli",
        "state": "Uttarakhand, India",
        "latitude": 30.4930,
        "longitude": 79.6280,
        "elevation_m": 1820.0,
        "avg_slope_deg": 38.0,
        "distance_to_stream_m": 45.0,
        "population": 1100,
        "river_basin": "Dhauliganga",
        "soil_type": "Colluvial Silt Clay",
        "drainage_capacity_index": 0.52,
        "historical_incident_count": 4,
    },
    {
        "name": "Joshimath Ward-1 (Sunil / Marwari)",
        "district": "Chamoli",
        "state": "Uttarakhand, India",
        "latitude": 30.5562,
        "longitude": 79.5645,
        "elevation_m": 2150.0,
        "avg_slope_deg": 36.2,
        "distance_to_stream_m": 180.0,
        "population": 2400,
        "river_basin": "Alaknanda (above Dhauliganga confluence)",
        "soil_type": "Morainic Debris & Fractured Gneiss",
        "drainage_capacity_index": 0.58,
        "historical_incident_count": 5,
    },
    {
        "name": "Joshimath Ward-2 (Singhdhar)",
        "district": "Chamoli",
        "state": "Uttarakhand, India",
        "latitude": 30.5610,
        "longitude": 79.5710,
        "elevation_m": 1980.0,
        "avg_slope_deg": 39.8,
        "distance_to_stream_m": 210.0,
        "population": 1900,
        "river_basin": "Alaknanda",
        "soil_type": "Fractured Quartzite & Silt",
        "drainage_capacity_index": 0.50,
        "historical_incident_count": 4,
    },
    {
        "name": "Helang (Alaknanda Gorge)",
        "district": "Chamoli",
        "state": "Uttarakhand, India",
        "latitude": 30.5290,
        "longitude": 79.5080,
        "elevation_m": 1520.0,
        "avg_slope_deg": 42.1,
        "distance_to_stream_m": 70.0,
        "population": 800,
        "river_basin": "Alaknanda",
        "soil_type": "Debris Flow Colluvium",
        "drainage_capacity_index": 0.48,
        "historical_incident_count": 5,
    },
    {
        "name": "Pipalkoti Terrace",
        "district": "Chamoli",
        "state": "Uttarakhand, India",
        "latitude": 30.4310,
        "longitude": 79.4320,
        "elevation_m": 1330.0,
        "avg_slope_deg": 28.5,
        "distance_to_stream_m": 90.0,
        "population": 2600,
        "river_basin": "Alaknanda",
        "soil_type": "Riverine Terraced Alluvium",
        "drainage_capacity_index": 0.72,
        "historical_incident_count": 2,
    },
    {
        "name": "Pandukeshwar",
        "district": "Chamoli",
        "state": "Uttarakhand, India",
        "latitude": 30.6380,
        "longitude": 79.5530,
        "elevation_m": 1880.0,
        "avg_slope_deg": 35.0,
        "distance_to_stream_m": 60.0,
        "population": 1200,
        "river_basin": "Alaknanda",
        "soil_type": "Fluvial Boulder Bed & Loam",
        "drainage_capacity_index": 0.60,
        "historical_incident_count": 3,
    },
    {
        "name": "Govindghat Junction",
        "district": "Chamoli",
        "state": "Uttarakhand, India",
        "latitude": 30.6250,
        "longitude": 79.5600,
        "elevation_m": 1800.0,
        "avg_slope_deg": 41.0,
        "distance_to_stream_m": 40.0,
        "population": 950,
        "river_basin": "Alaknanda - Laxman Ganga confluence",
        "soil_type": "Confluence Gravel & Debris",
        "drainage_capacity_index": 0.46,
        "historical_incident_count": 5,
    },
    {
        "name": "Mana Village (Border Post)",
        "district": "Chamoli",
        "state": "Uttarakhand, India",
        "latitude": 30.7680,
        "longitude": 79.4930,
        "elevation_m": 3200.0,
        "avg_slope_deg": 33.0,
        "distance_to_stream_m": 85.0,
        "population": 600,
        "river_basin": "Saraswati - Alaknanda headwaters",
        "soil_type": "High Altitude Periglacial Talus",
        "drainage_capacity_index": 0.68,
        "historical_incident_count": 2,
    },
    {
        "name": "Badrinath Valley Town",
        "district": "Chamoli",
        "state": "Uttarakhand, India",
        "latitude": 30.7433,
        "longitude": 79.4938,
        "elevation_m": 3100.0,
        "avg_slope_deg": 24.0,
        "distance_to_stream_m": 50.0,
        "population": 2400,
        "river_basin": "Alaknanda",
        "soil_type": "U-Shaped Valley Outwash",
        "drainage_capacity_index": 0.65,
        "historical_incident_count": 3,
    },
    {
        "name": "Urgam Valley",
        "district": "Chamoli",
        "state": "Uttarakhand, India",
        "latitude": 30.5480,
        "longitude": 79.4720,
        "elevation_m": 2200.0,
        "avg_slope_deg": 34.5,
        "distance_to_stream_m": 110.0,
        "population": 1500,
        "river_basin": "Kalpganga",
        "soil_type": "Terraced Loamy Silt",
        "drainage_capacity_index": 0.62,
        "historical_incident_count": 2,
    },
    {
        "name": "Tharali (Pindar Valley)",
        "district": "Chamoli",
        "state": "Uttarakhand, India",
        "latitude": 30.0810,
        "longitude": 79.4980,
        "elevation_m": 1280.0,
        "avg_slope_deg": 31.0,
        "distance_to_stream_m": 55.0,
        "population": 3100,
        "river_basin": "Pindar",
        "soil_type": "Pindar Basin Alluvial Clay",
        "drainage_capacity_index": 0.58,
        "historical_incident_count": 4,
    },

    # --- Western & Central Nepal Trans-Boundary Catchments ---
    {
        "name": "Darchula (Mahakali Gorge)",
        "district": "Darchula",
        "state": "Sudurpashchim, Nepal",
        "latitude": 29.8410,
        "longitude": 80.5360,
        "elevation_m": 1750.0,
        "avg_slope_deg": 43.0,
        "distance_to_stream_m": 25.0, # High risk Mahakali river bank
        "population": 2800,
        "river_basin": "Mahakali (Sharda)",
        "soil_type": "Fissured Schist & Riverine Talus",
        "drainage_capacity_index": 0.44,
        "historical_incident_count": 5,
    },
    {
        "name": "Baitadi Foothills",
        "district": "Baitadi",
        "state": "Sudurpashchim, Nepal",
        "latitude": 29.5300,
        "longitude": 80.4200,
        "elevation_m": 1660.0,
        "avg_slope_deg": 38.5,
        "distance_to_stream_m": 60.0,
        "population": 2200,
        "river_basin": "Surnaya Gad (Mahakali basin)",
        "soil_type": "Colluvial Silt Loam",
        "drainage_capacity_index": 0.55,
        "historical_incident_count": 3,
    },
    {
        "name": "Jumla (Upper Karnali Valley)",
        "district": "Jumla",
        "state": "Karnali, Nepal",
        "latitude": 29.2740,
        "longitude": 82.1840,
        "elevation_m": 2514.0,
        "avg_slope_deg": 36.0,
        "distance_to_stream_m": 75.0,
        "population": 4500,
        "river_basin": "Tila Karnali",
        "soil_type": "Glacial Till & Sandy Loam",
        "drainage_capacity_index": 0.62,
        "historical_incident_count": 3,
    },
    {
        "name": "Pokhara (Seti Gandaki Gorge)",
        "district": "Kaski",
        "state": "Gandaki, Nepal",
        "latitude": 28.2096,
        "longitude": 83.9856,
        "elevation_m": 822.0,
        "avg_slope_deg": 32.0,
        "distance_to_stream_m": 40.0,
        "population": 6800,   # gorge-adjacent exposed wards only, not all of Pokhara city
        "river_basin": "Seti Gandaki",
        "soil_type": "Calcareous Silt & Boulder Conglomerate",
        "drainage_capacity_index": 0.50,
        "historical_incident_count": 4, # Site of catastrophic Seti flash flood
    },
    {
        "name": "Jomsom (Kali Gandaki Gorge)",
        "district": "Mustang",
        "state": "Gandaki, Nepal",
        "latitude": 28.7800,
        "longitude": 83.7400,
        "elevation_m": 2743.0,
        "avg_slope_deg": 39.5,
        "distance_to_stream_m": 50.0,
        "population": 1700,
        "river_basin": "Kali Gandaki",
        "soil_type": "Rain-Shadow Talus & Gravel",
        "drainage_capacity_index": 0.64,
        "historical_incident_count": 3,
    },
    {
        "name": "Melamchi Valley",
        "district": "Sindhupalchok",
        "state": "Bagmati, Nepal",
        "latitude": 27.8300,
        "longitude": 85.5800,
        "elevation_m": 1200.0,
        "avg_slope_deg": 45.2,
        "distance_to_stream_m": 30.0,
        "population": 3400,
        "river_basin": "Melamchi Khola (Indrawati basin)",
        "soil_type": "Debris Flow Silt & Boulders",
        "drainage_capacity_index": 0.42,
        "historical_incident_count": 6, # Extreme 2021 Melamchi flash flood
    },
    {
        "name": "Tatopani (Bhotekoshi Gorge)",
        "district": "Sindhupalchok",
        "state": "Bagmati, Nepal",
        "latitude": 27.9480,
        "longitude": 85.9400,
        "elevation_m": 1350.0,
        "avg_slope_deg": 46.0,
        "distance_to_stream_m": 35.0,
        "population": 1900,
        "river_basin": "Bhote Koshi",
        "soil_type": "Deep Valley Faulted Quartzite",
        "drainage_capacity_index": 0.40,
        "historical_incident_count": 5, # Glacial lake outburst flood (GLOF) corridor
    }
]

async def seed_villages():
    print("Seeding India & Nepal Himalayan catchment stations into database...")
    async with AsyncSessionLocal() as session:
        for vdata in VILLAGE_DATA:
            stmt = select(Village).where(Village.name == vdata["name"])
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()
            
            poly_geojson = create_village_polygon(vdata["latitude"], vdata["longitude"])
            
            if not existing:
                village = Village(
                    name=vdata["name"],
                    district=vdata["district"],
                    state=vdata["state"],
                    latitude=vdata["latitude"],
                    longitude=vdata["longitude"],
                    boundary_geojson=poly_geojson,
                    elevation_m=vdata["elevation_m"],
                    avg_slope_deg=vdata["avg_slope_deg"],
                    distance_to_stream_m=vdata["distance_to_stream_m"],
                    soil_type=vdata["soil_type"],
                    drainage_capacity_index=vdata["drainage_capacity_index"],
                    historical_incident_count=vdata["historical_incident_count"],
                    population=vdata["population"],
                    river_basin=vdata["river_basin"]
                )
                session.add(village)
                await session.flush()
                
                # Add initial normal reading
                reading = Reading(
                    village_id=village.id,
                    rainfall_mm=0.4,
                    rainfall_1h_mm=2.0,
                    rainfall_24h_mm=14.0,
                    soil_moisture_pct=26.5,
                    pore_water_pressure_kpa=5.2,
                    vibration_index=0.04,
                    water_level_stream_m=0.90,
                    source="simulator"
                )
                session.add(reading)
                
                # Add initial risk score
                risk = RiskScore(
                    village_id=village.id,
                    risk_score=15.0 + (vdata["historical_incident_count"] * 2.2),
                    risk_level="green",
                    ml_susceptibility=0.15,
                    intensity_duration_ratio=0.12,
                    estimated_lead_time_hrs=16.5,
                    primary_factor="Normal Hydrological Conditions"
                )
                session.add(risk)
            else:
                # Update state/district information
                existing.district = vdata["district"]
                existing.state = vdata["state"]
                existing.latitude = vdata["latitude"]
                existing.longitude = vdata["longitude"]
                existing.elevation_m = vdata["elevation_m"]
                existing.avg_slope_deg = vdata["avg_slope_deg"]
                existing.distance_to_stream_m = vdata["distance_to_stream_m"]
                existing.boundary_geojson = poly_geojson
                existing.population = vdata["population"]
                existing.river_basin = vdata["river_basin"]
                
        await session.commit()
    print(f"Successfully seeded/updated {len(VILLAGE_DATA)} India & Nepal stations with boundary polygons and baseline readings!")

if __name__ == "__main__":
    asyncio.run(seed_villages())
