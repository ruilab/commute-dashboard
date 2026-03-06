# Security Hardening — What Changed

## Access Control
- **Before**: `ALLOWED_GITHUB_USERS` env var allowlist
- **After**: Optional `SIGNUP_CODE` env var gate before GitHub OAuth
- Any GitHub user can sign in if they have the signup code
- No code required if `SIGNUP_CODE` env var is not set

## Input Sanitization
- Feature request body builder (`src/lib/issue-format.ts`):
  - Strips HTML tags
  - Escapes Markdown heading injection (`#`)
  - Escapes Markdown link injection (`[]`)
  - Truncates to safe lengths (title: 200, body: 2000)
  - Unit tested (`tests/unit/issue-format.test.ts`)

## Timing-Safe Comparison
- Cron secret auth uses XOR-based timing-safe comparison
- Prevents timing side-channel attacks on bearer token

## Operational Checklist
1. Set `SIGNUP_CODE` in Vercel for production
2. Set `CRON_SECRET` in Vercel for production
3. Rotate `AUTH_SECRET` periodically
4. Review `GITHUB_TOKEN` PAT expiry
5. Run `betterleaks dir .` before pushing
6. Run `bash scripts/check-data-boundary.sh` before pushing
