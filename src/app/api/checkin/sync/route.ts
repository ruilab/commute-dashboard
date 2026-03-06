import { auth } from "@/lib/auth";
import {
  startSession,
  addEvent,
  addTag,
} from "@/lib/actions/commute";
import { NextResponse } from "next/server";
import type { EventStep, Direction } from "@/lib/db/schema";

/**
 * Sync endpoint for offline check-in events.
 * Accepts queued events from the service worker.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  try {
    switch (body.type) {
      case "start_session": {
        const result = await startSession(body.payload.direction as Direction);
        return NextResponse.json({ ok: true, sessionId: result.id });
      }

      case "add_event": {
        await addEvent(
          body.payload.sessionId as string,
          body.payload.step as EventStep
        );
        return NextResponse.json({ ok: true });
      }

      case "add_tag": {
        await addTag(
          body.payload.sessionId as string,
          body.payload.tag as string,
          body.payload.note as string | undefined
        );
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json(
          { error: "Unknown event type" },
          { status: 400 }
        );
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
