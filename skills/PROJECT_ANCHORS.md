# Project Anchors — Skill → File/Entity Mapping

## transit-data-pipeline
| Anchor | Path/Entity |
|--------|------------|
| Transit service | `src/lib/services/transit.ts` |
| GTFS-RT parser | `src/lib/services/transit.ts:fetchGtfsRt()` |
| PANYNJ JSON fetch | `src/lib/services/transit.ts:fetchPathRealtime()` |
| Alert parser | `src/lib/services/transit.ts:fetchServiceAlerts()` |
| Route configs | `src/lib/services/transit.ts:ROUTES` |
| Transit snapshots table | `src/lib/db/schema.ts:transitSnapshots` |
| Cron refresh | `src/app/api/cron/route.ts` (transit section) |
| Dashboard integration | `src/lib/actions/dashboard.ts:getDashboardData()` |
| Env vars | `GTFSRT_FEED_URL` |

## recommendation-tuning
| Anchor | Path/Entity |
|--------|------------|
| Scoring engine | `src/lib/engine/recommend.ts:scoreBand()` |
| Learned penalties | `src/lib/engine/recommend.ts:LearnedPenalties` |
| Correlation analysis | `src/lib/engine/correlation.ts:analyzeCorrelations()` |
| Weather bucketing | `src/lib/engine/correlation.ts:computeTempBuckets()` |
| Wind bucketing | `src/lib/engine/correlation.ts:computeWindBuckets()` |
| Confidence logic | `src/lib/engine/recommend.ts:determineConfidence()` |
| Explanation generator | `src/lib/engine/recommend.ts:generateExplanation()` |
| Dashboard action | `src/lib/actions/dashboard.ts` (learnedPenalties wiring) |
| Recommendation snapshots | `src/lib/db/schema.ts:recommendationSnapshots` |

## checkin-lifecycle
| Anchor | Path/Entity |
|--------|------------|
| Server actions | `src/lib/actions/commute.ts` |
| Sync API | `src/app/api/checkin/sync/route.ts` |
| Check-in UI | `src/components/checkin/checkin-flow.tsx` |
| Sessions table | `src/lib/db/schema.ts:commuteSessions` |
| Events table | `src/lib/db/schema.ts:commuteEvents` |
| Tags table | `src/lib/db/schema.ts:commuteTags` |
| Offline queue | `src/lib/offline.ts`, `public/sw.js` |
| Rate limiter | `src/lib/rate-limit.ts` |
| Streaks engine | `src/lib/engine/streaks.ts` |
| Streak snapshots | `src/lib/db/schema.ts:streakSnapshots` |

## notification-system
| Anchor | Path/Entity |
|--------|------------|
| Push service | `src/lib/services/push.ts` |
| Subscribe API | `src/app/api/push/subscribe/route.ts` |
| Cron triggers | `src/app/api/cron/route.ts` (notification section) |
| Notification log | `src/lib/db/schema.ts:notificationLog` |
| Notification UI | `src/components/notifications/notification-history.tsx` |
| Push subscriptions | `src/lib/db/schema.ts:pushSubscriptions` |
| User preferences | `src/lib/db/schema.ts:userSettings` (push* columns) |
| Service worker | `public/sw.js` (push handler) |
| Settings UI | `src/components/settings/settings-form.tsx` (notification section) |
| Env vars | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |

## calendar-integration
| Anchor | Path/Entity |
|--------|------------|
| Calendar service | `src/lib/services/calendar.ts` |
| Connect API | `src/app/api/calendar/connect/route.ts` |
| Callback API | `src/app/api/calendar/callback/route.ts` |
| Disconnect API | `src/app/api/calendar/disconnect/route.ts` |
| Calendar connections | `src/lib/db/schema.ts:calendarConnections` |
| Settings UI | `src/components/settings/calendar-status.tsx` |
| Dashboard wiring | `src/lib/actions/dashboard.ts` (calendar context + window adjustment) |
| Env vars | `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` |

## schema-evolution
| Anchor | Path/Entity |
|--------|------------|
| Schema source | `src/lib/db/schema.ts` |
| DB connection | `src/lib/db/index.ts` |
| Drizzle config | `drizzle.config.ts` |
| Migration dir | `drizzle/` |
| Settings table | `src/lib/db/schema.ts:userSettings` |
| All tables | All `pgTable()` exports in schema.ts |
