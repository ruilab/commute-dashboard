# Product V3 — Tri-State Office Commute

## Vision
A production-grade commute optimization tool for tri-state area (NY/NJ/CT) office workers. Users commute from diverse home locations — NJ suburbs, NYC boroughs, CT towns — to offices in Manhattan, using subway, PATH, bus, Metro-North, NJ Transit, LIRR, or ferry.

## Commuter Profile Model

| Entity | Description | Storage |
|--------|------------|---------|
| Home area | Neighborhood/zone (e.g. "Jersey City Heights", "Hoboken", "Astoria") | DB: user_profiles |
| Office location | Building/area (e.g. "WTC", "Midtown 33rd", "FiDi") | DB: user_profiles |
| Commute window | Morning and evening departure ranges | DB: user_settings |
| Preferred modes | Ordered list: subway, PATH, bus, LIRR, NJT, ferry | DB: user_profiles |
| Risk tolerance | Conservative/moderate/aggressive departure timing | DB: user_profiles |
| Reliability preference | Prioritize: fastest avg, most reliable, least crowded | DB: user_profiles |

## Supported Transit Modes (phased)

| Mode | V3.0 | V3.1 | V3.2 |
|------|------|------|------|
| PATH | Active | Active | Active |
| NYC Subway (MTA) | Schema ready | Data collection | Recommendations |
| NJ Transit Rail | Schema ready | Data collection | Recommendations |
| Bus (NJT/MTA) | Schema ready | Planned | Planned |
| Ferry | Schema ready | Data collection | Recommendations |
| LIRR | Schema ready | Planned | Planned |

## User Journey

1. **Sign up** → Signup code + GitHub OAuth
2. **Onboard** → Home area, office, preferred modes, commute window, preferences
3. **Daily use** → Dashboard shows departure recommendation with confidence
4. **Track** → Check-in flow records actual trip for learning
5. **Learn** → System improves recommendations from user's history
6. **Review** → Insights show patterns, changelog shows product updates

## Architecture Principles

- **Data collection first**: Gather schedule/status/weather data before building recommendations
- **Per-user everything**: Settings, routes, modes, windows stored per user in DB
- **Public reference data in repo**: Static schedules, station lists, route metadata under `data/public/`
- **Graceful degradation**: Missing data source → lower confidence, not broken page
- **Phone-first**: Every screen optimized for mobile viewport
