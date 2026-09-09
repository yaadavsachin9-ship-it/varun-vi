"""
Early Warning & Alerting Service
SIH 2026 Problem ID: 26192 - Flash Flood Prediction System for Hilly Regions
Handles multi-lingual alerts (English + Hindi), SMS dispatch, CAP / SACHET payload generation,
and anti-fatigue cooldown logic.
"""

import os
import datetime
from typing import Optional, Dict, Any
from backend.models import Alert, Village
from backend.database import AsyncSessionLocal
from backend.config import settings
from sqlalchemy import select

# In-memory cooldown tracker: { village_id: last_alert_timestamp }
ALERT_COOLDOWNS: Dict[int, datetime.datetime] = {}
COOLDOWN_SECONDS = 180 # 3 minutes cooldown between repeated alerts for the same village node

# The prediction engine emits its primary_factor in English from a fixed vocabulary
# (ml/prediction_engine.py). A Hindi SMS carrying an untranslated English cause is not
# usable by the people it is addressed to, so the phrases are mapped here.
PRIMARY_FACTOR_HI = {
    "Extreme Cloudburst Intensity": "अत्यधिक तीव्र बादल फटना",
    "High Soil Moisture Saturation": "मिट्टी में अत्यधिक जलसंतृप्ति",
    "Debris Flow Vibration Spike": "मलबा प्रवाह कंपन में उछाल",
    "Steep Slope Gravitational Instability": "तीव्र ढलान की अस्थिरता",
    "Stream Flood Stage Inundation": "नाले का जलस्तर बढ़कर बाढ़",
    "Normal Hydrological Baseline": "सामान्य जल-विज्ञान स्थिति",
    "Normal Hydrological Conditions": "सामान्य जल-विज्ञान स्थिति",
}


def translate_primary_factor(primary_factor: str) -> str:
    """
    Hindi rendering of an engine primary_factor. The engine joins multiple triggers with
    ' & ', so each part is mapped independently and rejoined with ' और '. Any phrase not
    in the map is passed through unchanged rather than dropped.
    """
    if not primary_factor:
        return ""
    parts = [p.strip() for p in primary_factor.split("&")]
    return " और ".join(PRIMARY_FACTOR_HI.get(p, p) for p in parts)


def generate_alert_messages(village_name: str, risk_score: float, lead_time_hrs: float, primary_factor: str):
    """
    Generates high-priority bilingual early warning messages.
    """
    lead_time_str = f"~{lead_time_hrs} hours" if lead_time_hrs >= 1.0 else f"~{int(lead_time_hrs*60)} minutes"
    lead_time_hi = f"लगभग {lead_time_hrs} घंटे" if lead_time_hrs >= 1.0 else f"लगभग {int(lead_time_hrs*60)} मिनट"
    factor_hi = translate_primary_factor(primary_factor)

    msg_en = (
        f"[URGENT EVACUATION WARNING - NDRF/SDMA] Severe Flash Flood / Landslide risk detected for {village_name}. "
        f"Risk Score: {risk_score}/100. Primary Trigger: {primary_factor}. "
        f"Estimated Impact Lead Time: {lead_time_str}. "
        f"Please evacuate immediate valley floors and riverbanks to designated high-ground shelters immediately."
    )

    msg_hi = (
        f"[आपातकालीन चेतावनी - एनडीआरएफ / राज्य आपदा प्रबंधन] {village_name} में गंभीर फ्लैश फ्लड / भूस्खलन का खतरा दर्ज किया गया है। "
        f"जोखिम स्कोर: {risk_score}/100। मुख्य कारण: {factor_hi}। "
        f"अनुमानित समय: {lead_time_hi}। "
        f"कृपया नदी तटों और ढलान वाले निचले क्षेत्रों को तुरंत खाली करें और सुरक्षित ऊंचाई वाले राहत शिविरों में जाएं।"
    )

    return msg_en, msg_hi

async def check_and_dispatch_alert(
    village_id: int, 
    village_name: str,
    risk_level: str, 
    risk_score: float, 
    lead_time_hrs: float,
    primary_factor: str
) -> Optional[Dict[str, Any]]:
    """
    Evaluates threshold and triggers alert if red level reached and cooldown expired.
    """
    if risk_level != "red" and risk_score < 70.0:
        return None

    now = datetime.datetime.now(datetime.timezone.utc)
    
    # Check cooldown
    if village_id in ALERT_COOLDOWNS:
        last_sent = ALERT_COOLDOWNS[village_id]
        if (now - last_sent).total_seconds() < COOLDOWN_SECONDS:
            return None # Cooldown active, suppress duplicate alert

    ALERT_COOLDOWNS[village_id] = now
    msg_en, msg_hi = generate_alert_messages(village_name, risk_score, lead_time_hrs, primary_factor)

    # Same CAP identifier convention as the operator-initiated dispatch in main.py, so a
    # SACHET consumer cannot tell the two paths apart on the wire -- only `dispatched_by`
    # distinguishes an automatic threshold trip from a human decision in the audit trail.
    cap_identifier = f"urn:drainguard:{village_id}:{now.strftime('%Y%m%dT%H%M%SZ')}"

    # Log to DB
    alert_record = None
    try:
        async with AsyncSessionLocal() as session:
            alert_obj = Alert(
                village_id=village_id,
                fired_at=now,
                risk_level=risk_level,
                risk_score=risk_score,
                channel="sms/sachet_cap",
                message_en=msg_en,
                message_hi=msg_hi,
                estimated_lead_time_hrs=lead_time_hrs,
                delivered=True,
                dispatched_by="auto-threshold",
                cap_identifier=cap_identifier,
            )
            session.add(alert_obj)
            await session.commit()
            await session.refresh(alert_obj)

            alert_record = {
                "id": alert_obj.id,
                "village_id": village_id,
                "village_name": village_name,
                "fired_at": now.isoformat(),
                "risk_level": risk_level,
                "risk_score": risk_score,
                "channel": "sms/sachet_cap",
                "message_en": msg_en,
                "message_hi": msg_hi,
                "estimated_lead_time_hrs": lead_time_hrs,
                "delivered": True,
                "dispatched_by": "auto-threshold",
                "cap_identifier": cap_identifier,
            }
            print(f"\n🚨 [EARLY WARNING FIRED] Village: {village_name} | Score: {risk_score} | Lead Time: {lead_time_hrs}h")
            print(f" -> English SMS: {msg_en[:90]}...")
            print(f" -> Hindi SMS: {msg_hi[:90]}...\n")
    except Exception as e:
        print(f"Failed to record alert: {e}")

    return alert_record
