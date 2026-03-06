# Skill: notification-system

## Purpose
Manage push notifications: subscription lifecycle, proactive triggers via cron, notification history, preference enforcement, and deduplication.

## Triggers
- "Push notifications not working / not received"
- "Too many / duplicate notifications"
- "Add a new notification type"
- "Change notification timing"
- Changes to `src/lib/services/push.ts` or `src/app/api/cron/route.ts`

## Project Anchors
See `skills/PROJECT_ANCHORS.md` → `notification-system`

## Workflow
1. **Check subscription**: Verify `push_subscriptions` table has entry for user
2. **Check preferences**: Verify `user_settings.pushEnabled` = true + specific toggle
3. **Check cron**: Verify `/api/cron` endpoint is running (Vercel cron or external)
4. **Check dedup**: Look at `notification_log` for recent tags to see if dedupe blocked delivery
5. **Modify**:
   - New notification type: Add trigger logic in `cron/route.ts`, add type to notification_log
   - Timing change: Adjust cron schedule in `vercel.json` or trigger logic in cron handler
   - Subscription issue: Debug `push.ts:sendPushNotification()` error handling

## Invariants
- Notifications respect user preferences (pushEnabled + per-type toggles)
- Dedup via `notification_log.tag` — same tag today = skip
- CRON_SECRET env var secures the cron endpoint in production
- Rate limit: 3 req, 0.05 tokens/sec (prevents abuse)
- Leave reminders: weekdays only, 15 min before morning window start
- Service alerts: only on delays/suspended status, deduped per hour
- Weather alerts: only on severe, deduped per day
- All notifications logged to `notification_log` regardless of delivery success

## Cron Schedule
`vercel.json`: `*/10 6-10,16-22 * * 1-5` (every 10min, 6AM-10PM weekdays)

## Validation
```bash
bun run typecheck
bun run build
# Test cron: curl http://localhost:3000/api/cron
```
