# Production Readiness V3

## Error Handling

| Layer | Strategy |
|-------|----------|
| React components | `ErrorBoundary` wraps feature sections; shows "Try again" on crash |
| Server actions | Try/catch with structured logging; return null/empty on failure |
| External APIs | `resilientFetch()`: timeout (5s), retry (1x), structured error logs |
| Transit service | Multi-source fallback: GTFS-RT → JSON API → schedule |
| Weather service | Returns zero/empty on API failure; doesn't block recommendations |
| DB queries | Fail-fast; don't catch silently — surface to user via error boundary |

## Observability

| Component | Location |
|-----------|----------|
| Structured logger | `src/lib/logger.ts` — JSON in prod, readable in dev |
| Cron diagnostics | `/api/cron?dry=1` returns timing + source status |
| Data ingestion log | `data_ingestion_log` table tracks every ingestion run |
| Notification log | `notification_log` table tracks all sent notifications |
| Transit snapshot freshness | `transit_snapshots.fetchedAt` + `sourceType` |

## Security (current state)

| Control | Status |
|---------|--------|
| Auth: GitHub OAuth + signup code gate | Active |
| Session: DB sessions via Auth.js adapter | Active |
| Rate limiting: in-memory token-bucket | Active on all write endpoints |
| CSRF: Origin checking on write endpoints | Active in production |
| Cron: CRON_SECRET bearer auth | Active; timing-safe comparison |
| Secret scanning: betterleaks/gitleaks | Active in CI |
| Input sanitization: issue formatter | Active for feature requests |

## Graceful Degradation

| Scenario | Behavior |
|----------|----------|
| Transit API down | Schedule-based fallback; "stale" indicator; lower confidence |
| Weather API down | Zero-value weather; no weather penalty in scoring |
| Recommendation engine throws | Dashboard keeps rendering and shows schedule-based fallback departure bands with low confidence |
| Calendar disconnected | No calendar constraint; wider departure window |
| DB connection error | Error boundary shows "Try again"; no silent data loss |
| GitHub issue API down | Feature request returns 502; user sees error message |

## Operational Checklist

1. [ ] Push schema: `bunx drizzle-kit push` after any schema change
2. [ ] Verify env vars: all required vars set in Vercel
3. [ ] Run betterleaks before push: `betterleaks dir .`
4. [ ] Check boundary: `bash scripts/check-data-boundary.sh`
5. [ ] Monitor cron: check Vercel Cron Jobs tab
6. [ ] Review logs: `vercel logs <deployment-url>`
