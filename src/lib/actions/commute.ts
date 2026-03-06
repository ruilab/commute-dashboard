"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  commuteSessions,
  commuteEvents,
  commuteTags,
  type Direction,
  type EventStep,
} from "@/lib/db/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";

export async function startSession(direction: Direction, route = "JSQ-WTC") {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const [created] = await db
    .insert(commuteSessions)
    .values({
      userId: session.user.id,
      direction,
      route,
    })
    .returning();

  // Also create the first event
  await db.insert(commuteEvents).values({
    sessionId: created.id,
    step: "start_commute",
  });

  return created;
}

export async function addEvent(sessionId: string, step: EventStep) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const [event] = await db
    .insert(commuteEvents)
    .values({ sessionId, step })
    .returning();

  // If this is the final step, complete the session
  if (step === "arrived_destination") {
    const [commuteSession] = await db
      .select()
      .from(commuteSessions)
      .where(eq(commuteSessions.id, sessionId))
      .limit(1);

    if (commuteSession) {
      const durationMs =
        new Date().getTime() - commuteSession.startedAt.getTime();
      const durationMin = durationMs / 1000 / 60;

      await db
        .update(commuteSessions)
        .set({
          completedAt: new Date(),
          totalDurationMin: Math.round(durationMin * 10) / 10,
        })
        .where(eq(commuteSessions.id, sessionId));
    }
  }

  return event;
}

export async function addTag(
  sessionId: string,
  tag: string,
  note?: string
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  return db.insert(commuteTags).values({ sessionId, tag, note }).returning();
}

export async function cancelSession(sessionId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  // Verify the session belongs to this user and is incomplete
  const [target] = await db
    .select({ id: commuteSessions.id })
    .from(commuteSessions)
    .where(
      and(
        eq(commuteSessions.id, sessionId),
        eq(commuteSessions.userId, session.user.id),
        sql`${commuteSessions.completedAt} IS NULL`
      )
    )
    .limit(1);

  if (!target) throw new Error("Session not found or already completed");

  // Delete session — events and tags cascade-delete via FK
  await db
    .delete(commuteSessions)
    .where(eq(commuteSessions.id, sessionId));
}

export async function getActiveSession() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [active] = await db
    .select()
    .from(commuteSessions)
    .where(
      and(
        eq(commuteSessions.userId, session.user.id),
        sql`${commuteSessions.completedAt} IS NULL`
      )
    )
    .orderBy(desc(commuteSessions.startedAt))
    .limit(1);

  if (!active) return null;

  const events = await db
    .select()
    .from(commuteEvents)
    .where(eq(commuteEvents.sessionId, active.id))
    .orderBy(commuteEvents.timestamp);

  const tags = await db
    .select()
    .from(commuteTags)
    .where(eq(commuteTags.sessionId, active.id));

  return { session: active, events, tags };
}

export async function getRecentSessions(limit = 20) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const sessions = await db
    .select()
    .from(commuteSessions)
    .where(eq(commuteSessions.userId, session.user.id))
    .orderBy(desc(commuteSessions.startedAt))
    .limit(limit);

  // Fetch events and tags for each session
  const result = await Promise.all(
    sessions.map(async (s) => {
      const events = await db
        .select()
        .from(commuteEvents)
        .where(eq(commuteEvents.sessionId, s.id))
        .orderBy(commuteEvents.timestamp);

      const tags = await db
        .select()
        .from(commuteTags)
        .where(eq(commuteTags.sessionId, s.id));

      return { session: s, events, tags };
    })
  );

  return result;
}

export async function getHistoricalStats(direction: Direction) {
  const session = await auth();
  if (!session?.user?.id)
    return { medianByBand: {}, sampleCount: 0 };

  // Get completed sessions from the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sessions = await db
    .select()
    .from(commuteSessions)
    .where(
      and(
        eq(commuteSessions.userId, session.user.id),
        eq(commuteSessions.direction, direction),
        gte(commuteSessions.startedAt, thirtyDaysAgo),
        sql`${commuteSessions.completedAt} IS NOT NULL`,
        sql`${commuteSessions.totalDurationMin} IS NOT NULL`
      )
    );

  // Group by departure time band (10-min increments)
  const bandDurations: Record<string, number[]> = {};
  for (const s of sessions) {
    const hour = s.startedAt.getHours();
    const minute = Math.floor(s.startedAt.getMinutes() / 10) * 10;
    const key = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
    if (!bandDurations[key]) bandDurations[key] = [];
    if (s.totalDurationMin) bandDurations[key].push(s.totalDurationMin);
  }

  // Calculate medians
  const medianByBand: Record<string, number> = {};
  for (const [key, durations] of Object.entries(bandDurations)) {
    durations.sort((a, b) => a - b);
    const mid = Math.floor(durations.length / 2);
    medianByBand[key] =
      durations.length % 2 === 0
        ? (durations[mid - 1] + durations[mid]) / 2
        : durations[mid];
  }

  return { medianByBand, sampleCount: sessions.length };
}
