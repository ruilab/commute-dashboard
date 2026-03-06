# V2 Enhancement Plan

## Overview

Systematic execution of 10 enhancements to the commute dashboard, ordered by impact and dependency.

## Phase 1: Data Quality & Intelligence

### 1.1 GTFS-RT Integration for Real Headway Data
**Files**: `src/lib/services/transit.ts`, `src/lib/db/schema.ts`
- Add PATH GTFS-RT feed parsing (realtime trip updates, vehicle positions)
- Compute actual headway from vehicle position data
- Replace schedule-based headway estimates with live data when available
- Keep schedule fallback for when GTFS-RT is unavailable
- Store raw GTFS-RT snapshots for historical analysis

### 1.2 Weather-Delay Correlation Analysis
**Files**: `src/lib/engine/recommend.ts`, `src/lib/actions/insights.ts`, new: `src/lib/engine/correlation.ts`
- Analyze stored weather + commute snapshots to find actual correlations
- Compute weather-adjusted duration predictions per band
- Replace static weather penalty with learned coefficients
- Add weather correlation insights to the insights page
- Show "rain adds ~X min on average" type findings

### 1.3 Better PATH Data Sources
**Files**: `src/lib/services/transit.ts`
- Add PATH realtime arrival API (path.api.mta.info if available)
- Parse service alerts for planned work / weekend changes
- Detect weekend/holiday schedules automatically
- Add "planned service changes" display to dashboard

## Phase 2: Notifications & Proactive Alerts

### 2.1 Web Push Notifications
**Files**: new: `src/lib/services/push.ts`, `src/app/api/push/`, `src/lib/db/schema.ts`, `public/sw.js`
- Service worker for push notification handling
- VAPID key generation and subscription management
- Push subscription stored in DB per user
- Notification triggers: "time to leave", "service alert", "weather change"
- Settings page: enable/disable push, configure trigger preferences

### 2.2 Notification Preferences & Email
**Files**: new: `src/lib/services/notify.ts`, settings form, schema
- Unified notification service (push + email)
- Per-channel preferences in user_settings
- Email via Resend/SendGrid for daily morning summary (optional)
- Notification history/log

## Phase 3: Richer User Experience

### 3.1 Calendar Integration
**Files**: new: `src/lib/services/calendar.ts`, dashboard, schema
- Google Calendar OAuth (read-only) for first meeting time
- Adjust morning recommendation based on "must arrive by X"
- Show "first meeting at 9:30 → leave by 8:40" on dashboard
- Settings: enable/disable, calendar selection

### 3.2 Commute Streaks & Gamification
**Files**: new: `src/lib/engine/streaks.ts`, new: `src/components/insights/streaks.tsx`, schema
- Track consecutive check-in days
- Streak types: check-in streak, on-time streak, sub-30-min streak
- Display streak counter on dashboard
- Weekly/monthly summaries
- Personal bests

### 3.3 Offline Sync with Service Worker
**Files**: new: `public/sw.js` (extend), new: `src/lib/offline.ts`, checkin flow
- Cache app shell for offline access
- Queue check-in events when offline (IndexedDB)
- Sync queued events when back online
- Show offline indicator in UI
- Cache last dashboard data for offline viewing

## Phase 4: Scale & Multi-Route

### 4.1 Multi-Route Support
**Files**: schema, transit service, engine, settings, dashboard, all pages
- Route configuration table (stations, walking legs, train time)
- Pre-configured routes: JSQ↔WTC, JSQ↔33rd, HOB↔WTC, HOB↔33rd
- User can select active route(s)
- Recommendation engine parameterized by route
- Dashboard shows selected route(s)

### 4.2 Widget / Quick Glance View
**Files**: new: `src/app/widget/page.tsx`, new API endpoint
- Minimal standalone page optimized for phone home screen shortcut
- Single-card view: best departure + confidence
- Auto-refreshes every 5 min
- Works as PWA shortcut / iOS home screen widget via Shortcuts app
- API endpoint returning JSON for automation/widget consumption

## Execution Order

1. **1.1** GTFS-RT (improves core data quality)
2. **1.3** Better PATH data (complements GTFS-RT)
3. **1.2** Weather-delay correlation (needs historical data, ships analysis)
4. **3.2** Commute streaks (immediate UX value, no external deps)
5. **3.3** Offline sync (PWA improvement, no external deps)
6. **2.1** Web push notifications (high impact, needs service worker)
7. **2.2** Notification preferences (builds on 2.1)
8. **3.1** Calendar integration (complex OAuth, deferred)
9. **4.1** Multi-route (large scope, deferred)
10. **4.2** Widget/quick glance (small, can do anytime)

## Status Tracking

- [ ] 1.1 GTFS-RT Integration
- [ ] 1.3 Better PATH Data
- [ ] 1.2 Weather-Delay Correlation
- [ ] 3.2 Commute Streaks
- [ ] 3.3 Offline Sync
- [ ] 2.1 Web Push Notifications
- [ ] 2.2 Notification Preferences
- [ ] 3.1 Calendar Integration
- [ ] 4.1 Multi-Route Support
- [ ] 4.2 Widget / Quick Glance
