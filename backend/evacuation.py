"""
Evacuation Routing & Shelter Allocation Engine
SIH 2026 Problem ID: 26192 - Flash Flood Prediction System for Hilly Regions

Answers the question the prediction engine leaves open: the model says this village has
N hours of lead time -- can its people actually reach safe ground inside N hours, and by
which route?

Three physical models are combined:

1. HAVERSINE horizontal distance between settlement centroid and shelter.

2. TOBLER'S HIKING FUNCTION for on-foot travel speed over a slope:
       W = 6 * exp(-3.5 * |S + 0.05|)      [km/h]
   where S is the dimensionless grade (rise/run). Flat ground gives ~5.0 km/h, a 20%
   climb gives ~2.5 km/h. This is the standard empirical model used in GIS least-cost
   path analysis and it matters here: naive straight-line "2 km away" estimates badly
   understate evacuation time on a 30 degree Himalayan slope.

3. TERRAIN SINUOSITY multiplier converting straight-line distance into real path length.
   Motorable hill roads switchback heavily (~1.9x), footpaths climb more directly (~1.35x),
   mule tracks fall in between (~1.55x).

Route geometry returned here is an INDICATIVE alignment for map display -- a switchback
ascent synthesised between the settlement and the shelter -- not a surveyed road
centreline. A production deployment would replace `build_route_geometry` with an OSRM /
GraphHopper query over the OSM road graph, cost-weighted by the SRTM DEM and by the
flood inundation polygon. Every other number in this module (distance, grade, speed,
time, safety score) is computed, not authored.
"""

import math
from typing import Any, Dict, List, Optional

EARTH_RADIUS_M = 6_371_000.0

# Straight-line -> real path length multipliers by route surface type
SINUOSITY = {
    "motorable": 1.90,
    "mule_track": 1.55,
    "footpath": 1.35,
}

# Elevation gain (m) above the settlement considered a safe margin above the
# debris-flow / inundation path in a narrow Himalayan valley.
TARGET_ELEVATION_MARGIN_M = 60.0

# A shelter BELOW the settlement is not a shelter for this hazard class. Debris flows and
# flash floods follow the channel downhill, so descending to reach a building means moving
# with the flow instead of away from it. Scoring such an option at merely "no height credit"
# was not enough: with a short walk and a motorable surface it could still out-rank a
# genuine ridge shelter on total score. It now takes an explicit penalty and is flagged so
# the map and the citizen screen can say why it is listed at all -- it stays in the list
# because when every uphill option is unreachable an operator still needs to see what
# exists, but it must never be silently recommended.
BELOW_SETTLEMENT_PENALTY = 40.0

# Fraction of the modelled lead time that an evacuation must fit inside to be called
# feasible. The remainder absorbs alerting latency, household mobilisation and the
# elderly/child tail of the crowd.
LEAD_TIME_SAFETY_FRACTION = 0.70


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres between two WGS84 points."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    d_phi = p2 - p1
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def tobler_speed_kmh(grade: float) -> float:
    """
    Tobler's hiking function. `grade` is rise/run (positive uphill, negative downhill).
    Peak speed occurs at a slight downhill (-0.05), which is why the +0.05 offset is inside
    the absolute value.
    """
    return 6.0 * math.exp(-3.5 * abs(grade + 0.05))


def conditions_slowdown_factor(rainfall_1h_mm: float, is_night: bool = False) -> float:
    """
    Multiplier (>= 1.0) applied to walking time for the conditions people actually
    evacuate in. Moving uphill during an active cloudburst on a wet hill track is
    materially slower than the fair-weather Tobler speed.
    """
    factor = 1.0
    if rainfall_1h_mm >= 50.0:
        factor *= 1.45          # active cloudburst, poor footing and visibility
    elif rainfall_1h_mm >= 20.0:
        factor *= 1.25          # heavy rain
    elif rainfall_1h_mm >= 5.0:
        factor *= 1.10          # moderate rain
    if is_night:
        factor *= 1.20          # unlit hill tracks
    return factor


def congestion_factor(population: int, capacity: int, route_surface: str) -> float:
    """
    Narrow footpaths throttle throughput once a whole settlement is moving at once.
    Motorable roads absorb crowds far better than a single-file mule track.
    """
    if population <= 0:
        return 1.0
    load = population / max(1, capacity)
    if route_surface == "motorable":
        return 1.0 + min(0.20, max(0.0, load - 1.0) * 0.10)
    return 1.0 + min(0.55, max(0.0, load - 0.5) * 0.30)


def _bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    d_lambda = math.radians(lon2 - lon1)
    y = math.sin(d_lambda) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(d_lambda)
    return math.degrees(math.atan2(y, x))


def _offset_point(lat: float, lon: float, bearing_deg: float, distance_m: float):
    """Project a point `distance_m` along `bearing_deg` from (lat, lon)."""
    b = math.radians(bearing_deg)
    d_r = distance_m / EARTH_RADIUS_M
    p1 = math.radians(lat)
    l1 = math.radians(lon)
    p2 = math.asin(math.sin(p1) * math.cos(d_r) + math.cos(p1) * math.sin(d_r) * math.cos(b))
    l2 = l1 + math.atan2(
        math.sin(b) * math.sin(d_r) * math.cos(p1),
        math.cos(d_r) - math.sin(p1) * math.sin(p2),
    )
    return round(math.degrees(p2), 6), round(math.degrees(l2), 6)


def build_route_geometry(
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
    route_surface: str,
) -> List[List[float]]:
    """
    Synthesise an indicative switchback alignment as a [[lat, lon], ...] polyline.

    A straight line drawn on the map would misrepresent how hill evacuation actually
    works, so intermediate waypoints are offset perpendicular to the direct bearing to
    show the zig-zag ascent. Motorable roads get wider, more numerous switchbacks;
    footpaths get a nearly direct climb. See the module docstring on replacing this with
    real OSM routing.
    """
    straight_m = haversine_m(origin_lat, origin_lon, dest_lat, dest_lon)
    bearing = _bearing_deg(origin_lat, origin_lon, dest_lat, dest_lon)

    if route_surface == "motorable":
        switchbacks, amplitude_frac = 4, 0.16
    elif route_surface == "mule_track":
        switchbacks, amplitude_frac = 3, 0.10
    else:
        switchbacks, amplitude_frac = 2, 0.06

    points: List[List[float]] = [[round(origin_lat, 6), round(origin_lon, 6)]]
    for i in range(1, switchbacks + 1):
        t = i / (switchbacks + 1)
        # Point along the direct bearing at fraction t of the way
        mid_lat, mid_lon = _offset_point(origin_lat, origin_lon, bearing, straight_m * t)
        # Alternate the perpendicular offset side to produce the zig-zag
        side = 90.0 if i % 2 == 1 else -90.0
        # Amplitude tapers to zero at the shelter so the path converges on it
        amplitude = straight_m * amplitude_frac * math.sin(math.pi * t)
        way_lat, way_lon = _offset_point(mid_lat, mid_lon, bearing + side, amplitude)
        points.append([way_lat, way_lon])
    points.append([round(dest_lat, 6), round(dest_lon, 6)])
    return points


def evaluate_route(
    village: Dict[str, Any],
    shelter: Dict[str, Any],
    rainfall_1h_mm: float = 0.0,
    lead_time_hrs: Optional[float] = None,
    is_night: bool = False,
) -> Dict[str, Any]:
    """
    Cost one village -> shelter evacuation option.

    Returns distance, grade, Tobler speed, adjusted walking time, a 0-100 safety score
    and a feasibility verdict against the modelled lead time.
    """
    v_lat = village["latitude"]
    v_lon = village["longitude"]
    v_elev = village.get("elevation_m") or 1800.0
    population = int(village.get("population") or 0)

    surface = shelter.get("route_surface") or "footpath"
    s_elev = shelter.get("elevation_m") or v_elev

    straight_m = haversine_m(v_lat, v_lon, shelter["latitude"], shelter["longitude"])
    path_m = straight_m * SINUOSITY.get(surface, 1.35)
    gain_m = s_elev - v_elev
    grade = gain_m / path_m if path_m > 0 else 0.0

    base_speed = tobler_speed_kmh(grade)
    slowdown = conditions_slowdown_factor(rainfall_1h_mm, is_night)
    crowding = congestion_factor(population, int(shelter.get("capacity") or 200), surface)

    walk_minutes = ((path_m / 1000.0) / base_speed) * 60.0 * slowdown * crowding

    # ---- Safety score (0-100, higher is safer) -------------------------------------
    # Vertical margin above the settlement is the single most protective factor in a
    # narrow valley: the debris/flood path follows the channel, so height is survival.
    margin_score = 45.0 * min(1.0, max(0.0, gain_m) / TARGET_ELEVATION_MARGIN_M)

    # Below the settlement is the wrong direction for this hazard -- see the constant.
    below_settlement = gain_m < 0.0
    downhill_penalty = BELOW_SETTLEMENT_PENALTY if below_settlement else 0.0

    # A route that fords the very channel that is flooding is the classic fatal mistake.
    crossing_penalty = 30.0 if shelter.get("crosses_stream") else 0.0

    # Shorter exposure time on the move is safer.
    exposure_score = 25.0 * math.exp(-walk_minutes / 45.0)

    # Surface robustness: a motorable road survives and carries stretchers/vehicles.
    surface_score = {"motorable": 20.0, "mule_track": 12.0, "footpath": 8.0}.get(surface, 8.0)

    # Capacity adequacy for the population being moved.
    capacity = int(shelter.get("capacity") or 200)
    capacity_score = 10.0 * min(1.0, capacity / max(1, population)) if population else 10.0

    safety_score = max(
        0.0,
        min(
            100.0,
            margin_score
            + exposure_score
            + surface_score
            + capacity_score
            - crossing_penalty
            - downhill_penalty,
        ),
    )

    # ---- Feasibility against the modelled lead time --------------------------------
    feasibility = "unknown"
    usable_minutes = None
    if lead_time_hrs is not None:
        usable_minutes = lead_time_hrs * 60.0 * LEAD_TIME_SAFETY_FRACTION
        if walk_minutes <= usable_minutes:
            feasibility = "feasible"
        elif walk_minutes <= lead_time_hrs * 60.0:
            feasibility = "tight"
        else:
            feasibility = "not_feasible_on_foot"

    return {
        "shelter_id": shelter.get("id"),
        "shelter_name": shelter.get("name"),
        "shelter_type": shelter.get("shelter_type"),
        "serves_this_village": bool(shelter.get("serves_this_village", True)),
        "latitude": shelter["latitude"],
        "longitude": shelter["longitude"],
        "elevation_m": round(s_elev, 1),
        "capacity": capacity,
        "contact_phone": shelter.get("contact_phone"),
        "facilities": shelter.get("facilities"),
        "route_surface": surface,
        "crosses_stream": bool(shelter.get("crosses_stream")),
        "straight_line_m": round(straight_m, 1),
        "path_length_m": round(path_m, 1),
        "elevation_gain_m": round(gain_m, 1),
        "below_settlement": below_settlement,
        "grade_pct": round(grade * 100.0, 1),
        "tobler_speed_kmh": round(base_speed, 2),
        "conditions_slowdown": round(slowdown, 2),
        "congestion_factor": round(crowding, 2),
        "walking_time_min": round(walk_minutes, 1),
        "usable_window_min": round(usable_minutes, 1) if usable_minutes is not None else None,
        "safety_score": round(safety_score, 1),
        "feasibility": feasibility,
        "geometry": build_route_geometry(
            v_lat, v_lon, shelter["latitude"], shelter["longitude"], surface
        ),
        "alignment": "indicative",
    }


def rank_evacuation_options(
    village: Dict[str, Any],
    shelters: List[Dict[str, Any]],
    rainfall_1h_mm: float = 0.0,
    lead_time_hrs: Optional[float] = None,
    is_night: bool = False,
) -> List[Dict[str, Any]]:
    """
    Cost every candidate shelter and rank them.

    Ordering, most significant key first:

      1. Uphill before downhill. A shelter below the settlement sorts last no matter how
         quick the walk is, because the flow travels the same way. A ten-minute descent
         must never out-rank an hour's climb here. Such options stay in the returned list
         so an operator can see the full picture when nothing uphill is reachable, but
         they cannot become the recommendation.
      2. Fits inside the lead time, then tight, then unknown, then unreachable on foot.
      3. Higher safety score.
      4. Shorter walk.

    Note on 1: the alternative real-world answer when no uphill option is reachable is
    vertical evacuation -- upper floors of a strong nearby building. That is a different
    decision from "walk downhill to a school", and this model carries no data on storeys
    or structural class, so it does not attempt to make it.
    """
    options = [
        evaluate_route(village, s, rainfall_1h_mm, lead_time_hrs, is_night)
        for s in shelters
        if s.get("is_active", True)
    ]
    feasibility_rank = {"feasible": 0, "tight": 1, "unknown": 2, "not_feasible_on_foot": 3}
    options.sort(
        key=lambda o: (
            1 if o.get("below_settlement") else 0,
            feasibility_rank.get(o["feasibility"], 2),
            -o["safety_score"],
            o["walking_time_min"],
        )
    )
    return options


def _vertical_phrase(gain_m: int) -> Dict[str, str]:
    """
    How to say the vertical relation without lying about its sign.

    "climbing -145 m" is what naive interpolation produces when the only shelter on record
    sits below the settlement, and it reads as a typo rather than as the warning it is.
    """
    if gain_m < 0:
        return {
            "en": f"descending {abs(gain_m)} m",
            "hi": f"{abs(gain_m)} मीटर नीचे उतरकर",
        }
    return {"en": f"climbing {gain_m} m", "hi": f"{gain_m} मीटर की चढ़ाई"}


def build_advisory(village_name: str, option: Optional[Dict[str, Any]], risk_level: str) -> Dict[str, str]:
    """Bilingual, concrete instruction for the recommended option."""
    if option is None:
        return {
            "en": f"No shelter is currently registered for {village_name}. Move to the highest reachable ground away from the stream channel and call 1070.",
            "hi": f"{village_name} के लिए कोई पंजीकृत राहत शिविर नहीं है। नाले से दूर सबसे ऊँची पहुँच योग्य जगह पर जाएँ और 1070 पर कॉल करें।",
        }

    minutes = int(round(option["walking_time_min"]))
    gain = int(round(option["elevation_gain_m"]))
    vert = _vertical_phrase(gain)
    name = option["shelter_name"]

    if option["feasibility"] == "not_feasible_on_foot":
        en = (
            f"On-foot evacuation to {name} needs about {minutes} min, which exceeds the modelled window. "
            f"Request vehicle or helicopter lift via 1070 and move immediately to the nearest high ground "
            f"clear of the channel while transport is arranged."
        )
        hi = (
            f"{name} तक पैदल पहुँचने में लगभग {minutes} मिनट लगेंगे, जो उपलब्ध समय से अधिक है। "
            f"1070 पर वाहन या हेलीकॉप्टर सहायता मांगें और तुरंत नाले से दूर नज़दीकी ऊँचाई पर जाएँ।"
        )
    elif option["feasibility"] == "tight":
        en = (
            f"Leave now for {name}: about {minutes} min on foot, {vert['en']}. The window is tight -- "
            f"do not stop to collect belongings and do not use the streambed as a path."
        )
        hi = (
            f"तुरंत {name} की ओर निकलें: पैदल लगभग {minutes} मिनट, {vert['hi']}। समय बहुत कम है -- "
            f"सामान इकट्ठा करने के लिए न रुकें और नाले के रास्ते का प्रयोग न करें।"
        )
    else:
        urgency_en = "Evacuate now" if risk_level == "red" else "Prepare to move to"
        urgency_hi = "तुरंत खाली करें और जाएँ" if risk_level == "red" else "जाने के लिए तैयार रहें"
        en = (
            f"{urgency_en} {name}: about {minutes} min on foot, {vert['en']}. "
            f"Carry ID, medicines and a torch. Keep to the marked route -- avoid the stream crossing."
        )
        hi = (
            f"{urgency_hi} {name}: पैदल लगभग {minutes} मिनट, {vert['hi']}। "
            f"पहचान पत्र, दवाइयाँ और टॉर्च साथ रखें। चिह्नित रास्ते पर चलें -- नाला पार करने से बचें।"
        )

    # Only reachable when every registered shelter for the village is below it: the ranking
    # in rank_evacuation_options sinks downhill options beneath every uphill one.
    if option.get("below_settlement"):
        en += (
            " WARNING: this shelter lies below the settlement. A debris flow travels down the"
            " same valley, so treat this as a last resort -- prefer any higher ground you can"
            " reach, even without a building on it."
        )
        hi += (
            " चेतावनी: यह शिविर बस्ती से नीचे है। मलबा और बाढ़ इसी घाटी में नीचे की ओर बहते हैं,"
            " इसलिए इसे अंतिम विकल्प मानें -- बिना इमारत वाली भी कोई ऊँची जगह मिले तो वहीं जाएँ।"
        )

    if option["crosses_stream"]:
        en += " WARNING: this approach crosses the hazard channel -- cross only if the bed is still dry."
        hi += " चेतावनी: यह रास्ता खतरे वाले नाले को पार करता है -- केवल तभी पार करें जब तल सूखा हो।"

    return {"en": en, "hi": hi}
