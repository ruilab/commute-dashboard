# Skill: recommendation-tuning

## Purpose
Tune the departure recommendation engine: adjust scoring weights, integrate learned penalties from correlation analysis, modify confidence logic, and improve explanation generation.

## Triggers
- "Recommendations seem off / too conservative / too aggressive"
- "Weather penalty feels wrong"
- "Confidence level doesn't match reality"
- "Add a new scoring factor"
- "Recommendation doesn't account for X"
- Changes to `src/lib/engine/recommend.ts` or `src/lib/engine/correlation.ts`

## Project Anchors
See `skills/PROJECT_ANCHORS.md` → `recommendation-tuning`

## Workflow
1. **Understand current scoring**: Read `recommend.ts:scoreBand()` — this is where all penalties combine
2. **Check learned penalties**: Read `correlation.ts:computeLearnedPenalties()` and verify the pipeline:
   `analyzeCorrelations() → learnedPenalties → dashboard.ts → generateRecommendation()`
3. **Identify the issue**:
   - Wrong time estimate → check `trainTime`, `walkBefore/After`, `waitTime` computation
   - Wrong weather impact → check `weatherWalkPenalty` and learned penalty integration
   - Wrong confidence → check `determineConfidence()` conditions
   - Missing factor → add to `EngineInput` interface and `scoreBand()`
4. **Modify**: Edit the relevant function in `recommend.ts`
5. **Update explanation**: If scoring changed, update `generateExplanation()` to reflect it
6. **Verify**: Build + check that `generateRecommendation()` still returns valid output for edge cases (empty window, suspended service, all data unavailable)

## Invariants
- `scoreBand()` score must be a finite positive number
- `estimatedDoorToDoor` must be ≥ sum of walk times (can't be faster than walking)
- Confidence must be one of: "high" | "medium" | "low"
- Explanation must be a non-empty string ending with a period
- Engine must handle null/missing learned penalties gracefully

## Key Constants
- `BASE_TRAIN_TIME = 13` (JSQ-WTC default)
- `BASE_WAIT_TIME = 5`
- `BAND_INTERVAL_MIN = 10`
- Delay heuristic: `transitSeverity * 15` (when no learned penalty)
- Weather heuristic: `weatherPenalty * 3` (when no learned penalty)

## Validation
```bash
bun run typecheck
bun run build
# Manually verify: check /api/widget returns reasonable estimatedMinutes
```
