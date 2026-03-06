# Security

## Threat Model

This is a **single-user, public-repo** app. Threat assumptions:

| Threat | Mitigation |
|--------|-----------|
| Unauthorized access | GitHub OAuth allowlist (`ALLOWED_GITHUB_USERS`) |
| Secret leaks in public repo | betterleaks CI scanning + data boundary script |
| CSRF on write endpoints | Origin checking in production (`src/lib/api-guard.ts`) |
| Brute-force on APIs | Token-bucket rate limiting (`src/lib/rate-limit.ts`) |
| Cron endpoint abuse | `CRON_SECRET` bearer auth required in production |
| Session hijacking | Auth.js secure cookies (HTTPS-only in production) |
| Missing env vars | Runtime validation fails fast (`src/lib/env.ts`) |

## Auth

- **Provider**: GitHub OAuth only (Auth.js v5)
- **Allowlist**: `ALLOWED_GITHUB_USERS` env var — comma-separated GitHub usernames
- **Session**: Database sessions via Drizzle adapter (not JWT)
- **Middleware**: All routes except `/auth/*`, `/offline`, and static assets require authentication

## API Endpoints

| Endpoint | Auth | Rate Limit | Origin Check |
|----------|------|-----------|-------------|
| `POST /api/checkin/sync` | Session | 30 req / bucket | Yes |
| `POST /api/push/subscribe` | Session | 5 req / bucket | Yes |
| `GET /api/widget` | Session | 20 req / bucket | No (GET) |
| `GET /api/cron` | CRON_SECRET | 3 req / bucket | No (server-to-server) |
| `POST /api/calendar/disconnect` | Session | No | No (simple delete) |
| `GET /api/calendar/connect` | Session | No | No (redirect) |

## Secrets Management

| Secret | Where | Rotation |
|--------|-------|---------|
| `AUTH_SECRET` | Vercel env vars | Rotate by changing value + redeploying |
| `AUTH_GITHUB_ID/SECRET` | Vercel env vars + GitHub OAuth app | Via GitHub developer settings |
| `CRON_SECRET` | Vercel env vars | Change value + update external cron if applicable |
| `POSTGRES_URL` | Vercel Postgres auto | Managed by Vercel |
| Calendar/VAPID keys | Vercel env vars | Rotate via provider |

## CI Security Checks

1. **betterleaks**: Scans repo for hardcoded secrets (API keys, tokens, private keys)
2. **data boundary check**: Ensures no `.env`, `.sqlite`, `.db`, or `data/private/` files tracked
3. **typecheck**: Catches type-level security issues (e.g. unsafe casts)

## Reporting

If you find a security issue, open a private advisory at:
https://github.com/ruilab/commute-dashboard/security/advisories/new
