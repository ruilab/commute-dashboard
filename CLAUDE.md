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
bun run test:e2e         # E2E tests (playwright)
bun run db:push          # Push schema to database
bun run db:generate      # Generate migrations
```

## Architecture
- `src/lib/db/schema.ts` — Single source of truth for all tables
- `src/lib/services/` — External data providers (transit, weather, calendar, push)
- `src/lib/engine/` — Recommendation, correlation, streaks engines
- `src/lib/actions/` — Server actions (commute, dashboard, insights, settings)
- `src/app/api/` — API routes (auth, calendar, checkin sync, push, widget, cron)
- `src/components/` — React components grouped by feature
- `src/app/(app)/` — Auth-protected pages with bottom nav

## Conventions
- Auth-gate all server actions with `await auth()`
- Use Drizzle `sql` template for complex WHERE clauses
- All timestamps in UTC via Drizzle `{ mode: "date" }`
- Time strings as "HH:MM" in settings
- Direction: "outbound" | "return"
- Route IDs: "JSQ-WTC", "JSQ-33", "HOB-WTC", "HOB-33"
- API responses: `NextResponse.json()`
- Fire-and-forget DB writes: `.catch(() => {})`

## Security
- **Public repo**: all code/config/docs are publicly visible
- **Secret scanning**: betterleaks in CI; run `betterleaks dir .` locally
- **Data boundary**: `bash scripts/check-data-boundary.sh` before committing
- **Write endpoints**: rate-limited + origin-checked in production
- **Cron**: `CRON_SECRET` required in production; returns 503 if missing
- **Auth**: GitHub OAuth only; `ALLOWED_GITHUB_USERS` gates access
- See `docs/SECURITY.md` for full threat model
- See `docs/DATA_BOUNDARY.md` for data policy

## Deployment
- **Platform**: Vercel (Next.js native, Vercel Postgres, built-in cron)
- **Deploy**: `git push origin main` (auto-deploys via GitHub integration)
- **Schema**: `bunx drizzle-kit push` after schema changes
- **Runbook**: `docs/DEPLOY_RUNBOOK.md`

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

## Skills
- Project-specific skills live in `skills/`
- Every major code change should update relevant skills
- See `skills/SKILL_GOVERNANCE.md` for evolution rules
