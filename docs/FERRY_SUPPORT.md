# Ferry Support

## Status: Infrastructure Ready, Not Active

Ferry route definitions and service adapter exist but are not wired into the dashboard for any user. The `preferredMode` field in user settings enables future ferry users.

## Architecture

| Component | File | Status |
|-----------|------|--------|
| Ferry service | `src/lib/services/ferry.ts` | Stub with schedule-based data |
| Route configs | `FERRY_ROUTES` in ferry.ts | HOB-BFP, PAU-WFC defined |
| Weather sensitivity | `getFerryWeatherSeverity()` | Wind thresholds implemented |
| Schema: mode field | `user_settings.preferredMode` | "subway" or "ferry" |
| Schema: session mode | `commute_sessions.mode` | Tracks which mode was used |
| Schema: snapshot mode | `transit_snapshots.mode` | Tags data source by mode |
| Event steps | `reached_terminal`, `boarded_ferry` | Ferry-specific steps in EventStep type |
| Onboarding | Ferry option disabled with "Coming soon" | UI ready for enable |

## Ferry vs Subway Differences

| Factor | Subway | Ferry |
|--------|--------|-------|
| Headway | 4–10 min | 15–30 min |
| Missed departure cost | Low (next in minutes) | High (20–30 min wait) |
| Weather sensitivity | Low (underground) | High (wind, fog, waves) |
| Cancel threshold | Rare | Wind ≥30 mph |
| Delay threshold | Service alerts | Wind ≥20 mph |
| Season | Year-round, same schedule | Seasonal schedule changes |

## To Enable Ferry for a User

1. In onboarding UI: remove `disabled: true` from ferry option
2. In dashboard action: check `preferredMode` and call `getFerryStatus()` instead of `getTransitStatus()` when mode is "ferry"
3. In recommendation engine: apply ferry-specific penalties (higher weather weight, longer missed-departure penalty)
4. In cron: collect ferry snapshots alongside subway when any user has mode="ferry"

## Data Sources (Future)

- NYC Ferry real-time API (if available)
- NY Waterway schedule
- NJ Transit ferry schedule
- Weather-based service predictions
