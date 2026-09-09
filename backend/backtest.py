"""
Historical Backtest Runner
SIH 2026 Problem ID: 26192 - Flash Flood Prediction System for Hilly Regions

Replays the reconstructed timelines in data/historical_events.py through the *shipped*
prediction engine (ml/prediction_engine.py) and reports how much warning it would have
produced. Nothing in this module scores anything itself -- it only drives the engine and
measures when the engine's own risk level crossed yellow and red.

Two runs are performed per timeline step:

  1. FULL SENSOR SUITE      -- rainfall, soil moisture and the geophone/seismic channel.
  2. METEOROLOGICAL ONLY    -- the same inputs with the vibration channel clamped to its
                               quiet baseline. This is an ablation: it isolates how much
                               warning the rainfall/soil pathway alone would have given.

The ablation is what makes the Chamoli 2021 rock-ice avalanche worth including. It was a
dry mid-winter event, so the meteorological pathway is silent by construction and the
seismic channel is the only thing that fires. Reporting both numbers states the model's
coverage boundary in measured terms instead of claiming universal skill.
"""

from typing import Any, Dict, List, Optional

from data.historical_events import HISTORICAL_EVENTS, get_event, list_event_summaries
from ml.prediction_engine import prediction_engine

# Quiet-baseline vibration used for the meteorological-only ablation run. Matches the
# Reading.vibration_index column default, i.e. an undisturbed geophone.
QUIET_VIBRATION_BASELINE = 0.04

DATA_PROVENANCE = (
    "Hourly inputs are RECONSTRUCTIONS interpolated through published cumulative rainfall "
    "totals and documented onset times (IMD / DHM station summaries, NDMA and SDMA "
    "post-event reports, and the cited literature). They are not raw sub-daily gauge "
    "telemetry, which is not openly published for these catchments. Every risk score, "
    "risk level and lead-time figure below is computed live by the shipped prediction "
    "engine from those inputs."
)


def _model_version() -> str:
    data = getattr(prediction_engine, "model_data", None)
    if isinstance(data, dict) and data.get("version"):
        return str(data["version"])
    return "v1.0-hybrid-rf-physics"


def _fmt_hours(hrs: Optional[float]) -> Optional[str]:
    """Human label for a lead time: 18.0 -> '18 h 00 m', 0.58 -> '35 min'."""
    if hrs is None:
        return None
    total_min = int(round(hrs * 60.0))
    if total_min < 60:
        return f"{total_min} min"
    return f"{total_min // 60} h {total_min % 60:02d} m"


def _clock_label(t_minus_hrs: float) -> str:
    total_min = int(round(t_minus_hrs * 60.0))
    return f"T-{total_min // 60:02d}:{total_min % 60:02d}"


def _red_trigger_rules(reading: Dict[str, Any], risk_score: float) -> List[str]:
    """
    Which of the engine's three red conditions fired. Mirrors the disjunction in
    PredictionEngine.evaluate_risk -- kept as a read-only explanation, not a second
    implementation of the decision.
    """
    rules: List[str] = []
    if risk_score >= 70.0:
        rules.append("fused_risk_score>=70")
    if reading["soil_moisture_pct"] > 85.0 and reading["rainfall_1h_mm"] > 45.0:
        rules.append("saturation+intensity_rule")
    if reading["vibration_index"] > 0.55:
        rules.append("seismic_vibration>0.55")
    return rules


def _evaluate_step(site: Dict[str, Any], row: Dict[str, Any]) -> Dict[str, Any]:
    """Run one timeline row through the engine twice (full suite, then met-only)."""
    reading = {
        "rainfall_mm": row["rainfall_1h_mm"],
        "rainfall_1h_mm": row["rainfall_1h_mm"],
        "rainfall_24h_mm": row["rainfall_24h_mm"],
        "soil_moisture_pct": row["soil_moisture_pct"],
        # Pore pressure is not published for these events; the engine's own documented
        # fallback (0.2 * saturation) is used rather than inventing a gauge value.
        "pore_water_pressure_kpa": row["soil_moisture_pct"] * 0.2,
        "vibration_index": row["vibration_index"],
    }
    full = prediction_engine.evaluate_risk(site, reading)

    met_only_reading = dict(reading, vibration_index=QUIET_VIBRATION_BASELINE)
    met_only = prediction_engine.evaluate_risk(site, met_only_reading)

    return {
        "t_minus_hrs": row["t_minus_hrs"],
        "clock_label": _clock_label(row["t_minus_hrs"]),
        "inputs": {
            "rainfall_1h_mm": row["rainfall_1h_mm"],
            "rainfall_24h_mm": row["rainfall_24h_mm"],
            "soil_moisture_pct": row["soil_moisture_pct"],
            "vibration_index": row["vibration_index"],
        },
        "risk_score": full["risk_score"],
        "risk_level": full["risk_level"],
        "estimated_lead_time_hrs": full["estimated_lead_time_hrs"],
        "intensity_duration_ratio": full["intensity_duration_ratio"],
        "ml_susceptibility": full["ml_susceptibility"],
        "primary_factor": full["primary_factor"],
        "components": full["components"],
        "met_only_risk_score": met_only["risk_score"],
        "met_only_risk_level": met_only["risk_level"],
        "red_trigger_rules": _red_trigger_rules(reading, full["risk_score"]),
    }


def _build_verdict(event: Dict[str, Any], summary: Dict[str, Any]) -> Dict[str, Optional[str]]:
    """Plain-language reading of the measured numbers, including the honest failure case."""
    name = event["name"]
    red_at = summary["red_warning_hrs"]
    met_red_at = summary["met_only_red_warning_hrs"]

    if red_at is None:
        return {
            "headline": f"MISSED: the engine never reached red for {name}.",
            "detail": (
                "No configured red condition was satisfied anywhere in the replayed window. "
                "This event is outside the model's current detection envelope."
            ),
            "limitation": "Event not detected by any channel.",
        }

    seismic_only = met_red_at is None
    if seismic_only:
        return {
            "headline": (
                f"DETECTED at T-{_fmt_hours(red_at)} -- by the seismic channel alone."
            ),
            "detail": (
                f"The rainfall and soil-moisture pathway never left green for {name}: it was "
                f"a dry-season, non-meteorological failure, so there was no precursor rain to "
                f"detect. The geophone channel crossed the red threshold {_fmt_hours(red_at)} "
                f"before the surge arrived. That window is short, but it covers the "
                f"worksite-clearance decision that dominated the death toll."
            ),
            "limitation": (
                "Rainfall-driven forecasting contributes nothing to rock-ice avalanche and "
                "GLOF-type events. Warning for this class depends entirely on the seismic / "
                "vibration channel, and the achievable lead time is minutes, not hours."
            ),
        }

    gap = red_at - met_red_at
    detail = (
        f"The engine crossed yellow at T-{_fmt_hours(summary['yellow_warning_hrs'])} and red at "
        f"T-{_fmt_hours(red_at)}, driven by the rainfall-intensity and soil-saturation pathway. "
        f"Peak fused score reached {summary['peak_risk_score']}."
    )
    if gap > 0.05:
        detail += (
            f" The seismic channel advanced the red decision by {_fmt_hours(gap)} over the "
            f"meteorological pathway alone."
        )
    return {
        "headline": f"DETECTED at T-{_fmt_hours(red_at)} before destructive onset.",
        "detail": detail,
        "limitation": (
            "Warning skill here rests on rainfall reaching the catchment's gauges. The 2013 "
            "rainfall was in fact forecast by IMD -- the failure was translating a district "
            "forecast into a per-settlement evacuation decision, which is the gap this "
            "engine closes."
        ) if event["id"] == "kedarnath-2013" else (
            "The upper catchment here is sparsely gauged; this lead time assumes telemetry "
            "from the headwaters, which is exactly what the LoRa sensor tier is for."
        ),
    }


def run_backtest(event_id: str) -> Optional[Dict[str, Any]]:
    """
    Replay one catalogued event. Returns None if `event_id` is unknown.
    """
    event = get_event(event_id)
    if event is None:
        return None

    site = event["site"]
    steps = [_evaluate_step(site, row) for row in event["timeline"]]

    yellow_hrs: Optional[float] = None
    red_hrs: Optional[float] = None
    met_red_hrs: Optional[float] = None
    red_rules: List[str] = []
    model_lead_at_red: Optional[float] = None

    for step in steps:
        if yellow_hrs is None and step["risk_level"] in ("yellow", "red"):
            yellow_hrs = step["t_minus_hrs"]
        if red_hrs is None and step["risk_level"] == "red":
            red_hrs = step["t_minus_hrs"]
            red_rules = step["red_trigger_rules"]
            model_lead_at_red = step["estimated_lead_time_hrs"]
        if met_red_hrs is None and step["met_only_risk_level"] == "red":
            met_red_hrs = step["t_minus_hrs"]

    summary: Dict[str, Any] = {
        "detected": red_hrs is not None,
        "yellow_warning_hrs": yellow_hrs,
        "yellow_warning_label": _fmt_hours(yellow_hrs),
        "red_warning_hrs": red_hrs,
        "red_warning_label": _fmt_hours(red_hrs),
        "met_only_red_warning_hrs": met_red_hrs,
        "met_only_red_warning_label": _fmt_hours(met_red_hrs),
        "seismic_channel_essential": red_hrs is not None and met_red_hrs is None,
        "peak_risk_score": max((s["risk_score"] for s in steps), default=0.0),
        "red_trigger_rules": red_rules,
        # NOTE ON THE TWO CLOCKS -- do not conflate these.
        #   `red_warning_hrs` is how long before the destructive surge the engine went red.
        #   `saturation_window_at_first_red_hrs` is the engine's own T_lead output at that
        #   moment, which answers a different question: how long until the slope reaches
        #   critical saturation. A slope can be saturated for many hours before an upstream
        #   moraine dam actually breaches, so these two numbers legitimately differ and the
        #   difference is NOT a model error. Only `red_warning_hrs` is the warning time.
        "saturation_window_at_first_red_hrs": model_lead_at_red,
        "clock_note": (
            "red_warning_hrs = warning ahead of the destructive surge. "
            "saturation_window_at_first_red_hrs = the engine's time-to-critical-saturation "
            "estimate at that same moment. Different quantities; the gap is not an error."
        ),
    }
    summary["verdict"] = _build_verdict(event, summary)

    return {
        "event": {
            "id": event["id"],
            "name": event["name"],
            "event_date": event["event_date"],
            "region": event["region"],
            "driver": event["driver"],
            "driver_label": event["driver_label"],
            "impact_summary": event["impact_summary"],
            "human_cost": event["human_cost"],
            "published_basis": event["published_basis"],
            "references": event["references"],
            "site": site,
        },
        "data_provenance": DATA_PROVENANCE,
        "model_version": _model_version(),
        "quiet_vibration_baseline": QUIET_VIBRATION_BASELINE,
        "steps": steps,
        "summary": summary,
    }


def run_all_backtests() -> List[Dict[str, Any]]:
    """Headline row per catalogued event, for the backtest overview table."""
    rows = []
    for event in HISTORICAL_EVENTS:
        result = run_backtest(event["id"])
        if result is None:
            continue
        s = result["summary"]
        rows.append({
            "id": event["id"],
            "name": event["name"],
            "event_date": event["event_date"],
            "region": event["region"],
            "driver": event["driver"],
            "driver_label": event["driver_label"],
            "detected": s["detected"],
            "red_warning_label": s["red_warning_label"],
            "red_warning_hrs": s["red_warning_hrs"],
            "met_only_red_warning_label": s["met_only_red_warning_label"],
            "seismic_channel_essential": s["seismic_channel_essential"],
            "peak_risk_score": s["peak_risk_score"],
            "headline": s["verdict"]["headline"],
        })
    return rows


def event_catalogue() -> List[Dict[str, Any]]:
    return list_event_summaries()
