# Data Collection V3 — Phased Plan

## Guiding Principle
Collect and normalize transit data *before* building UX on top of it. Data quality determines recommendation quality.

## Phase 1: Static/Public Schedule + Route Metadata (NOW)

### What
- Station lists with coordinates and accessibility info
- Route definitions: which stations, which order, which mode
- Published schedules: departure times by day-of-week
- Walking transfer times between stations/lines

### Sources
| Source | Data | Format | Storage |
|--------|------|--------|---------|
| PATH/PANYNJ | Station list, route map | Hardcoded constants | `src/lib/services/transit.ts` |
| MTA Static GTFS | Subway stations, routes, schedules | GTFS zip | `data/public/gtfs/` |
| NJ Transit | Rail stations, routes | GTFS zip | `data/public/gtfs/` |
| Open-Meteo | Weather (already live) | REST API | `weather_snapshots` table |

### Schema: `transit_routes` table
Normalizes route metadata across all modes into a single queryable table.

### Schema: `transit_stations` table
Station/stop reference data with coordinates and mode tags.

### Implementation
- `data/public/gtfs/` directory for static GTFS data (committed to repo)
- Ingestion script: `scripts/ingest-gtfs.ts` parses GTFS and populates DB
- Data quality: freshness timestamp, row count validation, source hash
- Cron: re-ingest weekly (schedules change seasonally)

## Phase 2: Realtime Status/Headways/Incidents/Weather (V3.1)

### What
- Realtime train positions and predicted arrivals
- Service alerts and planned work
- Headway computation from vehicle positions
- Weather overlay on departure scoring

### Sources
| Source | Data | Protocol |
|--------|------|----------|
| MTA GTFS-RT | Subway realtime positions | Protobuf |
| PATH PANYNJ | Realtime arrivals | JSON/Protobuf |
| MTA Service Status | Alerts/advisories | JSON API |
| NJ Transit | Rail status | API |

### Schema additions
- `realtime_arrivals`: per-station predicted arrival times
- Enhanced `transit_snapshots`: mode-tagged, source-typed

## Phase 3: Historical Quality Scoring + Personalized Signals (V3.2)

### What
- Historical on-time performance by route/time/day
- Personal reliability score based on user's trip history
- Crowd density estimates (if data available)
- Per-user learned penalties (already started in correlation engine)

### Schema additions
- `route_reliability_scores`: computed daily
- `user_commute_summary`: aggregated per-user stats
- Enhanced correlation engine with multi-mode support

## Data Quality Framework

| Check | Frequency | Action on Failure |
|-------|-----------|-------------------|
| Freshness | Every cron run | Flag stale, lower confidence |
| Row count | After ingestion | Alert if zero/abnormal |
| Source hash | Weekly | Re-ingest if changed |
| API availability | Every fetch | Fall back to schedule |

## Data Boundary Rules
- Static GTFS files (stops.txt, routes.txt, etc.): committed to `data/public/gtfs/`
- Realtime snapshots: DB only
- User trip data: DB only
- Weather data: DB only (API-fetched, ephemeral)
