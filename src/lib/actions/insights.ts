"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { commuteSessions, commuteTags, userSettings } from "@/lib/db/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { analyzeCorrelations } from "@/lib/engine/correlation";
import { getStreakData } from "@/lib/engine/streaks";

export async function getInsightsData(routeFilter?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  // If no route filter specified, use user's active routes
  let routes: string[] | null = null;
  if (routeFilter) {
    routes = [routeFilter];
  } else {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, session.user.id))
      .limit(1);
    if (settings?.activeRoutes && settings.activeRoutes.length > 0) {
      routes = settings.activeRoutes;
    }
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Build query with optional route filter
  const conditions = [
    eq(commuteSessions.userId, session.user.id),
    gte(commuteSessions.startedAt, thirtyDaysAgo),
    sql`${commuteSessions.completedAt} IS NOT NULL`,
    sql`${commuteSessions.totalDurationMin} IS NOT NULL`,
  ];

  if (routes && routes.length > 0) {
    conditions.push(
      sql`${commuteSessions.route} IN (${sql.join(
        routes.map((r) => sql`${r}`),
        sql`, `
      )})`
    );
  }

  const allSessions = await db
    .select()
    .from(commuteSessions)
    .where(and(...conditions))
    .orderBy(desc(commuteSessions.startedAt));

  const allTags =
    allSessions.length > 0
      ? await db
          .select()
          .from(commuteTags)
          .where(
            sql`${commuteTags.sessionId} IN (${sql.join(
              allSessions.map((s) => sql`${s.id}`),
              sql`, `
            )})`
          )
      : [];

  const outbound = allSessions.filter((s) => s.direction === "outbound");
  const returnTrips = allSessions.filter((s) => s.direction === "return");
  const recentSessions = allSessions.filter((s) => s.startedAt >= sevenDaysAgo);

  const computeStats = (sessions: typeof allSessions) => {
    const durations = sessions.map((s) => s.totalDurationMin!).filter((d) => d > 0).sort((a, b) => a - b);
    if (durations.length === 0) return null;
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const median = durations.length % 2 === 0
      ? (durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2
      : durations[Math.floor(durations.length / 2)];
    return {
      count: durations.length,
      avg: Math.round(avg * 10) / 10,
      median: Math.round(median * 10) / 10,
      min: Math.round(durations[0] * 10) / 10,
      max: Math.round(durations[durations.length - 1] * 10) / 10,
    };
  };

  const bandStats = (sessions: typeof allSessions) => {
    const bands: Record<string, number[]> = {};
    for (const s of sessions) {
      if (!s.totalDurationMin) continue;
      const hour = new Date(s.startedAt).getHours();
      const minute = Math.floor(new Date(s.startedAt).getMinutes() / 10) * 10;
      const label = `${hour > 12 ? hour - 12 : hour}:${minute.toString().padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
      if (!bands[label]) bands[label] = [];
      bands[label].push(s.totalDurationMin);
    }
    return Object.entries(bands)
      .map(([band, durations]) => ({
        band,
        avgDuration: Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10,
        count: durations.length,
      }))
      .sort((a, b) => a.avgDuration - b.avgDuration);
  };

  const tagCounts: Record<string, number> = {};
  for (const t of allTags) {
    tagCounts[t.tag] = (tagCounts[t.tag] || 0) + 1;
  }

  // Route breakdown (if multiple routes in data)
  const routeBreakdown: Record<string, { count: number; avgDuration: number }> = {};
  for (const s of allSessions) {
    const r = s.route || "JSQ-WTC";
    if (!routeBreakdown[r]) routeBreakdown[r] = { count: 0, avgDuration: 0 };
    routeBreakdown[r].count++;
    routeBreakdown[r].avgDuration += s.totalDurationMin || 0;
  }
  for (const r of Object.keys(routeBreakdown)) {
    if (routeBreakdown[r].count > 0) {
      routeBreakdown[r].avgDuration = Math.round(
        (routeBreakdown[r].avgDuration / routeBreakdown[r].count) * 10
      ) / 10;
    }
  }

  const dailyAvg: { date: string; outbound: number | null; returnTrip: number | null }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "America/New_York" });
    const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);
    const daySessions = recentSessions.filter((s) => {
      const st = new Date(s.startedAt);
      return st >= dayStart && st <= dayEnd;
    });
    const dayOut = daySessions.filter((s) => s.direction === "outbound");
    const dayRet = daySessions.filter((s) => s.direction === "return");
    dailyAvg.push({
      date: dateStr,
      outbound: dayOut.length > 0 ? Math.round((dayOut.reduce((a, s) => a + (s.totalDurationMin || 0), 0) / dayOut.length) * 10) / 10 : null,
      returnTrip: dayRet.length > 0 ? Math.round((dayRet.reduce((a, s) => a + (s.totalDurationMin || 0), 0) / dayRet.length) * 10) / 10 : null,
    });
  }

  const [correlations, streaks] = await Promise.all([
    analyzeCorrelations(session.user.id, 60).catch(() => null),
    getStreakData(session.user.id).catch(() => null),
  ]);

  return {
    overall: computeStats(allSessions),
    outbound: computeStats(outbound),
    returnTrips: computeStats(returnTrips),
    totalTrips: allSessions.length,
    outboundBands: bandStats(outbound).slice(0, 5),
    returnBands: bandStats(returnTrips).slice(0, 5),
    tagCounts,
    dailyAvg,
    routeBreakdown,
    activeRouteFilter: routeFilter || null,
    correlations: correlations
      ? {
          insights: correlations.insights.map((i) => ({
            type: i.type, title: i.title, description: i.description,
            magnitude: i.magnitude, sampleSize: i.sampleSize,
          })),
          weatherBuckets: correlations.weatherBuckets,
          learnedPenalties: correlations.learnedPenalties,
          dataPoints: correlations.dataPoints,
        }
      : null,
    streaks: streaks
      ? {
          checkinStreak: streaks.checkinStreak,
          longestCheckinStreak: streaks.longestCheckinStreak,
          onTimeStreak: streaks.onTimeStreak,
          fastestOutbound: streaks.fastestOutbound,
          fastestReturn: streaks.fastestReturn,
          thisWeek: streaks.thisWeek,
          thisMonth: streaks.thisMonth,
          totalCommutes: streaks.totalCommutes,
        }
      : null,
  };
}
