# V2.5 Follow-up Hardening Plan

## A) Close Known Unknowns

| # | Task | AC |
|---|------|----|
| A1 | GTFS-RT binary protobuf via protobufjs | Binary PB decode path; JSON fallback preserved |
| A2 | E2E auth bypass for CI | Tests run without manual login; CI passes |
| A3 | Route-filtered insights | Insights accept route filter; per-route stats |
| A4 | Cron production readiness | Dry-run mode; diagnostic response |
| A5 | Email deferred | Documented backlog; no code |

## B) Data Boundary Policy

| # | Task | AC |
|---|------|----|
| B1 | `docs/DATA_BOUNDARY.md` | Policy doc |
| B2 | `.gitignore` for private data | Updated ignore rules |
| B3 | `scripts/check-data-boundary.sh` | Fails on violations |
| B4 | CI step for boundary check | Runs in workflow |

## C) Environment Reproducibility

| # | Task | AC |
|---|------|----|
| C1 | `mise.toml` | Bun + node versions |
| C2 | `Brewfile` | System deps |
| C3 | README bootstrap | Complete setup docs |

## D) Skill Evolution

| # | Task | AC |
|---|------|----|
| D1 | Add `data-governance` skill | Anchored to boundary check |
| D2 | Update existing skills | Route-filter, dry-run |
| D3 | EVOLUTION_LOG entry | Documented |
| D4 | CLAUDE.md update | Data boundary policy |
