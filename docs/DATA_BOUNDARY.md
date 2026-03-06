# Data Boundary Policy

## Principle
Public/reference data may live in the repo. User-specific and private data must never be committed.

## Allowed in repo (`data/public/`)
- PATH route schedules (static timetables)
- Station name mappings
- Holiday calendars
- Default configuration values
- Test fixtures with synthetic data

## Prohibited from repo (must stay in DB or .env)
- User sessions, settings, preferences
- OAuth tokens (GitHub, Google Calendar)
- Push notification subscriptions
- Commute history / events / tags
- Weather/transit snapshots with timestamps
- Notification logs
- Any `.env` file contents
- Database exports (`*.sql`, `*.dump`, `*.csv` with user data)
- SQLite databases (`*.sqlite`, `*.db`)

## Enforcement

### .gitignore rules
```
data/private/
*.sqlite
*.db
*.dump
*.sql.gz
test-results/
playwright-report/
```

### Boundary check script
Run before committing:
```bash
bash scripts/check-data-boundary.sh
```

This script fails if:
- Files matching private data patterns are staged in git
- `.env` files (not `.env.example`) are tracked
- Database files are tracked
- `data/private/` contents are tracked

### CI enforcement
The CI workflow runs the boundary check as a step.

## Data Flow Summary
```
Public data:    Code constants / data/public/ → committed to git
User data:      Server actions → Vercel Postgres → never in git
Private config: .env → gitignored → Vercel env vars in production
Test data:      Synthetic only → data/public/test-fixtures/
```
