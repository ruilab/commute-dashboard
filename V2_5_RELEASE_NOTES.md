# V2.5 Release Notes

## Bun-First Migration
- Replaced npm with Bun (1.3.9): `bun install`, `bun run`, `bunx`
- CI migrated to `oven-sh/setup-bun` with frozen lockfile
- Fixed lint script (`eslint src/` replaces broken `next lint` in Next 16)
- Added `typecheck` script (`tsc --noEmit`)

## Completed TODOs from V2_PLAN

### 1. GTFS-RT Protobuf Ingestion
- `fetchGtfsRt()` in `src/lib/services/transit.ts`
- Supports JSON GTFS-RT feeds; binary protobuf falls through to JSON feed
- Configurable via `GTFSRT_FEED_URL` env var
- Source tracked as "gtfsrt" in transit snapshots

### 2. Proactive Push Triggers
- `GET /api/cron` endpoint handles all proactive notifications
- Leave reminders: weekday mornings, 15 min before window start
- Service alerts: on PATH delays/suspension, deduped per hour
- Weather alerts: on severe weather, deduped per day
- All notifications logged to `notification_log` table
- Dedup via tag-based lookup against today's sent notifications
- Vercel cron: every 10 min during commute hours (`vercel.json`)
- Secured via `CRON_SECRET` bearer token

### 3. Calendar Disconnect / Re-auth
- `POST /api/calendar/disconnect` endpoint
- `CalendarStatus` component shows connected state with Disconnect button
- Re-auth: user clicks "Connect Google Calendar" again (fresh OAuth flow)

### 4. Background Data Refresh
- Cron endpoint persists transit + weather snapshots on every run
- `sourceType` column on `transit_snapshots` tracks data provenance

### 5. E2E Tests
- Playwright configured with `playwright.config.ts`
- Test suite in `tests/e2e/checkin.spec.ts`
- Tests: sign-in page, widget page, offline page, auth error page, API endpoints
- Note: Full interactive check-in E2E requires authenticated session + DB

### 6. API Rate Limiting
- In-memory token-bucket rate limiter (`src/lib/rate-limit.ts`)
- Applied to: `/api/checkin/sync` (30/0.5s), `/api/push/subscribe` (5/0.1s), `/api/widget` (20/0.33s), `/api/cron` (3/0.05s)
- Returns 429 with Retry-After header

### 7. Correlation: Temperature + Wind Bucketing
- Temperature buckets: freezing (<32°F), cold (32–50), mild (50–70), warm (70–85), hot (≥85)
- Wind buckets: calm (<8mph), moderate (8–18), strong (18–30), very strong (≥30)
- Learned penalties: `extremeTemp` and `highWind` now computed from data
- New insight types: `temp_impact`, `wind_impact`

### 8. Streak Persistence
- `streak_snapshots` table persists computed streaks per user
- 6-hour cache: reads snapshot if fresh, full recompute + persist when stale
- Eliminates repeated full-table scans on each insights page load

### 9. Multi-Route Simultaneous
- `activeRoutes` JSONB array in `user_settings` (backward compat: single `activeRoute` kept)
- Settings UI: multi-select checkboxes for routes
- Dashboard fetches primary route's full data + status of additional routes
- Route stored per commute session (`commute_sessions.route` column)

### 10. Widget Auto-Refresh
- `WidgetAutoRefresh` client component uses `router.refresh()` on interval
- Default: 5-minute refresh cycle
- Shows "AI-tuned" badge when using learned correlation penalties

## Feature Expansions

### A. Notification History
- `notification_log` table stores all sent notifications
- `/notifications` page with server-rendered history list
- Linked from Settings page
- Shows type icon, title, body, timestamp, delivery status

### B. Route-Aware Sessions
- `commute_sessions.route` column (default "JSQ-WTC")
- `startSession()` accepts route parameter
- Foundation for route-filtered insights (future)

### C. Learned Penalties in Engine
- `EngineInput.learnedPenalties` optional field
- `scoreBand()` uses correlation-derived penalties when available:
  - Rain/snow: multiplied by weather severity
  - Extreme temp: additive penalty when outside 32–85°F
  - High wind: additive penalty when >18mph
  - Transit delay: replaces heuristic when learned value > 0
- Falls back to heuristic constants when insufficient data (<5 data points)

## Project-Specific Skills
- 6 autonomous skills in `skills/` directory
- Each anchored to specific project files, tables, and APIs
- Governance documented in `skills/SKILL_GOVERNANCE.md`
- Evolution mechanism with dry-run/apply documented

## Schema Changes
New tables: `streak_snapshots`, `notification_log`, `rate_limit_buckets`
New columns:
- `commute_sessions.route` (text, default "JSQ-WTC")
- `transit_snapshots.source_type` (text, nullable)
- `user_settings.active_routes` (jsonb, default ["JSQ-WTC"])

All new columns have defaults — backward compatible with existing data.

## New Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `GTFSRT_FEED_URL` | No | GTFS-RT feed URL for PATH |
| `CRON_SECRET` | Prod | Bearer token for cron endpoint |

## Validation Summary
```
bun run lint      → 0 errors, 0 warnings
bun run typecheck → 0 errors
bun run build     → 19 routes compiled
```
