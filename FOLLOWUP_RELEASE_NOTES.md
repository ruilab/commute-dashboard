# V2.5 Follow-up Hardening Release Notes

## A) Closed Known Unknowns

### A1: GTFS-RT Binary Protobuf
- Real protobuf decode via `protobufjs` (runtime dependency added)
- Schema defined inline using protobufjs reflection API (no .proto file)
- Handles FeedMessage → entity[] → TripUpdate → StopTimeUpdate structure
- Extracts route_id, stop_id, arrival/departure timestamps
- Falls back to JSON parsing when binary decode fails
- Both paths feed into the same `ParsedTripUpdate` interface

### A2: E2E Auth for CI
- **No middleware bypass** — auth is strictly via GitHub OAuth + allowlist
- Public pages tested directly (sign-in, offline, auth error)
- Protected pages tested via redirect assertions (verify auth wall works)
- API endpoints tested for correct 401 responses
- For production authenticated E2E: use a test GitHub account + Playwright storageState
- See `tests/e2e/README.md` for setup

### A3: Route-Filtered Insights
- `getInsightsData()` accepts optional `routeFilter` parameter
- Without filter, uses user's `activeRoutes` from settings
- SQL WHERE clause includes `commute_sessions.route IN (...)` when routes provided
- New `routeBreakdown` field in response: per-route count + avgDuration
- Foundation for route selector UI on insights page

### A4: Cron Production Readiness
- Dry-run mode: `GET /api/cron?dry=1` — fetches data but skips DB writes and notifications
- Diagnostic response includes: transitSource, weatherSource, usersChecked, elapsedMs
- Useful for verifying cron is working without side effects

### A5: Email Deferred
Documented as backlog item. Prerequisites:
- Choose provider (Resend recommended for Vercel)
- Add `RESEND_API_KEY` env var
- Add email templates for morning summary
- Wire into cron endpoint notification section

## B) Data Boundary Policy

### Implemented
- `docs/DATA_BOUNDARY.md` — full policy with allowed/prohibited examples
- `.gitignore` updated — `data/private/`, `*.sqlite`, `*.db`, `*.dump`, `*.sql.gz`, test artifacts
- `scripts/check-data-boundary.sh` — validates no tracked violations (secret patterns, env files, DB files)
- CI runs boundary check before lint/build
- `data/public/` directory for reference data
- CLAUDE.md updated with data boundary policy section

### Policy Summary
| Data Type | Location | Committed? |
|-----------|----------|-----------|
| Route configs, schedules | Code constants / `data/public/` | Yes |
| User sessions, settings | Vercel Postgres | No |
| OAuth tokens | Vercel Postgres | No |
| Secrets, API keys | `.env` → Vercel env vars | No |

## C) Environment Reproducibility

- `mise.toml` — declares bun 1.3 + node 20
- `Brewfile` — `brew bundle` installs bun + mise
- README updated with full bootstrap from zero

## D) Skill Evolution

### New Skill
- `data-governance` — anchored to boundary check script, .gitignore, DATA_BOUNDARY.md, CI step

### Updated Skills
- `transit-data-pipeline` — protobufjs binary decode is now real, not a stub
- `notification-system` — cron dry-run mode documented
- `recommendation-tuning` — route-filtered insights wired
- `checkin-lifecycle` — test user auth strategy documented

### Governance
- SKILL_GOVERNANCE.md updated with 7 skills (was 6)
- EVOLUTION_LOG.md entry for hardening pass with rationale + 3 new scenarios validated

## Validation Summary

```
$ bun run lint           → 0 errors, 0 warnings
$ bun run typecheck      → 0 errors
$ bun run build          → 19 routes (4 static, 15 dynamic)
$ bash scripts/check-data-boundary.sh → PASSED
```

## Deferred Items

| Item | Status | Prerequisites |
|------|--------|--------------|
| Email notification channel | Deferred | Resend account, RESEND_API_KEY, email templates |
| Route selector UI on insights page | Ready to build | Schema + action complete, UI needed |
| Authenticated E2E in CI | Manual setup needed | Test GitHub account, storageState export |
