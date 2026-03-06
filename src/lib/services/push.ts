/**
 * Push notification service.
 *
 * Server-side push notification sending via Web Push protocol.
 * Uses VAPID for authentication.
 *
 * Env vars needed:
 * - VAPID_PUBLIC_KEY
 * - VAPID_PRIVATE_KEY
 * - VAPID_SUBJECT (mailto: URL)
 */

import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  actions?: { action: string; title: string }[];
}

/**
 * Save a push subscription for a user.
 */
export async function savePushSubscription(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
) {
  // Remove existing subscriptions for this user
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  await db.insert(pushSubscriptions).values({
    userId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  });
}

/**
 * Remove push subscription for a user.
 */
export async function removePushSubscription(userId: string) {
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
}

/**
 * Send a push notification to a user.
 * Uses the Web Push protocol with VAPID.
 */
export async function sendPushNotification(
  userId: string,
  payload: PushPayload
): Promise<boolean> {
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subs.length === 0) return false;

  // Dynamic import of web-push to keep it server-only
  let webpush;
  try {
    webpush = await import("web-push");
  } catch {
    console.error("web-push not installed. Run: npm install web-push");
    return false;
  }

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error("VAPID keys not configured");
    return false;
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  let sent = false;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      );
      sent = true;
    } catch (err: unknown) {
      // If subscription is expired/invalid, remove it
      if (
        err &&
        typeof err === "object" &&
        "statusCode" in err &&
        ((err as { statusCode: number }).statusCode === 410 ||
          (err as { statusCode: number }).statusCode === 404)
      ) {
        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.id, sub.id));
      }
    }
  }

  return sent;
}
