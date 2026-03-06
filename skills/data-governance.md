# Skill: data-governance

## Purpose
Enforce the data boundary policy: ensure no user/private data is committed to the repo, manage public reference data, and maintain the boundary check script.

## Triggers
- "Accidentally committed private data"
- "Need to add reference data to the repo"
- "Data boundary check failing"
- "Where should I store [X] data?"
- Changes to `.gitignore`, `data/`, `scripts/check-data-boundary.sh`

## Project Anchors
| Anchor | Path |
|--------|------|
| Policy doc | `docs/DATA_BOUNDARY.md` |
| Boundary check script | `scripts/check-data-boundary.sh` |
| Gitignore rules | `.gitignore` (data boundary section) |
| Public data dir | `data/public/` |
| CI step | `.github/workflows/ci.yml` (boundary check step) |
| CLAUDE.md policy | `CLAUDE.md` (Data Boundary Policy section) |

## Workflow
1. **Classify the data**: Public/reference → `data/public/`; User-specific → DB only; Secrets → `.env` only
2. **Check current state**: `bash scripts/check-data-boundary.sh`
3. **If violation found**: Remove from git tracking, add to `.gitignore`, force-clean if needed
4. **If adding reference data**: Place in `data/public/`, ensure it's synthetic/non-user data
5. **Verify**: Run boundary check + CI

## Invariants
- `data/private/` must always be gitignored
- `.env` files (except `.env.example`) must never be tracked
- Database files (*.sqlite, *.db, *.dump) must never be tracked
- `scripts/check-data-boundary.sh` must pass in CI
- All user data flows through Drizzle ORM to Vercel Postgres only

## Validation
```bash
bash scripts/check-data-boundary.sh  # Must exit 0
git ls-files | grep -E '\.(sqlite|db|dump|sql\.gz)$'  # Must be empty
git ls-files .env  # Must be empty (only .env.example tracked)
```
