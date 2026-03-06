# Project Domain Map — Commute Dashboard

## Entities

| Entity | Table | Key Fields | Notes |
|--------|-------|-----------|-------|
| User | `users` | id, name, email, githubUsername | Auth.js managed; single-user allowlist |
| UserSettings | `user_settings` | walkTimes×4, windows×4, push prefs, activeRoute | 1:1 with user |
| CommuteSession | `commute_sessions` | userId, direction, startedAt, completedAt, totalDurationMin | Missing: route column |
| CommuteEvent | `commute_events` | sessionId, step, timestamp | Steps: start→station→board→arrive(wtc/jsq)→destination |
| CommuteTag | `commute_tags` | sessionId, tag, note | Freeform: path_delay, crowded, missed_train, bad_weather, slow_walking |
| RecommendationSnapshot | `recommendation_snapshots` | userId, direction, bestBand, confidence, explanation | Persisted on each dashboard load |
| TransitSnapshot | `transit_snapshots` | route, status, headwayMin, source, rawData | Missing: GTFS-RT source metadata |
| WeatherSnapshot | `weather_snapshots` | temp, feelsLike, precipProb, windSpeed, condition | Open-Meteo sourced |
| PushSubscription | `push_subscriptions` | userId, endpoint, p256dh, auth | Web Push VAPID |
| CalendarConnection | `calendar_connections` | userId, accessToken, refreshToken, calendarId, enabled | Google OAuth |

## Key Workflows

### 1. Recommendation Generation (`src/lib/actions/dashboard.ts` → `src/lib/engine/recommend.ts`)
```
getSettings → getTransitStatus(route) + getWeather() + getHistoricalStats(×2) + getCalendarContext()
  → generateRecommendation(morning) + generateRecommendation(evening)
  → persistSnapshots(fire-and-forget)
  → return serialized dashboard data
```
Scoring: walk + wait + trainTime + delayPenalty + weatherPenalty + historicalAdj

### 2. Check-in Lifecycle (`src/lib/actions/commute.ts`)
```
startSession(direction) → creates session + "start_commute" event
  → addEvent(step) × N → on "arrived_destination": compute totalDurationMin, set completedAt
  → addTag(tag, note?) at any time during session
```
Online: server actions. Offline: IndexedDB queue → `/api/checkin/sync` via service worker background sync.

### 3. Transit Data Pipeline (`src/lib/services/transit.ts`)
```
getTransitStatus(routeId):
  fetchPathRealtime(PANYNJ JSON) || null  ← needs GTFS-RT protobuf path
  + fetchServiceAlerts(PANYNJ JSON) || null
  + schedule fallback (always available)
  → merge into TransitInfo
```

### 4. Push Notification Flow (`src/lib/services/push.ts`)
```
sendPushNotification(userId, payload) → web-push → subscriber endpoint
Subscription: POST /api/push/subscribe → savePushSubscription
```
**Gap**: Nothing proactively calls sendPushNotification. No cron trigger.

### 5. Calendar Flow (`src/lib/services/calendar.ts`)
```
GET /api/calendar/connect → Google OAuth consent
GET /api/calendar/callback → exchange code → store tokens
getCalendarContext(userId) → fetchTodayEvents → compute mustArriveBy
```
**Gap**: No disconnect endpoint. No status display.

## Invariants & Constraints

- **Auth**: GitHub OAuth only. ALLOWED_GITHUB_USERS env var gates access. Middleware enforces on all non-auth routes.
- **Timing**: Morning window default 08:30–10:00 ET. Evening 19:00–21:00 ET. Weekdays only.
- **Route semantics**: 4 routes (JSQ-WTC/JSQ-33/HOB-WTC/HOB-33). Each has baseTrainTimeMin and schedule headways. `activeRoute` is currently single string (not array).
- **Data freshness**: Transit revalidate 60s (realtime), 120s (alerts). Weather 600s. No background refresh.
- **Offline**: Service worker caches app shell. IndexedDB queues check-in events. Background sync tag: "sync-checkins".

## Glossary

| Term | Meaning |
|------|---------|
| Band | 10-minute departure time window (e.g. "8:40–8:50 AM") |
| Headway | Time between consecutive trains on a route |
| Direction | "outbound" (home→office) or "return" (office→home) |
| Confidence | "high"/"medium"/"low" — recommendation reliability |
| Severity | Transit impact 0–1 (normal=0, delays=0.5, suspended=1.0) |
| Penalty | Weather impact 0–1 added to commute estimate |
| Streak | Consecutive weekdays with check-in or on-time arrival |

## Canonical File Anchors

| Domain | Primary Files |
|--------|--------------|
| Schema | `src/lib/db/schema.ts` |
| DB connection | `src/lib/db/index.ts` |
| Auth | `src/lib/auth.ts`, `src/middleware.ts` |
| Transit service | `src/lib/services/transit.ts` |
| Weather service | `src/lib/services/weather.ts` |
| Calendar service | `src/lib/services/calendar.ts` |
| Push service | `src/lib/services/push.ts` |
| Recommendation engine | `src/lib/engine/recommend.ts` |
| Correlation engine | `src/lib/engine/correlation.ts` |
| Streaks engine | `src/lib/engine/streaks.ts` |
| Dashboard action | `src/lib/actions/dashboard.ts` |
| Commute actions | `src/lib/actions/commute.ts` |
| Settings actions | `src/lib/actions/settings.ts` |
| Insights action | `src/lib/actions/insights.ts` |
| Offline support | `src/lib/offline.ts`, `public/sw.js` |
| Dashboard UI | `src/components/dashboard/dashboard-content.tsx` |
| Check-in UI | `src/components/checkin/checkin-flow.tsx` |
| Settings UI | `src/components/settings/settings-form.tsx` |
| Insights UI | `src/components/insights/insights-content.tsx` |
| Widget | `src/app/widget/page.tsx`, `src/app/api/widget/route.ts` |
| CI | `.github/workflows/ci.yml` |
