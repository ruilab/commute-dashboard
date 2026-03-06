# Changelog Experience

## User Flow
1. Developer publishes changelog entry via `POST /api/changelog` (CRON_SECRET auth)
2. On next login, user sees "What's New" modal with unseen entries
3. User clicks "Got it" / "Continue" → marks entries as seen
4. Full changelog browsable at `/changelog`
5. Linked from Settings

## Data Model

### `changelog_entries`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| version | text | Semver (e.g. "3.0.0") |
| title | text | Short title |
| body | text | Markdown description |
| category | text | "feature", "improvement", "fix", "data" |
| publishedAt | timestamp | When published |

### `user_changelog_seen`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| userId | text | FK to users |
| lastSeenAt | timestamp | When user last dismissed the modal |

## Publishing a Changelog Entry

```bash
curl -X POST https://your-app.vercel.app/api/changelog \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "3.0.0",
    "title": "Tri-state commute support",
    "content": "Added support for subway, PATH, NJ Transit, Metro-North, LIRR, and ferry commutes.",
    "category": "feature"
  }'
```

## UI Components
- `ChangelogBanner` — Modal overlay shown on unseen entries (in app layout)
- `/changelog` page — Full list of all entries
- Categories have icons: ✨ feature, 🔧 improvement, 🐛 fix, 📊 data
