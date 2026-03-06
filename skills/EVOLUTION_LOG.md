# Skill Evolution Log

## 2026-03-06: Initial Creation (v2.5)

### Action: CREATE × 6
**Rationale**: Derived from PROJECT_DOMAIN_MAP.md entity/workflow analysis.
**Evidence**: Codebase has 6 clear domain boundaries:
- Transit data pipeline (3 fetch functions, 1 service, 1 snapshot table)
- Recommendation engine (scoring, correlation, confidence — 2 engine files)
- Check-in lifecycle (actions, UI, offline sync, streaks — 5+ files)
- Notification system (push service, cron, log, preferences — 4+ files)
- Calendar integration (OAuth flow, service, settings — 4 files)
- Schema evolution (16 tables, migration tooling)

**Skills created**:
1. `transit-data-pipeline` — anchored to `src/lib/services/transit.ts`
2. `recommendation-tuning` — anchored to `src/lib/engine/recommend.ts`
3. `checkin-lifecycle` — anchored to `src/lib/actions/commute.ts`
4. `notification-system` — anchored to `src/lib/services/push.ts`
5. `calendar-integration` — anchored to `src/lib/services/calendar.ts`
6. `schema-evolution` — anchored to `src/lib/db/schema.ts`

**Validation**: Each skill references specific files, tables, functions, and env vars in PROJECT_ANCHORS.md.

### Scenarios Validated
1. **"PATH data is stale"** → `transit-data-pipeline` activates → reads transit.ts → checks GTFSRT_FEED_URL → inspects transit_snapshots → diagnosis
2. **"Recommendations too conservative"** → `recommendation-tuning` activates → reads scoreBand() → checks learned penalties → adjusts weights
3. **"Check-in button not working"** → `checkin-lifecycle` activates → traces checkin-flow.tsx → checks commute actions → verifies sync API

---

## 2026-03-06: Hardening Pass (v2.5 follow-up)

### Action: CREATE × 1, UPDATE × 4
**Rationale**: Data boundary policy is a new domain boundary; existing skills need updates for new capabilities.

**Created**:
- `data-governance` — anchored to `scripts/check-data-boundary.sh`, `docs/DATA_BOUNDARY.md`, `.gitignore`
  - Trigger: public repo requires explicit data boundary enforcement
  - Evidence: No prior policy existed; need CI guard against accidental data leaks

**Updated**:
- `transit-data-pipeline` — added protobufjs binary decode path (no longer a stub)
- `notification-system` — added cron dry-run mode (`?dry=1`), diagnostics response
- `recommendation-tuning` — added route-filtered insights integration
- `checkin-lifecycle` — added test user auth strategy for production E2E

### Scenarios Validated
1. **"Did I accidentally commit .env?"** → `data-governance` activates → runs boundary check script → identifies violation → removal instructions
2. **"Cron seems broken in production"** → `notification-system` activates → calls `/api/cron?dry=1` → reads diagnostics → identifies source/timing issues
3. **"Insights don't show JSQ-33 trips"** → `recommendation-tuning` activates → checks `getInsightsData()` route filter → verifies activeRoutes wiring

---

*Future entries will be appended here with the same format.*
