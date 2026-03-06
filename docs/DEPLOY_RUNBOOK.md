# Deployment Runbook

## Platform: Vercel

## First-Time Setup

### 1. Push code to GitHub
```bash
git push origin main
```

### 2. Create Vercel project
```bash
vercel login
vercel link  # Link to ruilab/commute-dashboard
```
Or: Import at https://vercel.com/new from GitHub.

### 3. Add Vercel Postgres
- Vercel Dashboard → Project → Storage → Create Database → Postgres
- This auto-populates `POSTGRES_URL` and related vars

### 4. Create GitHub OAuth App
1. https://github.com/settings/developers → New OAuth App
2. Homepage URL: `https://your-app.vercel.app`
3. Callback URL: `https://your-app.vercel.app/api/auth/callback/github`
4. Copy Client ID and Client Secret

### 5. Set environment variables
```bash
# Required
vercel env add AUTH_SECRET           # Generate: openssl rand -base64 32
vercel env add AUTH_GITHUB_ID        # From step 4
vercel env add AUTH_GITHUB_SECRET    # From step 4
vercel env add ALLOWED_GITHUB_USERS  # Your GitHub username
vercel env add CRON_SECRET           # Generate: openssl rand -hex 16
vercel env add NEXT_PUBLIC_APP_URL   # https://your-app.vercel.app

# Optional
vercel env add GOOGLE_CALENDAR_CLIENT_ID
vercel env add GOOGLE_CALENDAR_CLIENT_SECRET
vercel env add VAPID_PUBLIC_KEY
vercel env add VAPID_PRIVATE_KEY
```

### 6. Push database schema
```bash
# Set POSTGRES_URL locally (copy from Vercel dashboard)
bunx drizzle-kit push
```

### 7. Deploy
```bash
vercel --prod
```
Or: Push to main — auto-deploys via GitHub integration.

## Routine Operations

### Deploy new version
```bash
git push origin main  # Auto-deploys
```

### Push schema changes
```bash
bunx drizzle-kit push  # After modifying src/lib/db/schema.ts
```

### Check cron health
```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://your-app.vercel.app/api/cron?dry=1"
```

### View logs
```bash
vercel logs your-app.vercel.app
```

## Rollback

```bash
vercel rollback  # Reverts to previous deployment
```

Or: In Vercel dashboard → Deployments → click previous → Promote to Production.

## Troubleshooting

| Issue | Check |
|-------|-------|
| 500 on all pages | `vercel logs` — likely missing env var |
| Auth redirect loop | Verify `AUTH_GITHUB_ID/SECRET` + callback URL matches |
| DB errors | Verify `POSTGRES_URL` is set; run `drizzle-kit push` |
| Cron not firing | Check Vercel dashboard → Cron Jobs tab; verify `CRON_SECRET` |
| Widget blank | Check if `POSTGRES_URL` is accessible from serverless functions |

## Cron Schedule

Defined in `vercel.json`:
```json
{ "path": "/api/cron", "schedule": "*/10 6-10,16-22 * * 1-5" }
```
Note: Vercel Hobby plan limits cron to once/day. For 10-min intervals, use Vercel Pro or an external cron service.

## Environment Contract

See `.env.example` for full list. Required in production:
- `POSTGRES_URL`, `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `ALLOWED_GITHUB_USERS`, `CRON_SECRET`
