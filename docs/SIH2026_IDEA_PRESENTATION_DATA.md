# SIH 2026 Idea Presentation Data

## Project Identity

| Field | Presentation-ready value |
|---|---|
| Project name | **VARUN** (working implementation name: DRAIN-GUARD AI) |
| Full form | Dynamic Risk Assessment & Inundation Notification System |
| SIH year | 2026 |
| Problem statement ID | 26192 |
| Category | Software |
| Theme | Disaster Management |
| Ministry / organisation | Ministry of Home Affairs |
| Department | NDRF & Disaster Management Division |
| Demonstration region | Upper Alaknanda and Dhauliganga catchment corridor, Chamoli, Uttarakhand |
| Target users | NDRF, SDMA, district authorities, village administrators, emergency responders, and citizens |

## Slide 1 - Problem and Need

### Problem statement

Hilly communities can move from normal rainfall to a flash flood, debris flow, or landslide emergency within minutes. Cloudbursts, saturated slopes, rising stream levels, and landslide dam outbursts can cut off villages before a district-level warning reaches the people who need it.

Existing warnings are often too broad. A district bulletin does not identify which village, riverbank, slope, or evacuation route is in immediate danger. Repeated warnings without a local risk change also create alert fatigue.

### Effects of the problem

- Residents receive insufficient time to leave valley floors and riverbanks.
- Authorities cannot easily prioritise one village over another.
- Rainfall alone does not explain slope stability or local inundation risk.
- Disconnected sensor, weather, terrain, and historical-event data delay decisions.
- Repeated alerts can desensitise operators and citizens.

### One-line value proposition

**VARUN converts multi-source rainfall, soil, terrain, vibration, and stream telemetry into village-level risk scores, estimated evacuation lead time, and bilingual actionable alerts.**

## Slide 2 - Proposed Solution

VARUN is a software-first, physics-informed hybrid early-warning platform. It fuses:

1. Live or simulated rainfall readings.
2. One-hour and twenty-four-hour rainfall accumulation.
3. Soil moisture and pore-water pressure.
4. Slope, elevation, drainage capacity, and distance to stream.
5. Geophone or debris-flow vibration readings.
6. Historical incident count and a trained susceptibility model.

The system produces four operational outputs:

- A risk score from 0 to 100.
- A risk level: green, yellow, or red.
- An estimated lead time in hours.
- An alert package for authorities and residents when the red threshold is reached.

## Slide 3 - Complete System Flowchart

```text
Weather grid / IoT / simulator / terrain data / historical events
                              |
                              v
                    1. Data ingestion API
                              |
                              v
                    2. Village validation
                              |
                              v
                    3. Database persistence
                              |
                              v
                    4. Feature preparation
                              |
                              v
                    5. Hybrid risk engine
                       /       |        \
                      /        |         \
                     v         v          v
              ML susceptibility  ID threshold  Soil / slope / vibration physics
                      \        |         /
                       \       |        /
                              v
                    6. Score fusion: 0-100
                              |
                              v
                    7. Risk classification
                    green / yellow / red
                         /           \
                        /             \
                       v               v
              8. Store risk result    9. Alert decision
                       |               /       \
                       |              /         \
                       |             v           v
                       |       Cooldown active   Red threshold reached
                       |             |                 |
                       |             v                 v
                       |       Suppress duplicate   10. Build alerts
                       |                               |
                       |                               v
                       |                   English + Hindi SMS / CAP JSON
                       |                               |
                       v                               v
             11. WebSocket dashboard broadcast <--- 12. Dispatch and audit log
                              |
                              v
                 Authorities select response and evacuation route
                              |
                              v
                  Citizens move to designated high ground
```

### Flowchart explanation for judges

#### 1. Data sources

The platform accepts data from weather grids, compatible IoT or LoRaWAN gateways, a local simulator for demonstration, terrain datasets, and historical incidents. The software uses a common payload shape, so simulated readings can later be replaced by physical edge devices without changing the prediction contract.

#### 2. Data ingestion API

The `POST /api/ingest` endpoint receives a village ID and sensor values. The payload can include current rainfall, one-hour rainfall, twenty-four-hour rainfall, soil moisture, pore-water pressure, vibration, stream level, timestamp, and source.

#### 3. Village validation

The backend verifies that the village exists before processing the reading. This prevents telemetry from being attached to an unknown location and ensures every prediction has the correct static terrain context.

#### 4. Database persistence

The raw reading is stored with its timestamp and village ID. This creates an auditable history for the dashboard, backtesting, incident analysis, and future model improvement.

#### 5. Feature preparation

The system combines the new reading with static village attributes: elevation, average slope, distance to stream, drainage capacity, and historical incident count. Missing derived values are calculated from available values using the backend defaults.

#### 6. Hybrid risk engine

The engine evaluates the same event through three complementary views:

- **Machine-learning susceptibility:** a trained Random Forest model estimates the probability that the terrain and current conditions resemble a hazardous historical pattern.
- **Rainfall intensity-duration check:** rainfall is compared with an empirical Himalayan threshold, `I_crit = 14.82 * D^(-0.39)`. The resulting ratio indicates whether current rainfall intensity is unusual for the duration.
- **Physics and terrain checks:** soil saturation, rainfall, slope, distance to stream, drainage capacity, pore pressure, and vibration contribute interpretable hazard components.

This combination is important because an ML model can generalise poorly outside its training examples, while a formula-only system cannot learn all non-linear interactions. The hybrid result provides both pattern recognition and an explainable physical safety check.

#### 7. Score fusion

The current implementation combines 40% ML susceptibility and 60% physical hazard score, then adds a capped historical-incident boost. The final value is clipped to the range 0-100.

The score components shown to operators are:

- Soil saturation score.
- Rainfall intensity score.
- Geomorphology score.
- Vibration score.
- ML probability percentage.

#### 8. Risk classification

- **Green:** normal hydrological baseline; routine monitoring continues.
- **Yellow:** watch condition. Rainfall, saturation, or risk score indicates that authorities should monitor the village and prepare.
- **Red:** severe condition. The system recommends immediate response and evaluates alert dispatch.

The red state is triggered by a score of at least 70, extreme combined rainfall and soil moisture, or a high vibration signal. Yellow is triggered by a score of at least 40, elevated rainfall, or high soil moisture.

#### 9. Lead-time estimation

Lead time estimates how long remains before the modelled saturation or instability threshold is reached. The calculation adjusts the critical saturation threshold for slope steepness, estimates moisture accumulation from rainfall and drainage, and reduces the result when vibration indicates an active disturbance. The output is clipped to a practical range of 0.3 to 24 hours.

The displayed number is an operational estimate, not a guarantee. It tells responders how urgently to act and allows them to prioritise villages with the shortest available window.

#### 10. Alert decision and anti-fatigue control

Only a red condition or score of at least 70 can dispatch an automatic alert. Before sending, the system checks a per-village three-minute cooldown. During cooldown, repeated telemetry spikes are recorded and broadcast to the dashboard but duplicate messages are suppressed.

This preserves the first warning while preventing a rapidly repeating sensor stream from flooding operators and citizens with identical messages.

#### 11. Message generation

The alert service creates an English and Hindi message containing:

- Village name.
- Risk score.
- Primary hazard factor.
- Estimated lead time.
- Clear instruction to leave riverbanks and low valley floors for designated high ground.

The primary factor is translated phrase by phrase, including combined triggers such as cloudburst plus saturation.

#### 12. CAP / SACHET dispatch and audit

The alert is stored with its channel, delivery state, timestamp, dispatcher type, and CAP identifier. The same event can be consumed by an SMS gateway or exported toward SACHET / Common Alerting Protocol compatible systems. The audit record allows authorities to reconstruct what was detected and when the warning was generated.

#### 13. Real-time dashboard broadcast

After evaluation, the backend broadcasts a WebSocket event containing the new telemetry, risk evaluation, and alert result. The React dashboard updates the map, charts, village table, alert feed, and detail view without requiring a page refresh.

#### 14. Human response

Authorities use the map and sortable response table to identify the most urgent village. They inspect the factors, lead time, shelters, and evacuation route, then coordinate field teams and public communication. Citizens receive the simplified bilingual instruction and move to safer, elevated locations.

## Slide 4 - Technical Architecture

### Frontend

- React and Vite application.
- Leaflet map with village-level risk visualisation.
- Recharts telemetry and risk history.
- Authority dashboard, village detail view, alert feed, evacuation route panel, backtesting page, and citizen view.
- WebSocket connection for real-time updates.

### Backend

- FastAPI REST API.
- WebSocket risk event gateway.
- SQLAlchemy asynchronous persistence.
- SQLite for local demonstration; PostgreSQL and Redis are supported in the Docker configuration.
- Alert, shelter, village, reading, and risk-score data models.

### Intelligence layer

- Random Forest susceptibility model artifact.
- Intensity-duration threshold.
- Soil saturation and drainage accumulation model.
- Terrain and historical-event features.
- Explainable component scores and primary-factor text.

### Integration layer

- REST ingestion contract for sensors and gateways.
- Simulator for repeatable demo scenarios.
- Bilingual SMS message generation.
- CAP / SACHET-style JSON export and dispatch record.

## Slide 5 - Five-Minute Demonstration Script

### Minute 1: Baseline

Open the authority dashboard and show the village map. Explain that the green villages are being monitored continuously and that the operator can see risk score, lead time, rainfall, soil moisture, and stream status at village resolution.

### Minute 2: Inspect a village

Open Raini, the reference village associated with the 2021 disaster context. Show the static terrain profile, latest telemetry, historical trend, risk components, and available shelters or evacuation options.

### Minute 3: Create a storm condition

Use **Trigger Storm Scenario**. The simulator increases rainfall and soil moisture and sends readings through the same ingestion path used by a real sensor gateway. The backend recalculates risk and broadcasts the result through WebSocket.

### Minute 4: Explain the decision

Show the change from green to yellow to red. Open the lead-time explanation and point out the rainfall intensity ratio, saturation level, slope, vibration, and drainage contribution. Emphasise that the output is not a black-box colour: the operator can see why the score changed.

### Minute 5: Show the response

Open the alert feed. Show the English and Hindi messages, the estimated lead time, the primary trigger, and the CAP / SACHET export. Then show the response table and evacuation route so judges can see how prediction becomes action.

## Slide 6 - Innovation and Differentiation

| Innovation | How VARUN implements it | Benefit |
|---|---|---|
| Hyper-local resolution | Village and ward polygon context instead of only district bulletins | Identifies the communities that need action first |
| Hybrid intelligence | ML susceptibility plus rainfall threshold plus terrain physics | Better resilience outside the exact training examples |
| Explainable risk | Component scores and primary-factor output | Authorities can justify decisions to responders and citizens |
| Lead-time output | Saturation, drainage, slope, rainfall, and vibration based estimate | Converts risk into an evacuation priority |
| Hardware pluggability | Stable REST payload for simulator, weather grid, or IoT gateway | Enables phased deployment |
| Alert fatigue control | Three-minute per-village cooldown | Prevents duplicate warning spam |
| National compatibility | Bilingual messages and CAP / SACHET-style payload | Supports existing disaster communication workflows |

## Slide 7 - Impact and Success Metrics

### Target impact

- Provide warning at village or ward scale rather than coarse district scale.
- Reduce the time from telemetry spike to dashboard notification to under 2.5 seconds in the local architecture.
- Present an estimated evacuation window of approximately 1.5 to 4 hours in representative steep-gorge scenarios, subject to local calibration and validation.
- Give responders one screen for risk, cause, lead time, shelters, routes, and alert status.
- Reduce unnecessary repeated messages through cooldown logic.

### How to measure the pilot

1. Measure ingestion-to-WebSocket latency for every reading.
2. Compare predicted red events with validated historical incidents.
3. Measure false-alert and missed-alert rates by village.
4. Measure alert delivery latency and delivery success.
5. Compare evacuation planning time before and after dashboard deployment.
6. Validate lead-time estimates against observed saturation, stream rise, and incident onset.

## Slide 8 - Feasibility and Deployment Plan

### Phase 1: Software pilot

- Connect the platform to historical rainfall and terrain data.
- Calibrate village boundaries, drainage indices, thresholds, and shelters.
- Run backtests against known events.

### Phase 2: Controlled field integration

- Add rainfall, soil moisture, stream-level, and vibration gateways.
- Test cellular and intermittent-connectivity behaviour.
- Compare model output with local authority observations.

### Phase 3: Operational rollout

- Deploy a LoRaWAN mesh in cellular shadow zones.
- Integrate official alert gateways and authority authentication.
- Establish escalation, acknowledgement, and audit procedures.

## Slide 9 - Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Sensor failure or noisy readings | Validate ranges, retain source and timestamp, and show telemetry freshness |
| Connectivity loss | Buffer edge readings and support low-bandwidth gateway integration in future deployment |
| False alarm | Combine ML, physical thresholds, historical context, and operator review |
| Missed event | Use conservative red triggers for extreme soil, rainfall, and vibration combinations |
| Alert fatigue | Per-village cooldown and risk-level transitions |
| Model drift | Backtest continuously and retrain with validated local incidents |
| Uncalibrated lead time | Treat lead time as an estimate and calibrate it against field observations before operational use |
| Data privacy and misuse | Limit citizen data collection, use role-based access, and retain an audit trail |

## Slide 10 - Future Scope

1. LoRaWAN mesh transceivers for valleys with weak cellular coverage.
2. UAV or drone validation when risk exceeds 80/100.
3. Citizen incident reporting through WhatsApp or Telegram with spatial deduplication.
4. River-basin-level routing and multi-village cascading risk.
5. Satellite rainfall and SAR change detection.
6. Field acknowledgement workflow for NDRF and district teams.
7. Calibrated regional models for Uttarakhand, Himachal Pradesh, the Western Ghats, Meghalaya, Assam, and Sikkim.

## Judge Q&A Quick Answers

### Is this hardware or software?

It is a software-first decision and alerting platform. It accepts a stable telemetry contract from a simulator, weather service, or physical IoT / LoRaWAN gateway. This keeps the pilot deployable while preserving hardware flexibility.

### Why use both ML and formulas?

ML captures non-linear combinations found in historical data. Physics-based checks provide interpretable safeguards when current conditions differ from the training data. Their combination is more defensible than either approach alone.

### What happens when a sensor sends repeated readings?

Every reading is stored and evaluated, but automatic red alerts are limited by a three-minute per-village cooldown. The dashboard still receives the live telemetry and current risk state.

### How does the system explain a red score?

It exposes the ML probability, rainfall intensity score, soil saturation score, geomorphology score, vibration score, historical boost, primary factor, and estimated lead time.

### Can authorities act on the output immediately?

The dashboard gives them village priority, lead time, hazard cause, alert text, shelter information, and evacuation route context. Operational deployment still requires local calibration, authority approval, and field validation.

### What is the most important outcome?

The system turns a raw sensor spike into a location-specific, time-aware, explainable decision: **which village is at risk, why it is at risk, how much time may remain, and what message should be sent next.**

## Source-of-Truth Implementation References

- API and end-to-end ingestion flow: `backend/main.py`
- Hybrid risk and lead-time calculations: `ml/prediction_engine.py`
- Bilingual alerts, CAP identifier, and cooldown: `backend/alert_service.py`
- Existing pitch summary: `docs/PITCH_DECK.md`