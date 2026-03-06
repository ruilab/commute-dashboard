import { auth } from "@/lib/auth";
import { savePushSubscription, removePushSubscription } from "@/lib/services/push";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, retryAfterSec } = checkRateLimit(session.user.id, "push-subscribe");
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  const body = await req.json();

  if (body.action === "unsubscribe") {
    await removePushSubscription(session.user.id);
    return NextResponse.json({ ok: true });
  }

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  await savePushSubscription(session.user.id, {
    endpoint: body.endpoint,
    keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
  });

  return NextResponse.json({ ok: true });
}
