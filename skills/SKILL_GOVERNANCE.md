# Skill Governance

## Principles
1. **Project-anchored**: Every skill must reference specific files, tables, and APIs in this repo
2. **Deterministic**: Workflows must be reproducible given the same inputs
3. **Validated**: Every skill must include exact verification commands
4. **Minimal**: One skill per domain boundary — no overlapping responsibilities
5. **Evolvable**: Skills can be created, split, merged, or deprecated through the evolution process

## Current Skills
| Skill | Domain | Primary File |
|-------|--------|-------------|
| `transit-data-pipeline` | PATH data ingestion + GTFS-RT | `src/lib/services/transit.ts` |
| `recommendation-tuning` | Scoring engine + correlation + learned penalties | `src/lib/engine/recommend.ts` |
| `checkin-lifecycle` | Session management + streaks + offline sync | `src/lib/actions/commute.ts` |
| `notification-system` | Push + cron + dry-run + history | `src/lib/services/push.ts` |
| `calendar-integration` | Google Calendar OAuth + disconnect | `src/lib/services/calendar.ts` |
| `schema-evolution` | Database schema management | `src/lib/db/schema.ts` |
| `data-governance` | Data boundary policy + CI enforcement | `scripts/check-data-boundary.sh` |

## Skill File Structure
```
skills/
├── SKILL_GOVERNANCE.md       # This file
├── EVOLUTION_LOG.md           # Mutation history
├── PROJECT_ANCHORS.md         # Skill → file/entity mapping
├── transit-data-pipeline.md   # Skill definitions
├── recommendation-tuning.md
├── checkin-lifecycle.md
├── notification-system.md
├── calendar-integration.md
└── schema-evolution.md
```

## Required Sections in Each Skill
1. **Purpose**: One-line description
2. **Triggers**: When this skill activates (user queries / file changes)
3. **Project Anchors**: Reference to PROJECT_ANCHORS.md section
4. **Workflow**: Numbered steps for execution
5. **Invariants**: Rules that must never be violated
6. **Validation**: Exact commands to verify correctness

## Evolution Rules
- CREATE: Only when a new domain boundary emerges (new service, new engine, new integration)
- SPLIT: When a skill covers >3 unrelated files or >2 independent workflows
- MERGE: When two skills always activate together and share >50% of their anchors
- DEPRECATE: When the underlying feature is removed from the codebase

## Triggering Evolution
1. After a major feature addition, review if existing skills cover the new code
2. If repeated work touches files not covered by any skill, create a new one
3. If a skill's anchor list grows beyond 10 entries, consider splitting
4. Run the evolution check: review `git log --stat` for patterns
