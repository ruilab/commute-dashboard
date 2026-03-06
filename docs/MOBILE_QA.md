# Mobile QA Checklist

## Automated (Playwright, iPhone 14 viewport)

| Check | Status |
|-------|--------|
| Sign-in page: no horizontal overflow | Verified via `mobile.spec.ts` |
| Sign-in button: ≥44px tap target | Verified via `mobile.spec.ts` |
| Offline page: fits viewport | Verified via `mobile.spec.ts` |
| Auth error page: tap target size | Verified via `mobile.spec.ts` |
| Redirect preserves mobile layout | Verified via `mobile.spec.ts` |

## Manual Checklist (post-deploy)

| Page | Check | Status |
|------|-------|--------|
| Dashboard | Cards stack vertically, no overflow | Pending |
| Dashboard | Weather + transit cards readable | Pending |
| Dashboard | Recommendation text legible | Pending |
| Check-in | Large tap targets for steps | Pending |
| Check-in | Quick tag buttons tappable | Pending |
| History | Session cards scrollable | Pending |
| Insights | Charts render at mobile width | Pending |
| Insights | Streak counters visible | Pending |
| Settings | Route multi-select tappable | Pending |
| Settings | Number inputs usable | Pending |
| Settings | Time pickers functional | Pending |
| Widget | Full-screen single-card readable | Pending |
| Bottom nav | All 5 tabs tappable, no overlap | Pending |
| PWA | Install prompt appears | Pending |
| PWA | Offline banner shows when disconnected | Pending |

## Design Constraints

- Max content width: `max-w-lg` (32rem / 512px)
- Minimum tap target: 48×48px (`.tap-target` class)
- Bottom nav: fixed, safe-area-bottom padded
- Page content: `pb-20` to clear bottom nav
- Font: system font stack (-apple-system)
- Theme: auto dark/light via `prefers-color-scheme`

## Test Command

```bash
bun run test:e2e  # Includes mobile viewport tests
```
