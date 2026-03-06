/**
 * Commute Streaks & Gamification Engine
 *
 * v2.5: Persists streak snapshots to DB to avoid full recomputation.
 * Falls back to full recompute if snapshot is stale (>24h) or missing.
 */

import { db } from "@/lib/db";
import { commuteSessions, streakSnapshots } from "@/lib/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";

export interface StreakData {
  checkinStreak: number;
  longestCheckinStreak: number;
  onTimeStreak: number;
  fastestOutbound: number | null;
  fastestReturn: number | null;
  thisWeek: WeeklySummary;
  thisMonth: MonthlySummary;
  totalCommutes: number;
}

interface WeeklySummary {
  commutes: number;
  avgDuration: number | null;
  checkinDays: number;
  weekdaysElapsed: number;
}

interface MonthlySummary {
  commutes: number;
  avgDuration: number | null;
  onTimePct: number | null;
  bestDay: string | null;
}

/**
 * Get streak data. Reads from persisted snapshot if fresh (<6h),
 * otherwise recomputes and persists.
 */
export async function getStreakData(
  userId: string,
  targetDurationMin = 45
): Promise<StreakData> {
  // Try cached snapshot first
  const [snapshot] = await db
    .select()
    .from(streakSnapshots)
    .where(eq(streakSnapshots.userId, userId))
    .limit(1);

  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  if (snapshot && snapshot.lastComputedAt > sixHoursAgo) {
    // Snapshot is fresh — still need weekly/monthly (lightweight)
    const sessions = await getRecentSessionsForSummary(userId);
    return {
      checkinStreak: snapshot.checkinStreak,
      longestCheckinStreak: snapshot.longestCheckinStreak,
      onTimeStreak: snapshot.onTimeStreak,
      fastestOutbound: snapshot.fastestOutbound
        ? Math.round(snapshot.fastestOutbound * 10) / 10
        : null,
      fastestReturn: snapshot.fastestReturn
        ? Math.round(snapshot.fastestReturn * 10) / 10
        : null,
      thisWeek: computeWeeklySummary(sessions),
      thisMonth: computeMonthlySummary(sessions),
      totalCommutes: snapshot.totalCommutes,
    };
  }

  // Full recompute
  const sessions = await db
    .select()
    .from(commuteSessions)
    .where(
      and(
        eq(commuteSessions.userId, userId),
        sql`${commuteSessions.completedAt} IS NOT NULL`,
        sql`${commuteSessions.totalDurationMin} IS NOT NULL`
      )
    )
    .orderBy(desc(commuteSessions.startedAt));

  if (sessions.length === 0) return emptyStreakData();

  const { current: checkinStreak, longest: longestCheckinStreak } = computeCheckinStreak(sessions);
  const onTimeStreak = computeOnTimeStreak(sessions, targetDurationMin);

  const outbound = sessions.filter((s) => s.direction === "outbound");
  const returnSessions = sessions.filter((s) => s.direction === "return");

  const fastestOutbound = outbound.length > 0
    ? Math.min(...outbound.map((s) => s.totalDurationMin!))
    : null;
  const fastestReturn = returnSessions.length > 0
    ? Math.min(...returnSessions.map((s) => s.totalDurationMin!))
    : null;

  // Persist snapshot
  const snapshotData = {
    checkinStreak,
    longestCheckinStreak,
    onTimeStreak,
    fastestOutbound,
    fastestReturn,
    totalCommutes: sessions.length,
    lastComputedAt: new Date(),
  };

  if (snapshot) {
    await db
      .update(streakSnapshots)
      .set(snapshotData)
      .where(eq(streakSnapshots.userId, userId));
  } else {
    await db.insert(streakSnapshots).values({ userId, ...snapshotData });
  }

  return {
    ...snapshotData,
    fastestOutbound: fastestOutbound ? Math.round(fastestOutbound * 10) / 10 : null,
    fastestReturn: fastestReturn ? Math.round(fastestReturn * 10) / 10 : null,
    thisWeek: computeWeeklySummary(sessions),
    thisMonth: computeMonthlySummary(sessions),
  };
}

function emptyStreakData(): StreakData {
  return {
    checkinStreak: 0, longestCheckinStreak: 0, onTimeStreak: 0,
    fastestOutbound: null, fastestReturn: null,
    thisWeek: { commutes: 0, avgDuration: null, checkinDays: 0, weekdaysElapsed: 0 },
    thisMonth: { commutes: 0, avgDuration: null, onTimePct: null, bestDay: null },
    totalCommutes: 0,
  };
}

async function getRecentSessionsForSummary(userId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return db
    .select()
    .from(commuteSessions)
    .where(
      and(
        eq(commuteSessions.userId, userId),
        sql`${commuteSessions.completedAt} IS NOT NULL`,
        sql`${commuteSessions.totalDurationMin} IS NOT NULL`,
        sql`${commuteSessions.startedAt} >= ${thirtyDaysAgo}`
      )
    )
    .orderBy(desc(commuteSessions.startedAt));
}

function computeCheckinStreak(
  sessions: (typeof commuteSessions.$inferSelect)[]
): { current: number; longest: number } {
  const checkinDates = new Set<string>();
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    if (d.getDay() >= 1 && d.getDay() <= 5) {
      checkinDates.add(d.toISOString().split("T")[0]);
    }
  }

  const d = new Date();
  let current = 0;
  let longest = 0;
  let streak = 0;

  for (let i = 0; i < 365; i++) {
    if (d.getDay() >= 1 && d.getDay() <= 5) {
      if (checkinDates.has(d.toISOString().split("T")[0])) {
        streak++;
        longest = Math.max(longest, streak);
        if (i <= 7) current = streak;
      } else {
        if (current === 0) current = streak;
        streak = 0;
      }
    }
    d.setDate(d.getDate() - 1);
  }

  return { current: current || streak, longest };
}

function computeOnTimeStreak(
  sessions: (typeof commuteSessions.$inferSelect)[],
  targetMin: number
): number {
  let streak = 0;
  for (const s of sessions) {
    if (s.totalDurationMin && s.totalDurationMin <= targetMin) streak++;
    else break;
  }
  return streak;
}

function computeWeeklySummary(
  sessions: (typeof commuteSessions.$inferSelect)[]
): WeeklySummary {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const weekSessions = sessions.filter((s) => new Date(s.startedAt) >= monday);
  const durations = weekSessions.map((s) => s.totalDurationMin!).filter((d) => d > 0);
  const checkinDays = new Set(
    weekSessions.map((s) => new Date(s.startedAt).toISOString().split("T")[0])
  ).size;
  const today = now.getDay();
  const weekdaysElapsed = today === 0 ? 5 : today === 6 ? 5 : today;

  return {
    commutes: weekSessions.length,
    avgDuration: durations.length > 0
      ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
      : null,
    checkinDays,
    weekdaysElapsed,
  };
}

function computeMonthlySummary(
  sessions: (typeof commuteSessions.$inferSelect)[]
): MonthlySummary {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthSessions = sessions.filter((s) => new Date(s.startedAt) >= firstOfMonth);
  const durations = monthSessions.map((s) => s.totalDurationMin!).filter((d) => d > 0);

  if (durations.length === 0) {
    return { commutes: 0, avgDuration: null, onTimePct: null, bestDay: null };
  }

  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const sorted = [...durations].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const onTime = durations.filter((d) => d <= median).length;

  const dayAvgs: Record<string, number[]> = {};
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (const s of monthSessions) {
    if (!s.totalDurationMin) continue;
    const dayName = dayNames[new Date(s.startedAt).getDay()];
    if (!dayAvgs[dayName]) dayAvgs[dayName] = [];
    dayAvgs[dayName].push(s.totalDurationMin);
  }

  let bestDay: string | null = null;
  let bestAvg = Infinity;
  for (const [day, durs] of Object.entries(dayAvgs)) {
    const d = durs.reduce((a, b) => a + b, 0) / durs.length;
    if (d < bestAvg) { bestAvg = d; bestDay = day; }
  }

  return {
    commutes: monthSessions.length,
    avgDuration: Math.round(avg * 10) / 10,
    onTimePct: Math.round((onTime / durations.length) * 100),
    bestDay,
  };
}
