# Feature Requests

## Flow

User submits via `/feature-request` page → API creates GitHub issue directly → returns issue link.

No DB table — issues live on GitHub only.

## API

```
POST /api/feature-request
Authorization: session cookie
Body: { "title": "...", "description": "...", "category": "general" }
Response: { "ok": true, "issueNumber": 1, "issueUrl": "https://github.com/..." }
```

## UI

Phone-first form at `/feature-request` (linked from Settings):
- Category selector (chips)
- Title input (3–200 chars)
- Description textarea (10–2000 chars)
- Success: shows GitHub issue link
- Error: clear error message

## Env Vars

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Yes | PAT with `issues:write` on the target repo |
| `GITHUB_OWNER` | No | Default: "ruilab" |
| `GITHUB_REPO` | No | Default: "commute-dashboard" |

Note: `AUTO_FILE_GH_ISSUES` is no longer needed. If `GITHUB_TOKEN` is set, issues are filed. If not, API returns 503.

## Abuse Controls

- Auth required (session cookie)
- Rate limited: 5 per bucket, 1 refill per 50s
- Origin checking in production
- Client + server validation (min/max lengths)
- GitHub label: `feature-request`
