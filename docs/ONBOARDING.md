# Onboarding Flow

## Route: `/onboarding`

First-time users are redirected here from the dashboard. Persists all settings in DB.

## Steps

1. **Mode & Schedule** — Subway vs Ferry (ferry disabled, marked "Coming soon") + weekday/daily
2. **Route Selection** — Multi-select PATH routes (JSQ-WTC, JSQ-33, HOB-WTC, HOB-33)
3. **Walking Times** — Stepper inputs for 4 walk legs (home→station, station→office, reverse)
4. **Time Windows & Notifications** — Morning/evening departure windows + push toggle
5. **Review & Confirm** — Summary card → "Start commuting" saves and redirects to dashboard

## DB Fields

| Field | Type | Default |
|-------|------|---------|
| `preferredMode` | text | "subway" |
| `commuteDays` | text | "weekdays" |
| `customDays` | jsonb (number[]) | null |
| `activeRoutes` | jsonb (string[]) | ["JSQ-WTC"] |
| `walkHomeToJsq` | integer | 8 |
| `walkWtcToOffice` | integer | 10 |
| `walkOfficeToWtc` | integer | 10 |
| `walkJsqToHome` | integer | 8 |
| `morningWindowStart` | text | "08:30" |
| `morningWindowEnd` | text | "10:00" |
| `eveningWindowStart` | text | "19:00" |
| `eveningWindowEnd` | text | "21:00" |
| `pushEnabled` | boolean | false |
| `onboardingCompletedAt` | timestamp | null (set on completion) |

## Redirect Logic

- Dashboard (`/`): if `onboardingCompletedAt` is null → redirect to `/onboarding`
- Onboarding (`/onboarding`): if `onboardingCompletedAt` is set → redirect to `/`
- Re-run: `/onboarding?reset=1` skips the completion check
- Settings: "Run Onboarding Again" link points to `/onboarding?reset=1`

## Mobile UX

- Stepper buttons are ≥48px tap targets
- Progress bar shows current step
- Back/Continue navigation at bottom
- All inputs are phone-optimized (time pickers, number steppers)
