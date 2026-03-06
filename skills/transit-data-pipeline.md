# Skill: transit-data-pipeline

## Purpose
Manage the PATH train data ingestion pipeline: GTFS-RT, PANYNJ JSON, schedule fallback, and snapshot persistence.

## Triggers
- "PATH data is stale/wrong/missing"
- "Add a new transit data source"
- "Transit headway seems off"
- "GTFS-RT feed changed URL or format"
- "Add a new PATH route"
- Changes to `src/lib/services/transit.ts`

## Project Anchors
See `skills/PROJECT_ANCHORS.md` → `transit-data-pipeline`

## Workflow
1. **Diagnose**: Read `src/lib/services/transit.ts` to understand current data sources
2. **Check env**: Verify `GTFSRT_FEED_URL` is set (controls whether GTFS-RT is active)
3. **Inspect snapshots**: Query `transit_snapshots` to see what `sourceType` values are being recorded
4. **Modify pipeline**:
   - To add source: Add `fetch*` function, wire into `getTransitStatus()` parallel fetch
   - To fix parsing: Update the relevant `fetch*` function
   - To add route: Add entry to `ROUTES` constant with stations, keywords, baseTrainTimeMin
5. **Test**: `bun run build && bun run lint`
6. **Verify**: Check that `getTransitStatus()` returns non-null with fallback chain working

## Invariants
- `getTransitStatus()` MUST always return a valid `TransitInfo` (never throw)
- Schedule fallback MUST always be available as last resort
- `source` field must accurately reflect which data source provided the result
- `isStale` must be true when no realtime/alert data was available
- All fetches must have `signal: AbortSignal.timeout(5000)` to prevent hanging

## Validation
```bash
bun run typecheck  # No errors in transit.ts
bun run lint       # No warnings in transit.ts
bun run build      # Build succeeds
```
