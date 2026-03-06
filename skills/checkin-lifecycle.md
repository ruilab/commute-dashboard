# Skill: checkin-lifecycle

## Purpose
Manage the commute check-in flow: start session, record events, add tags, complete session, compute duration, update streaks, handle offline sync.

## Triggers
- "Check-in isn't working / events not saving"
- "Add a new check-in step"
- "Offline check-ins not syncing"
- "Streak calculation seems wrong"
- "Duration is calculated incorrectly"
- Changes to `src/lib/actions/commute.ts` or `src/components/checkin/checkin-flow.tsx`

## Project Anchors
See `skills/PROJECT_ANCHORS.md` → `checkin-lifecycle`

## Workflow
1. **Trace the flow**:
   - Online: `checkin-flow.tsx` → server actions in `commute.ts` → DB
   - Offline: `checkin-flow.tsx` → IndexedDB via `offline.ts` → `sw.js` background sync → `/api/checkin/sync`
2. **Identify the component**:
   - UI issue → `checkin-flow.tsx` (step rendering, tap targets, state management)
   - Data issue → `commute.ts` (session lifecycle, duration computation)
   - Sync issue → `offline.ts` + `sw.js` + `api/checkin/sync/route.ts`
   - Streak issue → `streaks.ts` (computation logic) + `streakSnapshots` (persistence)
3. **Modify**: Edit the relevant file
4. **Verify**: Build + test that:
   - `startSession()` creates session + first event
   - `addEvent("arrived_destination")` completes session with duration
   - `getActiveSession()` returns null when no active session

## Invariants
- A session has exactly one direction: "outbound" | "return"
- Events must be ordered: start → station → board → arrive → destination
- `arrived_destination` event triggers session completion (sets completedAt + totalDurationMin)
- `totalDurationMin` = (now - startedAt) in minutes, rounded to 1 decimal
- Rate limit on `/api/checkin/sync`: 30 req, 0.5 tokens/sec refill
- Streak snapshots cache for 6 hours before recompute

## Event Steps
```
outbound: start_commute → reached_station → boarded_train → arrived_wtc → arrived_destination
return:   start_commute → reached_station → boarded_train → arrived_jsq → arrived_destination
```

## Validation
```bash
bun run typecheck
bun run build
bun run test  # E2E tests include checkin flow
```
