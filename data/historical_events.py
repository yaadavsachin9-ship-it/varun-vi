"""
Historical Event Catalogue for Model Backtesting
SIH 2026 Problem ID: 26192 - Flash Flood Prediction System for Hilly Regions

Purpose: replay real, documented Himalayan disasters through the *shipped* prediction
engine and report how much warning it would have produced. This is the only honest way to
put a number on "lead time" -- everything else is a claim about a simulator.

=======================  DATA PROVENANCE -- READ BEFORE QUOTING  =======================
The hourly profiles below are RECONSTRUCTIONS, not raw gauge telemetry. Each one is built
to be consistent with the published record for that event -- IMD / DHM station summaries,
NDMA and state SDMA post-event reports, and the peer-reviewed literature cited per event --
by interpolating a physically plausible hourly curve through the published cumulative
totals and the documented onset time.

What that means in practice:
  * The 24-hour totals, the event onset times and the qualitative driver (rainfall vs
    avalanche) are drawn from the public record.
  * The hour-by-hour shape of the curve is modelled, because sub-daily gauge series for
    these catchments are not openly published.
  * Every risk score, risk level and lead-time figure produced from these inputs is
    computed live by ml/prediction_engine.py -- none of it is authored here.

State this distinction plainly when presenting results. A reconstructed-input backtest is
a legitimate validation of decision logic; presenting it as raw observed telemetry is not.
=======================================================================================
"""

from typing import Any, Dict, List, Optional

# Each timeline row is keyed by `t_minus_hrs`: hours BEFORE the destructive onset at the
# representative settlement. 0.5 = thirty minutes before impact.
HISTORICAL_EVENTS: List[Dict[str, Any]] = [
    {
        "id": "kedarnath-2013",
        "name": "Kedarnath / Mandakini Valley Disaster",
        "event_date": "2013-06-17",
        "region": "Rudraprayag & Chamoli districts, Uttarakhand, India",
        "driver": "rainfall",
        "driver_label": "Extreme monsoon rainfall + Chorabari moraine lake breach",
        "impact_summary": (
            "An unusually early and intense monsoon burst over the upper Mandakini "
            "catchment saturated slopes for two days, then a moraine-dammed lake above "
            "Kedarnath breached and sent a debris-laden surge through the settlement."
        ),
        "human_cost": "Officially ~4,000 dead or missing across the Uttarakhand floods of June 2013",
        "published_basis": (
            "IMD recorded 385.1 mm over Uttarakhand for 1-18 June 2013 against a normal of "
            "71.3 mm, with extremely heavy falls on 16-17 June; regional 24-hour totals in "
            "excess of 300 mm are reported for the event window."
        ),
        "references": [
            "IMD, Monsoon Report 2013 (Uttarakhand June 2013 rainfall anomaly)",
            "NDMA / Government of Uttarakhand post-disaster assessment, 2013",
            "Dobhal et al., Current Science (2013) - Kedarnath disaster: facts and plausible causes",
        ],
        # Terrain of the representative settlement, matching the Village feature schema.
        "site": {
            "name": "Kedarnath settlement terrace (Mandakini right bank)",
            "elevation_m": 3580.0,
            "avg_slope_deg": 34.0,
            "distance_to_stream_m": 30.0,
            "drainage_capacity_index": 0.40,
            "historical_incident_count": 5,
        },
        "timeline": [
            {"t_minus_hrs": 48.0, "rainfall_1h_mm": 1.5, "rainfall_24h_mm": 16.0, "soil_moisture_pct": 44.0, "vibration_index": 0.03},
            {"t_minus_hrs": 36.0, "rainfall_1h_mm": 3.0, "rainfall_24h_mm": 30.0, "soil_moisture_pct": 52.0, "vibration_index": 0.03},
            {"t_minus_hrs": 30.0, "rainfall_1h_mm": 6.0, "rainfall_24h_mm": 55.0, "soil_moisture_pct": 60.0, "vibration_index": 0.04},
            {"t_minus_hrs": 24.0, "rainfall_1h_mm": 11.0, "rainfall_24h_mm": 95.0, "soil_moisture_pct": 68.0, "vibration_index": 0.04},
            {"t_minus_hrs": 18.0, "rainfall_1h_mm": 18.0, "rainfall_24h_mm": 150.0, "soil_moisture_pct": 76.0, "vibration_index": 0.05},
            {"t_minus_hrs": 12.0, "rainfall_1h_mm": 26.0, "rainfall_24h_mm": 210.0, "soil_moisture_pct": 84.0, "vibration_index": 0.08},
            {"t_minus_hrs": 9.0, "rainfall_1h_mm": 33.0, "rainfall_24h_mm": 250.0, "soil_moisture_pct": 88.0, "vibration_index": 0.12},
            {"t_minus_hrs": 6.0, "rainfall_1h_mm": 41.0, "rainfall_24h_mm": 285.0, "soil_moisture_pct": 91.0, "vibration_index": 0.18},
            {"t_minus_hrs": 3.0, "rainfall_1h_mm": 48.0, "rainfall_24h_mm": 312.0, "soil_moisture_pct": 93.0, "vibration_index": 0.28},
            {"t_minus_hrs": 1.0, "rainfall_1h_mm": 55.0, "rainfall_24h_mm": 325.0, "soil_moisture_pct": 95.0, "vibration_index": 0.42},
            {"t_minus_hrs": 0.25, "rainfall_1h_mm": 58.0, "rainfall_24h_mm": 330.0, "soil_moisture_pct": 96.0, "vibration_index": 0.78},
        ],
    },
    {
        "id": "melamchi-2021",
        "name": "Melamchi Khola Debris Flood",
        "event_date": "2021-06-15",
        "region": "Sindhupalchok district, Bagmati Province, Nepal",
        "driver": "rainfall",
        "driver_label": "Pre-monsoon extreme rainfall over the upper Helambu catchment",
        "impact_summary": (
            "Sustained heavy rain over the sparsely gauged upper Melamchi catchment "
            "mobilised stored sediment and landslide debris, and a debris flood swept "
            "down the Melamchi Khola into Melamchi Bazaar."
        ),
        "human_cost": "Dozens dead or missing; Melamchi Bazaar and the Melamchi water supply headworks heavily damaged",
        "published_basis": (
            "Nepal DHM station records and post-event assessments document multi-day "
            "pre-monsoon rainfall over the Helambu / upper Melamchi catchment culminating "
            "in the 15 June 2021 debris flood."
        ),
        "references": [
            "Department of Hydrology and Meteorology (DHM), Nepal - June 2021 rainfall records",
            "ICIMOD post-event assessment, Melamchi flood, June 2021",
        ],
        "site": {
            "name": "Melamchi Valley settlement (Melamchi Khola left bank)",
            "elevation_m": 1200.0,
            "avg_slope_deg": 45.2,
            "distance_to_stream_m": 30.0,
            "drainage_capacity_index": 0.42,
            "historical_incident_count": 6,
        },
        "timeline": [
            {"t_minus_hrs": 30.0, "rainfall_1h_mm": 2.0, "rainfall_24h_mm": 22.0, "soil_moisture_pct": 55.0, "vibration_index": 0.03},
            {"t_minus_hrs": 24.0, "rainfall_1h_mm": 5.0, "rainfall_24h_mm": 48.0, "soil_moisture_pct": 62.0, "vibration_index": 0.04},
            {"t_minus_hrs": 18.0, "rainfall_1h_mm": 9.0, "rainfall_24h_mm": 82.0, "soil_moisture_pct": 70.0, "vibration_index": 0.05},
            {"t_minus_hrs": 12.0, "rainfall_1h_mm": 16.0, "rainfall_24h_mm": 128.0, "soil_moisture_pct": 79.0, "vibration_index": 0.07},
            {"t_minus_hrs": 8.0, "rainfall_1h_mm": 24.0, "rainfall_24h_mm": 170.0, "soil_moisture_pct": 85.0, "vibration_index": 0.11},
            {"t_minus_hrs": 5.0, "rainfall_1h_mm": 31.0, "rainfall_24h_mm": 198.0, "soil_moisture_pct": 89.0, "vibration_index": 0.16},
            {"t_minus_hrs": 3.0, "rainfall_1h_mm": 38.0, "rainfall_24h_mm": 218.0, "soil_moisture_pct": 92.0, "vibration_index": 0.24},
            {"t_minus_hrs": 1.5, "rainfall_1h_mm": 44.0, "rainfall_24h_mm": 232.0, "soil_moisture_pct": 94.0, "vibration_index": 0.41},
            {"t_minus_hrs": 0.3, "rainfall_1h_mm": 46.0, "rainfall_24h_mm": 240.0, "soil_moisture_pct": 95.0, "vibration_index": 0.80},
        ],
    },
    {
        "id": "chamoli-rishiganga-2021",
        "name": "Chamoli / Rishiganga Rock-Ice Avalanche",
        "event_date": "2021-02-07",
        "region": "Raini and Tapovan, Chamoli district, Uttarakhand, India",
        # Deliberately included as a NEGATIVE / LIMITATION case for the rainfall pathway.
        "driver": "rock_ice_avalanche",
        "driver_label": "Rock-ice avalanche from the Ronti Gad flank - NOT rainfall driven",
        "impact_summary": (
            "A rock-ice mass detached high on the Ronti Gad flank in mid-winter and "
            "transformed into a debris flood down the Rishiganga and Dhauliganga, "
            "destroying the Rishiganga hydel scheme at Raini and overwhelming the Tapovan "
            "barrage and its tunnel works. It was a dry-season, non-meteorological event."
        ),
        "human_cost": "Over 200 dead or missing, most of them workers inside the Tapovan barrage and tunnel works",
        "published_basis": (
            "Reported as a mid-winter rock-ice avalanche with negligible antecedent "
            "rainfall; the collapse and the resulting flow generated seismic signals "
            "recorded before the surge reached the downstream worksites, with travel time "
            "from initiation to Tapovan on the order of tens of minutes."
        ),
        "references": [
            "Shugar et al., Science (2021) - A massive rock and ice avalanche caused the 2021 Chamoli disaster",
            "Government of Uttarakhand / NDRF incident reports, February 2021",
        ],
        "site": {
            # Matches the seeded Raini (Rishiganga Confluence) node.
            "name": "Raini / Tapovan corridor (Rishiganga-Dhauliganga confluence)",
            "elevation_m": 2050.0,
            "avg_slope_deg": 44.5,
            "distance_to_stream_m": 35.0,
            "drainage_capacity_index": 0.45,
            "historical_incident_count": 6,
        },
        "timeline": [
            # Mid-winter: no rain, low and partly frozen soil moisture. The rainfall and
            # soil-moisture pathways are silent by construction for this event.
            {"t_minus_hrs": 12.0, "rainfall_1h_mm": 0.0, "rainfall_24h_mm": 0.0, "soil_moisture_pct": 19.0, "vibration_index": 0.02},
            {"t_minus_hrs": 6.0, "rainfall_1h_mm": 0.0, "rainfall_24h_mm": 0.0, "soil_moisture_pct": 19.0, "vibration_index": 0.02},
            {"t_minus_hrs": 2.0, "rainfall_1h_mm": 0.0, "rainfall_24h_mm": 0.0, "soil_moisture_pct": 19.0, "vibration_index": 0.03},
            {"t_minus_hrs": 1.0, "rainfall_1h_mm": 0.0, "rainfall_24h_mm": 0.0, "soil_moisture_pct": 19.0, "vibration_index": 0.03},
            # Detachment high in the catchment -- the seismic channel is the only signal.
            {"t_minus_hrs": 0.58, "rainfall_1h_mm": 0.0, "rainfall_24h_mm": 0.0, "soil_moisture_pct": 19.0, "vibration_index": 0.68},
            {"t_minus_hrs": 0.33, "rainfall_1h_mm": 0.0, "rainfall_24h_mm": 0.0, "soil_moisture_pct": 20.0, "vibration_index": 0.82},
            {"t_minus_hrs": 0.08, "rainfall_1h_mm": 0.0, "rainfall_24h_mm": 0.0, "soil_moisture_pct": 21.0, "vibration_index": 0.95},
        ],
    },
]


def get_event(event_id: str) -> Optional[Dict[str, Any]]:
    return next((e for e in HISTORICAL_EVENTS if e["id"] == event_id), None)


def list_event_summaries() -> List[Dict[str, Any]]:
    """Catalogue view without the full timelines, for the event picker."""
    return [
        {
            "id": e["id"],
            "name": e["name"],
            "event_date": e["event_date"],
            "region": e["region"],
            "driver": e["driver"],
            "driver_label": e["driver_label"],
            "human_cost": e["human_cost"],
            "timeline_points": len(e["timeline"]),
        }
        for e in HISTORICAL_EVENTS
    ]
