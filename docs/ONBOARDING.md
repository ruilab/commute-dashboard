# Onboarding Flow

## Route: `/onboarding`

First-time users are redirected here from the dashboard. Persists all settings in DB.

## Steps

1. **Profile & Schedule** — Home area + office location + primary mode + weekday/daily + preferred transit modes
2. **Route Selection** — Multi-select PATH routes (JSQ-WTC, JSQ-33, HOB-WTC, HOB-33)
3. **Walking Times** — Stepper inputs for 4 walk legs (home→station, station→office, reverse)
4. **Time Windows & Preferences** — Morning/evening departure windows + risk tolerance + reliability preference + push toggle
5. **Review & Confirm** — Summary card → "Start commuting" saves and redirects to dashboard

## DB Fields (`user_settings`)

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

## DB Fields (`commuter_profiles`)

| Field | Type | Default |
|-------|------|---------|
| `homeArea` | text | null |
| `officeArea` | text | null |
| `preferredModes` | jsonb (string[]) | ["path"] |
| `riskTolerance` | text | "moderate" |
| `reliabilityPref` | text | "fastest" |

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
