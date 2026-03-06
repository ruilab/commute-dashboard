# Security Audit — 2026-03-06

## Findings

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | CRITICAL | `ALLOWED_GITHUB_USERS` env allowlist was sole access control | FIXED — removed, replaced with signup code gate |
| 2 | HIGH | Feature request body injected raw user input into GitHub issue | FIXED — sanitizer strips HTML, escapes MD headings/links |
| 3 | HIGH | Origin check allowed requests with no origin/referer header | ACCEPTED — needed for cron/server-to-server calls |
| 4 | MEDIUM | Cron secret comparison not timing-safe | FIXED — timing-safe string comparison |
| 5 | MEDIUM | `ALLOWED_GITHUB_USERS` in env.ts validation | FIXED — removed from env contract |
| 6 | LOW | No security response headers (CSP, X-Frame-Options) | BACKLOG — Next.js handles some; custom headers deferred |
| 7 | LOW | Rate limiter resets on serverless cold start | ACCEPTED — acceptable for single-user scale |

## Detail

### #1: Access Control (CRITICAL → FIXED)
**Before**: `ALLOWED_GITHUB_USERS=chenrui333` was the only gate. If env var was empty, anyone could sign in.
**After**: Optional `SIGNUP_CODE` env var. If set, users must enter the code before GitHub OAuth proceeds. Code is validated server-side.

### #2: Issue Body Injection (HIGH → FIXED)
**Before**: Raw `description` and `category` interpolated into Markdown issue body. An attacker could inject fake headings, links, or HTML.
**After**: `src/lib/issue-format.ts` sanitizes all user input: strips HTML tags, escapes `#` headings, escapes `[]` link syntax, truncates to length limits.

### #4: Timing-Safe Comparison (MEDIUM → FIXED)
**Before**: `authHeader !== Bearer ${cronSecret}` — simple string comparison vulnerable to timing attacks.
**After**: Character-by-character XOR comparison in `timingSafeEqual()` function.
