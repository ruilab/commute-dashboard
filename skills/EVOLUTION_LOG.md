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

*Future entries will be appended here with the same format.*
