"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { commuteSessions, commuteTags } from "@/lib/db/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";

export async function getInsightsData() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get all completed sessions from last 30 days
  const allSessions = await db
    .select()
    .from(commuteSessions)
    .where(
      and(
        eq(commuteSessions.userId, session.user.id),
        gte(commuteSessions.startedAt, thirtyDaysAgo),
        sql`${commuteSessions.completedAt} IS NOT NULL`,
        sql`${commuteSessions.totalDurationMin} IS NOT NULL`
      )
    )
    .orderBy(desc(commuteSessions.startedAt));

  // Get all tags
  const allTags = await db
    .select()
    .from(commuteTags)
    .where(
      sql`${commuteTags.sessionId} IN (${
        allSessions.length > 0
          ? sql.join(
              allSessions.map((s) => sql`${s.id}`),
              sql`, `
            )
          : sql`NULL`
      })`
    );

  // Compute stats
  const outbound = allSessions.filter((s) => s.direction === "outbound");
  const returnTrips = allSessions.filter((s) => s.direction === "return");
  const recentSessions = allSessions.filter(
    (s) => s.startedAt >= sevenDaysAgo
  );

  const computeStats = (sessions: typeof allSessions) => {
    const durations = sessions
      .map((s) => s.totalDurationMin!)
      .filter((d) => d > 0)
      .sort((a, b) => a - b);

    if (durations.length === 0) return null;

    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const median =
      durations.length % 2 === 0
        ? (durations[durations.length / 2 - 1] +
            durations[durations.length / 2]) /
          2
        : durations[Math.floor(durations.length / 2)];
    const min = durations[0];
    const max = durations[durations.length - 1];

    return {
      count: durations.length,
      avg: Math.round(avg * 10) / 10,
      median: Math.round(median * 10) / 10,
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
    };
  };

  // Best departure bands by duration
  const bandStats = (sessions: typeof allSessions) => {
    const bands: Record<string, number[]> = {};
    for (const s of sessions) {
      if (!s.totalDurationMin) continue;
      const hour = new Date(s.startedAt).getHours();
      const minute =
        Math.floor(new Date(s.startedAt).getMinutes() / 10) * 10;
      const label = `${hour > 12 ? hour - 12 : hour}:${minute.toString().padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
      if (!bands[label]) bands[label] = [];
      bands[label].push(s.totalDurationMin);
    }

    return Object.entries(bands)
      .map(([band, durations]) => ({
        band,
        avgDuration:
          Math.round(
            (durations.reduce((a, b) => a + b, 0) / durations.length) * 10
          ) / 10,
        count: durations.length,
      }))
      .sort((a, b) => a.avgDuration - b.avgDuration);
  };

  // Tag frequency
  const tagCounts: Record<string, number> = {};
  for (const t of allTags) {
    tagCounts[t.tag] = (tagCounts[t.tag] || 0) + 1;
  }

  // Trend data: daily averages for the week
  const dailyAvg: { date: string; outbound: number | null; returnTrip: number | null }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString("en-US", {
      weekday: "short",
      timeZone: "America/New_York",
    });

    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(23, 59, 59, 999);

    const daySessions = recentSessions.filter((s) => {
      const st = new Date(s.startedAt);
      return st >= dayStart && st <= dayEnd;
    });

    const dayOutbound = daySessions.filter((s) => s.direction === "outbound");
    const dayReturn = daySessions.filter((s) => s.direction === "return");

    dailyAvg.push({
      date: dateStr,
      outbound:
        dayOutbound.length > 0
          ? Math.round(
              (dayOutbound.reduce((a, s) => a + (s.totalDurationMin || 0), 0) /
                dayOutbound.length) *
                10
            ) / 10
          : null,
      returnTrip:
        dayReturn.length > 0
          ? Math.round(
              (dayReturn.reduce((a, s) => a + (s.totalDurationMin || 0), 0) /
                dayReturn.length) *
                10
            ) / 10
          : null,
    });
  }

  return {
    overall: computeStats(allSessions),
    outbound: computeStats(outbound),
    returnTrips: computeStats(returnTrips),
    totalTrips: allSessions.length,
    outboundBands: bandStats(outbound).slice(0, 5),
    returnBands: bandStats(returnTrips).slice(0, 5),
    tagCounts,
    dailyAvg,
  };
}
