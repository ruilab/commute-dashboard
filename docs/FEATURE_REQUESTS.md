# Feature Requests

## API

### Submit a request
```
POST /api/feature-request
Authorization: session cookie
Body: { "title": "...", "description": "...", "category": "general" }
```

### List my requests
```
GET /api/feature-request
Authorization: session cookie
```

## GitHub Issue Auto-Filing

When enabled, each feature request is automatically filed as a GitHub issue.

### Env vars
| Variable | Required | Description |
|----------|----------|-------------|
| `AUTO_FILE_GH_ISSUES` | No | Set to "true" to enable |
| `GITHUB_TOKEN` | If auto-filing | Fine-grained PAT with `issues:write` |
| `GITHUB_OWNER` | If auto-filing | Repository owner (e.g. "ruilab") |
| `GITHUB_REPO` | If auto-filing | Repository name (e.g. "commute-dashboard") |

### Behavior
- If enabled + all vars set: creates issue on submission, stores issue number
- If disabled or missing vars: request saved to DB only, `githubSyncStatus = "pending"`
- If GitHub API fails: request saved, `githubSyncStatus = "failed"` with error message
- Idempotent: duplicate submissions (same fingerprint) return existing request

### Abuse Controls
- Auth required (session cookie)
- Rate limited: 5 requests per bucket, slow refill (1 per 50s)
- Origin checking in production
- Fingerprint deduplication (hash of title + description)
- Title min 3 chars, description min 10 chars

## Schema: `feature_requests`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| userId | text | FK to users |
| title | text | Request title |
| description | text | Request body |
| category | text | "general" / custom |
| githubIssueNumber | integer | Linked issue # (null if not synced) |
| githubSyncStatus | text | "pending" / "synced" / "failed" |
| githubSyncError | text | Error message if failed |
| fingerprint | text | Dedupe hash |
| createdAt | timestamp | When submitted |
