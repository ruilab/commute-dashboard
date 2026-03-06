# Commute Dashboard

Personal commute optimizer for PATH train routes (JSQ ↔ WTC, JSQ ↔ 33rd, HOB ↔ WTC, HOB ↔ 33rd). A mobile-first PWA that helps determine the best time to leave for work and return home, combining real-time transit status, weather forecasts, calendar integration, and personal commute history.

## What it does

Answers two questions every weekday:
- **"When should I leave this morning?"**
- **"When should I leave WTC tonight?"**

The dashboard shows recommended departure windows with confidence levels and plain-English explanations, combining PATH service status, weather conditions, and historical trip durations.

## Features

- **Dashboard** — Departure recommendations, PATH status with live arrivals, weather + hourly forecast, calendar context
- **Check-in** — Tap-through commute tracking (start → station → train → arrive) with offline support
- **History** — Recent commutes with durations, events, and delay tags
- **Insights** — Streaks & records, weather-delay correlations, learned patterns, fastest departure bands, weekly trends
- **Settings** — Route selection, walking times, decision windows, push notification preferences, calendar integration
- **Widget** — Minimal single-card view (`/widget`) for phone home screen shortcuts
- **API** — JSON endpoint (`/api/widget`) for automation consumption
- **Offline** — Service worker caching, IndexedDB queue for check-ins, background sync
- **Push** — Web Push notifications for departure reminders and service alerts

## Architecture

```
Next.js 16 (App Router) + TypeScript + Tailwind CSS
├── Auth: Auth.js + GitHub OAuth (single-user allowlist)
├── Database: Vercel Postgres + Drizzle ORM
├── Transit: PATH realtime + alerts + schedule (multi-source)
├── Weather: Open-Meteo (free, no key needed)
├── Calendar: Google Calendar OAuth (optional)
├── Engine: Rules-based recommendation + correlation analysis + streaks
├── Offline: Service worker + IndexedDB + background sync
├── Push: Web Push via VAPID
└── Deploy: Vercel
```

### Recommendation Engine

Evaluates departure bands in 10-minute increments within configured windows. Scoring combines:

| Input | Weight | Source |
|-------|--------|--------|
| PATH advisory severity | Primary | PATH API / schedule fallback |
| Expected wait / headway | Primary | Schedule + realtime |
| Weather penalty | Secondary | Open-Meteo forecast |
| Historical median duration | Primary | User check-in history |
| Walking time assumptions | Baseline | User settings |
| Data staleness penalty | Modifier | Freshness check |

Output: best band + 2 fallbacks + confidence (high/medium/low) + explanation.

### Data Model

- `users` / `accounts` / `sessions` — Auth.js tables
- `user_settings` — Walking times, decision windows
- `commute_sessions` — Per-commute records with direction and duration
- `commute_events` — Timestamped steps within a commute
- `commute_tags` — Quick tags (delay, crowded, weather, etc.)
- `recommendation_snapshots` — Historical recommendations
- `transit_snapshots` / `weather_snapshots` — External data captures

## Local Setup

### Prerequisites

- Node.js 20+
- A Vercel Postgres database (or any PostgreSQL)
- A GitHub OAuth app

### 1. Clone and install

```bash
git clone https://github.com/ruilab/commute-dashboard.git
cd commute-dashboard
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in:
- `POSTGRES_URL` — Your Postgres connection string
- `AUTH_SECRET` — Generate with `npx auth secret`
- `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` — From [GitHub OAuth app settings](https://github.com/settings/developers)
- `ALLOWED_GITHUB_USERS` — Your GitHub username

### 3. Push database schema

```bash
npm run db:push
```

### 4. Run dev server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Auth.js encryption secret |
| `AUTH_GITHUB_ID` | Yes | GitHub OAuth app client ID |
| `AUTH_GITHUB_SECRET` | Yes | GitHub OAuth app client secret |
| `ALLOWED_GITHUB_USERS` | Yes | Comma-separated GitHub usernames |
| `NEXT_PUBLIC_APP_URL` | No | App URL (defaults to localhost) |
| `GOOGLE_CALENDAR_CLIENT_ID` | No | Google OAuth client ID for calendar |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | No | Google OAuth client secret |
| `VAPID_PUBLIC_KEY` | No | VAPID key for push notifications |
| `VAPID_PRIVATE_KEY` | No | VAPID private key |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No | Same as VAPID_PUBLIC_KEY (client-side) |

## Vercel Deployment

1. Import repo in [Vercel Dashboard](https://vercel.com/new)
2. Add a Vercel Postgres database in project settings
3. Set environment variables (AUTH_SECRET, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, ALLOWED_GITHUB_USERS)
4. Deploy

The database schema will be applied via `db:push` — run it once after first deploy or use the Vercel CLI.

### GitHub OAuth Setup

1. Go to [GitHub Settings → Developer → OAuth Apps](https://github.com/settings/developers)
2. Create new OAuth app:
   - **Homepage URL**: `https://your-app.vercel.app`
   - **Authorization callback URL**: `https://your-app.vercel.app/api/auth/callback/github`
3. Copy Client ID and Client Secret to env vars

## Data Sources

### PATH Transit

- **Primary**: PANYNJ PATH alerts API (ridepath.json)
- **Fallback**: Schedule-based headway estimates (4 min peak, 10 min off-peak)
- **Graceful degradation**: If API is unavailable, falls back to schedule with lower confidence

### Weather

- **Source**: [Open-Meteo](https://open-meteo.com/) (free, no API key)
- **Location**: Jersey City area (40.7178°N, 74.0431°W)
- **Factors**: Temperature, precipitation probability, wind, severe weather
- **Update frequency**: 10-minute cache

### Limitations

- PATH realtime data depends on PANYNJ API availability
- No GTFS-RT integration yet (would improve headway estimates)
- Weather affects walking comfort but doesn't predict transit delays
- Historical data requires check-in usage to build baseline

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run lint         # ESLint
npm run format       # Prettier
npm run db:generate  # Generate Drizzle migrations
npm run db:push      # Push schema to database
npm run db:studio    # Drizzle Studio (DB browser)
```

## Future Roadmap

- GTFS-RT protobuf parsing for true real-time headway data
- Cron-based proactive push notification triggers
- Email digest: daily morning summary via Resend/SendGrid
- NJ Transit bus/rail integration
- Apple Watch companion app
- E2E test suite
- Background data refresh via Vercel cron
- Multi-route: allow multiple active routes simultaneously
- ML-based recommendation model trained on personal history
