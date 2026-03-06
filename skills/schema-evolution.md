# Skill: schema-evolution

## Purpose
Manage database schema changes: add columns, add tables, generate migrations, ensure backward compatibility, update related server actions and UI.

## Triggers
- "Add a new field to [table]"
- "Create a new table for [feature]"
- "Need to store [data] somewhere"
- "Schema push failing"
- Changes to `src/lib/db/schema.ts`

## Project Anchors
See `skills/PROJECT_ANCHORS.md` → `schema-evolution`

## Workflow
1. **Plan the change**: Determine new columns/tables needed
2. **Check backward compat**: New columns MUST have defaults (`.default(value).notNull()`) so existing rows work
3. **Edit schema**: Modify `src/lib/db/schema.ts`
4. **Generate migration**: `bun run db:generate` (creates SQL in `drizzle/`)
5. **Update actions**: Any server action that reads/writes the changed table
6. **Update UI**: Any settings form or display component that shows the new data
7. **Verify**: `bun run typecheck && bun run build`

## Invariants
- All new columns must have sensible defaults for existing rows
- JSONB columns use `.$type<T>()` for TypeScript typing
- Indexes must be named descriptively: `idx_[table]_[columns]`
- Foreign keys cascade on delete for user-owned data
- UUID primary keys via `uuid("id").defaultRandom().primaryKey()`
- Timestamps: `{ mode: "date" }` for JS Date objects
- Auth tables (users, accounts, sessions, verificationTokens) are managed by Auth.js — do not modify their structure

## Current Tables (16 total)
Auth: users, accounts, sessions, verification_tokens
App: user_settings, commute_sessions, commute_events, commute_tags
Snapshots: recommendation_snapshots, transit_snapshots, weather_snapshots
Features: push_subscriptions, calendar_connections
V2.5: streak_snapshots, notification_log, rate_limit_buckets

## Validation
```bash
bun run typecheck       # Schema types compile
bun run db:generate     # Migration generates cleanly
bun run build           # App builds with schema changes
```
