# E2E Tests

## Quick Start

```bash
# Run tests against local dev server
bun run test:e2e

# Run tests against production
E2E_BASE_URL=https://your-app.vercel.app bun run test:e2e
```

## Test Strategy

### Unauthenticated tests (default)
Tests verify:
- Public pages render correctly (sign-in, offline, auth error)
- Protected pages redirect to sign-in (auth wall works)
- API endpoints return 401 without authentication

These run without any auth setup and work in CI.

### Authenticated tests (production)
For full check-in flow testing against production:

1. Create a test GitHub account (e.g., `ruilab-test-bot`)
2. Add it to `ALLOWED_GITHUB_USERS` env var
3. Log in manually once to create a session
4. Export the session cookie as Playwright `storageState`
5. Run: `E2E_BASE_URL=https://your-app.vercel.app bun run test:e2e`

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `E2E_BASE_URL` | Target URL (default: http://localhost:3000) |
