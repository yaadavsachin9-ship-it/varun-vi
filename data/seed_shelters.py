"""
Seed Designated Relief Shelters (High-Ground Evacuation Destinations)
SIH 2026 Problem ID: 26192 - Flash Flood Prediction System for Hilly Regions

Each row is a candidate safe haven for one seeded settlement, in the categories SDMA and
DDMA actually use in hill districts: ridge-terrace schools and colleges, temple and
gurudwara precincts, ITBP / army posts, municipal halls and helipads.

PROVENANCE: the settlements, institutions and helipads named here exist, and each shelter
is placed uphill of its village on the correct side of the valley. The exact coordinates,
elevations and capacities are ESTIMATES sufficient to exercise the evacuation cost model --
this is not the official DDMA shelter register. Before operational use, replace this table
with the district's notified relief-centre list and its surveyed capacities.

`crosses_stream=True` marks an approach that must ford or bridge the hazard channel. The
evacuation model penalises those heavily, because crossing the flooding channel is the
classic fatal mistake; they stay in the table so the ranking has something to reject.

Contact numbers are the published emergency lines -- 1070 (Uttarakhand SEOC), 1077
(District EOC), 1149 (Nepal NEOC) -- never personal numbers.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.database import AsyncSessionLocal
from backend.models import Shelter, Village
from sqlalchemy import select

# (village_name, shelter_name, type, lat, lon, elevation_m, capacity, surface, crosses_stream, phone, facilities)
SHELTER_DATA = [
    # --- Chamoli & Alaknanda Corridor (Uttarakhand, India) ---
    ("Raini (Rishiganga Confluence)", "Raini Ridge Primary School", "school", 30.4890, 79.6935, 2145.0, 180, "footpath", False, "1077", "Hall, Drinking water, First aid"),
    ("Raini (Rishiganga Confluence)", "Peng Ridge Helipad (Raini)", "helipad", 30.4795, 79.7040, 2260.0, 60, "mule_track", True, "1070", "Helipad, Radio set, Tarpaulin"),
    ("Tapovan Valley", "Tapovan Govt. Inter College", "school", 30.4968, 79.6238, 1905.0, 400, "motorable", False, "1077", "Classrooms, Kitchen, Drinking water, Toilets"),
    ("Tapovan Valley", "ITBP Tapovan Post", "army_post", 30.4885, 79.6205, 1990.0, 250, "motorable", False, "1070", "Medical room, Rations, Satellite phone, Generator"),
    ("Joshimath Ward-1 (Sunil / Marwari)", "Joshimath Govt. Inter College", "school", 30.5598, 79.5602, 2245.0, 700, "motorable", False, "1077", "Classrooms, Kitchen, Blankets, Toilets"),
    ("Joshimath Ward-1 (Sunil / Marwari)", "Narsingh Temple Complex", "temple", 30.5540, 79.5680, 2210.0, 300, "footpath", False, "1070", "Covered hall, Drinking water, Community kitchen"),
    ("Joshimath Ward-2 (Singhdhar)", "Auli Ropeway Base Terminal Yard", "community_hall", 30.5648, 79.5675, 2090.0, 350, "motorable", False, "1077", "Sheltered yard, Generator, First aid"),
    ("Joshimath Ward-2 (Singhdhar)", "Singhdhar Panchayat Bhawan (ridge)", "community_hall", 30.5585, 79.5752, 2045.0, 150, "footpath", False, "1070", "Hall, Drinking water, Blankets"),
    ("Helang (Alaknanda Gorge)", "Helang Ridge Junior High School", "school", 30.5325, 79.5042, 1625.0, 220, "mule_track", False, "1077", "Classrooms, Drinking water, First aid"),
    ("Helang (Alaknanda Gorge)", "Urgam Road Helipad Clearing", "helipad", 30.5348, 79.5115, 1700.0, 80, "motorable", True, "1070", "Helipad, Radio set"),
    ("Pipalkoti Terrace", "Pipalkoti Govt. Inter College", "school", 30.4345, 79.4282, 1410.0, 600, "motorable", False, "1077", "Classrooms, Kitchen, Toilets, Drinking water"),
    ("Pipalkoti Terrace", "Pipalkoti Community Hall (upper bazaar)", "community_hall", 30.4288, 79.4355, 1380.0, 250, "motorable", False, "1070", "Hall, Blankets, First aid"),
    ("Pandukeshwar", "Yogdhyan Badri Temple Complex", "temple", 30.6415, 79.5492, 1955.0, 300, "footpath", False, "1077", "Covered hall, Community kitchen, Drinking water"),
    ("Pandukeshwar", "Pandukeshwar Primary School (ridge)", "school", 30.6350, 79.5578, 1990.0, 160, "mule_track", False, "1070", "Classrooms, First aid"),
    ("Govindghat Junction", "Govindghat Gurudwara Sahib", "temple", 30.6285, 79.5562, 1865.0, 800, "motorable", False, "1077", "Langar kitchen, Dormitory, Medical room, Generator"),
    ("Govindghat Junction", "Pulna Trailhead Helipad", "helipad", 30.6215, 79.5648, 1940.0, 70, "mule_track", True, "1070", "Helipad, Radio set"),
    ("Mana Village (Border Post)", "Mana ITBP Border Post", "army_post", 30.7712, 79.4895, 3310.0, 200, "motorable", False, "1070", "Heated shelter, Rations, Satellite phone, Medical room"),
    ("Mana Village (Border Post)", "Mana Primary School (upper lane)", "school", 30.7655, 79.4968, 3255.0, 120, "footpath", False, "1077", "Classrooms, Blankets, Drinking water"),
    ("Badrinath Valley Town", "Badrinath Temple Precinct", "temple", 30.7452, 79.4915, 3145.0, 1200, "motorable", False, "1077", "Covered halls, Community kitchen, Medical post, Toilets"),
    ("Badrinath Valley Town", "Badrinath Helipad", "helipad", 30.7398, 79.4975, 3180.0, 150, "motorable", True, "1070", "Helipad, Radio set, Generator"),
    ("Urgam Valley", "Kalpeshwar Temple Terrace", "temple", 30.5515, 79.4682, 2290.0, 200, "footpath", False, "1077", "Covered hall, Drinking water, Community kitchen"),
    ("Urgam Valley", "Urgam Govt. Junior High School", "school", 30.5448, 79.4762, 2255.0, 180, "mule_track", False, "1070", "Classrooms, First aid, Blankets"),
    ("Tharali (Pindar Valley)", "Tharali Govt. Inter College", "school", 30.0845, 79.4942, 1365.0, 650, "motorable", False, "1077", "Classrooms, Kitchen, Toilets, Drinking water"),
    ("Tharali (Pindar Valley)", "Tharali Block Office Compound", "community_hall", 30.0778, 79.5018, 1330.0, 300, "motorable", False, "1070", "Hall, Generator, First aid"),

    # --- Western & Central Nepal Trans-Boundary Catchments ---
    ("Darchula (Mahakali Gorge)", "Darchula District Hospital Compound", "community_hall", 29.8445, 80.5322, 1840.0, 400, "motorable", False, "1149", "Medical wards, Drinking water, Generator"),
    ("Darchula (Mahakali Gorge)", "Khalanga Secondary School (ridge)", "school", 29.8378, 80.5405, 1895.0, 350, "mule_track", False, "1149", "Classrooms, Kitchen, Toilets"),
    ("Baitadi Foothills", "Dasharathchand Municipality Hall", "community_hall", 29.5335, 80.4162, 1745.0, 450, "motorable", False, "1149", "Hall, Drinking water, Blankets, Generator"),
    ("Baitadi Foothills", "Baitadi Higher Secondary School", "school", 29.5265, 80.4245, 1790.0, 500, "motorable", False, "1149", "Classrooms, Kitchen, Toilets"),
    ("Jumla (Upper Karnali Valley)", "Jumla Karnali Technical School", "school", 29.2775, 82.1802, 2600.0, 500, "motorable", False, "1149", "Classrooms, Kitchen, Blankets, Toilets"),
    ("Jumla (Upper Karnali Valley)", "Jumla Airport Apron (Khalanga)", "helipad", 29.2705, 82.1885, 2560.0, 300, "motorable", True, "1149", "Apron, Radio set, Generator"),
    ("Pokhara (Seti Gandaki Gorge)", "Prithvi Narayan Campus Grounds", "school", 28.2131, 83.9818, 905.0, 2000, "motorable", False, "1149", "Halls, Playing fields, Kitchen, Toilets, Medical post"),
    ("Pokhara (Seti Gandaki Gorge)", "Bagar Community Shelter (upper terrace)", "community_hall", 28.2058, 83.9902, 868.0, 600, "motorable", False, "1149", "Hall, Drinking water, First aid"),
    ("Jomsom (Kali Gandaki Gorge)", "Jomsom Airport Terminal Apron", "helipad", 28.7835, 83.7362, 2790.0, 350, "motorable", False, "1149", "Terminal hall, Apron, Radio set, Generator"),
    ("Jomsom (Kali Gandaki Gorge)", "Thini Village Gompa Terrace", "temple", 28.7762, 83.7455, 2880.0, 180, "mule_track", True, "1149", "Covered hall, Blankets"),
    ("Melamchi Valley", "Melamchi Higher Secondary School (ridge)", "school", 27.8338, 85.5758, 1305.0, 550, "motorable", False, "1149", "Classrooms, Kitchen, Toilets, Drinking water"),
    ("Melamchi Valley", "Melamchi Bazaar Health Post Terrace", "community_hall", 27.8265, 85.5845, 1252.0, 200, "footpath", False, "1149", "Medical room, Drinking water, First aid"),
    ("Melamchi Valley", "Talamarang Helipad Clearing", "helipad", 27.8215, 85.5722, 1390.0, 90, "mule_track", True, "1149", "Helipad, Radio set"),
    ("Tatopani (Bhotekoshi Gorge)", "Tatopani Secondary School (upper slope)", "school", 27.9518, 85.9358, 1465.0, 300, "mule_track", False, "1149", "Classrooms, Drinking water, First aid"),
    ("Tatopani (Bhotekoshi Gorge)", "Liping Army Post", "army_post", 27.9442, 85.9455, 1540.0, 220, "motorable", False, "1149", "Shelter, Rations, Satellite phone, Medical room"),
]


async def seed_shelters():
    print("Seeding designated high-ground relief shelters...")
    inserted = updated = skipped = 0

    async with AsyncSessionLocal() as session:
        villages = (await session.execute(select(Village))).scalars().all()
        by_name = {v.name: v for v in villages}

        for row in SHELTER_DATA:
            (village_name, name, stype, lat, lon, elev, cap,
             surface, crosses, phone, facilities) = row

            village = by_name.get(village_name)
            if village is None:
                print(f"  ! skipped '{name}': village '{village_name}' not seeded yet")
                skipped += 1
                continue

            # Refuse to seed a "shelter" that is not actually above the settlement --
            # a downhill destination in a debris-flow valley is not a safe haven.
            if elev <= village.elevation_m:
                print(f"  ! skipped '{name}': {elev} m is not above {village_name} ({village.elevation_m} m)")
                skipped += 1
                continue

            existing = (await session.execute(
                select(Shelter).where(Shelter.name == name, Shelter.village_id == village.id)
            )).scalar_one_or_none()

            if existing:
                existing.shelter_type = stype
                existing.latitude = lat
                existing.longitude = lon
                existing.elevation_m = elev
                existing.capacity = cap
                existing.route_surface = surface
                existing.crosses_stream = crosses
                existing.contact_phone = phone
                existing.facilities = facilities
                existing.is_active = True
                updated += 1
            else:
                session.add(Shelter(
                    name=name,
                    village_id=village.id,
                    shelter_type=stype,
                    latitude=lat,
                    longitude=lon,
                    elevation_m=elev,
                    capacity=cap,
                    contact_phone=phone,
                    facilities=facilities,
                    is_active=True,
                    crosses_stream=crosses,
                    route_surface=surface,
                ))
                inserted += 1

        await session.commit()

    print(f"Shelters: {inserted} inserted, {updated} updated, {skipped} skipped "
          f"({len(SHELTER_DATA)} rows in table).")


if __name__ == "__main__":
    asyncio.run(seed_shelters())
