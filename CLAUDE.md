# Commute Dashboard — Project Instructions

## Git Workflow
- **Commit directly to main**. No feature branches or PRs.
- Small logical commits with clear messages.
- Do not push unless explicitly asked.

## Runtime
- **Bun-first**: Use `bun install`, `bun run`, `bunx` everywhere. Never npm/npx.
- **Next.js 16** with App Router, TypeScript strict mode
- **Tailwind CSS v4** via `@tailwindcss/postcss`
- **Drizzle ORM** with Vercel Postgres

## Commands
```bash
bun install              # Install dependencies
bun run dev              # Dev server
bun run build            # Production build (next build)
bun run lint             # ESLint (direct eslint src/)
bun run typecheck        # TypeScript check (tsc --noEmit)
bun test tests/unit/     # Unit tests (bun:test)
bun run test:e2e         # E2E tests (playwright)
bun run db:push          # Push schema to database
bun run db:generate      # Generate migrations
```

## Architecture
- `src/lib/db/schema.ts` — Single source of truth for all tables (20+ tables)
- `src/lib/services/` — External data providers (transit, weather, calendar, push, ferry)
- `src/lib/engine/` — Recommendation, correlation, streaks engines
- `src/lib/actions/` — Server actions (commute, dashboard, insights, settings, changelog)
- `src/app/api/` — API routes (auth, calendar, checkin, push, widget, cron, changelog, feature-request)
- `src/components/` — React components grouped by feature
- `src/app/(app)/` — Auth-protected pages with bottom nav + changelog modal
- `data/public/` — Static reference data (GTFS schedules, station lists)
- `docs/` — Product, data collection, security, deployment, changelog docs

## Conventions
- Auth-gate all server actions with `await auth()`
- Use Drizzle `sql` template for complex WHERE clauses
- All timestamps in UTC via Drizzle `{ mode: "date" }`
- Time strings as "HH:MM" in settings
- Direction: "outbound" | "return"
- Commute mode: "subway" | "path" | "bus" | "commuter_rail" | "ferry"
- Commute days: "weekdays" | "all" | "custom" (per-user in DB)
- Transit agencies: PATH, MTA, NJT, MNRR, LIRR, NYCFERRY
- Route IDs: normalized as "AGENCY:ROUTE" (e.g. "PATH:JSQ-WTC", "MTA:4")
- API responses: `NextResponse.json()`
- Fire-and-forget DB writes: `.catch(() => {})`
- External fetches: use `resilientFetch()` from `src/lib/resilient-fetch.ts`
- Logging: use `log.info/warn/error()` from `src/lib/logger.ts`
- Dashboard recommendations: wrap `generateRecommendation()` with a fallback so cards degrade gracefully instead of failing the whole dashboard

## Onboarding
- First login → `/onboarding` (5-step wizard)
- Re-run: `/onboarding?reset=1` (linked from Settings)
- Sets `onboardingCompletedAt` timestamp in user_settings
- Dashboard checks this and redirects if null
- See `docs/ONBOARDING.md`

## User-Specific Rules
- `chenrui333`: subway only, weekdays only (set via onboarding defaults)
- Cron respects per-user `commuteDays` — no weekend prompts for weekday users
- Ferry mode exists in schema but is disabled in onboarding UI ("Coming soon")

## Security
- **Public repo**: all code/config/docs are publicly visible
- **Never commit secrets/tokens**: no PATs, API keys, private keys, or real `.env` values in git history
- **Secret scanning**: betterleaks in CI; run `betterleaks dir .` locally
- **Data boundary**: `bash scripts/check-data-boundary.sh` before committing
- **Private/user-specific data** must live in the database only; only public/reference datasets belong in repo files
- **Write endpoints**: rate-limited + origin-checked in production
- **Cron**: `CRON_SECRET` required in production; returns 503 if missing
- **Auth**: GitHub OAuth with optional `SIGNUP_CODE` gate (code required before OAuth if env var set)
- See `docs/SECURITY.md` for full threat model
- See `docs/DATA_BOUNDARY.md` for data policy

## Deployment
- **Platform**: Vercel (Next.js native, Vercel Postgres, built-in cron)
- **Deploy**: `git push origin main` (auto-deploys via GitHub integration)
- **Schema**: `bunx drizzle-kit push` after schema changes
- **Runbook**: `docs/DEPLOY_RUNBOOK.md`

## Product (V3)
- **Tri-state commute**: NY/NJ/CT metro area office workers
- **Multi-modal**: PATH, subway, bus, NJ Transit, Metro-North, LIRR, ferry
- **Per-user profiles**: home area, office, preferred modes, risk tolerance, reliability pref
- **Data-first**: collect schedule/status data before building UX on it
- **Changelog**: modal shows unseen changes on login; `/changelog` page for history
- **Mobile-first**: every page/flow designed and tested for phone viewport

## Self-Judgement Protocol (for Claude sessions)
Before each commit or "complete" claim, emit:
- **Judgement**: what you believe is true
- **Evidence**: file path + command output proving it
- **Confidence**: 0–100
- **Risk if wrong**: impact statement
- **Decision**: go / hold / rollback / re-scope

Hard rules:
- Confidence < 80 on critical claims → gather more evidence first
- Confidence < 60 with high risk → stop and re-scope
- Every "complete" must cite `bun run build` or `bun run lint` output
- Truth over plan: if evidence contradicts docs, update docs immediately
- Update docs and `CLAUDE.md` in the same change when behavior, policy, or workflow expectations change

## Skills
- Project-specific skills live in `skills/`
- Every major code change should update relevant skills
- See `skills/SKILL_GOVERNANCE.md` for evolution rules
