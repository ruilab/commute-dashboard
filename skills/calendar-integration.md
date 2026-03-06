# Skill: calendar-integration

## Purpose
Manage Google Calendar OAuth flow, token lifecycle, event fetching, and "must arrive by" constraint computation for morning recommendations.

## Triggers
- "Calendar not connecting / token expired"
- "Meeting time not reflected in recommendations"
- "Add disconnect / re-auth"
- "Support a different calendar provider"
- Changes to `src/lib/services/calendar.ts` or `src/app/api/calendar/`

## Project Anchors
See `skills/PROJECT_ANCHORS.md` → `calendar-integration`

## Workflow
1. **Trace the OAuth flow**:
   `GET /api/calendar/connect` → Google consent → `GET /api/calendar/callback` → store tokens in `calendar_connections`
2. **Check tokens**: Read `calendar_connections` — verify accessToken exists, expiresAt not past
3. **Test fetch**: `getCalendarContext()` should return today's events and mustArriveBy
4. **Modify**:
   - Token refresh: `calendar.ts:refreshGoogleToken()` handles automatic refresh
   - Event filtering: `calendar.ts:fetchTodayEvents()` — adjust time range or event filters
   - Constraint computation: `mustArriveBy = firstMeetingTime - walkWtcToOffice - 5min buffer`
   - Dashboard wiring: `dashboard.ts` adjusts morningWindowEnd based on mustArriveBy

## Invariants
- Calendar is optional — all features work without it
- `getCalendarContext()` MUST never throw — returns empty context on any failure
- Token refresh happens automatically when expiresAt is past
- Only reads calendar (scope: `calendar.events.readonly`)
- Disconnect deletes the entire `calendar_connections` row
- Re-auth: user just clicks "Connect Google Calendar" again

## Validation
```bash
bun run typecheck
bun run build
# Manual: verify /settings shows correct calendar connection status
```
