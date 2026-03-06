# Memories

## Patterns

### mem-1772829996-2ae8
> Onboarding completion now persists V3 commuter profile fields in commuter_profiles (homeArea, officeArea, preferredModes, riskTolerance, reliabilityPref) alongside user_settings. Preferred modes are normalized with fallback path/ferry via src/lib/profile.ts.
<!-- tags: onboarding, v3, profile | created: 2026-03-06 -->

### mem-1772829547-f660
> Dashboard recommendation resilience: wrap generateRecommendation() in safeGenerateRecommendation() inside src/lib/actions/dashboard.ts. On engine exceptions, log dashboard.recommendation_fallback_used and return buildRecommendationFallback() with low confidence plus visible UI banner in RecommendationCard.
<!-- tags: recommendation, dashboard, error-handling | created: 2026-03-06 -->

### mem-1772828972-a6cf
> Trip cancellation: cancelSession() in commute.ts deletes session with FK cascade (events+tags auto-deleted). CheckinFlow has 2-step cancel (Cancel → Confirm/Keep) to prevent accidental taps. Only works on incomplete sessions (completedAt IS NULL).
<!-- tags: trip-tracking, checkin, server-actions | created: 2026-03-06 -->

### mem-1772828452-6e44
> resilientFetch migration complete: all 6 external API calls in transit.ts (3), calendar.ts (2), weather.ts (1) now use resilientFetch with labels. Zero bare fetch() calls remain in src/lib/services/. Pattern: replace fetch() → resilientFetch(), remove manual AbortSignal.timeout, add label param.
<!-- tags: resilient-fetch, services, production-quality | created: 2026-03-06 -->

### mem-1772828250-75dd
> Next.js error boundaries: src/app/(app)/error.tsx covers all auth-protected routes, src/app/global-error.tsx is root fallback (must render own html/body). Client-side ErrorBoundary class component exists at src/components/ui/error-boundary.tsx for inline use.
<!-- tags: error-handling, nextjs | created: 2026-03-06 -->

### mem-1772828244-9c8b
> console.error exceptions: env.ts (startup), error-boundary.tsx (client devtools), logger.ts (internal). All others should use log.error() from src/lib/logger.ts
<!-- tags: logging, production-quality | created: 2026-03-06 -->

## Decisions

## Fixes

## Context
