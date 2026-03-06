# Deployment Platform Decision

## Choice: Vercel

## Evaluation

| Criterion | Vercel | Fly.io |
|-----------|--------|--------|
| Next.js 16 support | Native (built by same company) | Requires Dockerfile + adapter |
| Bun compatibility | Supported via framework detection | Manual Dockerfile |
| Cron jobs | Built-in via `vercel.json` | Requires separate process/scheduler |
| Postgres | Vercel Postgres (one-click) | Fly Postgres (self-managed) |
| Auth.js callbacks | Zero-config with Vercel URLs | Manual domain/TLS setup |
| Cold start | Edge-optimized, fast | Container spin-up, variable |
| Mobile delivery | Global CDN, fast TTFB | Regional, fewer PoPs |
| Operational complexity | Zero — git push deploys | Moderate — Docker, fly.toml, scaling |
| Cost (hobby) | Free tier sufficient | Free tier, but more moving parts |
| GitHub integration | Native (auto-deploy on push) | CLI-based deploys |

## Decision Rationale

1. **Next.js native**: Vercel is the Next.js platform. Zero adapter/config friction.
2. **Cron built-in**: `vercel.json` crons work immediately. No sidecar needed.
3. **Vercel Postgres**: One-click DB provisioning, auto env vars, connection pooling.
4. **Single-user app**: Free hobby tier is more than sufficient.
5. **Mobile perf**: Global edge network gives better TTFB for a phone-first PWA.
6. **Simplicity**: `git push` → deployed. No Docker, no infra management.

## Trade-offs Accepted

- Vercel Cron: Hobby plan crons run every 24h minimum on free tier; Pro plan needed for 10-min intervals. Fallback: external cron service (cron-job.org) hitting the endpoint.
- Vendor lock-in: Vercel Postgres is standard PostgreSQL; can migrate if needed.
- No long-running processes: Fine for this app (all serverless/edge).
