/**
 * Commute Streaks & Gamification Engine
 *
 * Tracks:
 * - Check-in streak: consecutive weekdays with at least one check-in
 * - On-time streak: consecutive commutes within target duration
 * - Speed streak: consecutive commutes under personal best threshold
 *
 * Also tracks personal bests and weekly/monthly summaries.
 */

import { db } from "@/lib/db";
import { commuteSessions } from "@/lib/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";

export interface StreakData {
  checkinStreak: number; // consecutive weekdays with check-in
  longestCheckinStreak: number;
  onTimeStreak: number; // consecutive commutes within threshold
  fastestOutbound: number | null; // personal best outbound (min)
  fastestReturn: number | null; // personal best return (min)
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
  onTimePct: number | null; // % of commutes under median
  bestDay: string | null; // "Mon", "Tue", etc.
}

/**
 * Get all streak and gamification data for a user.
 */
export async function getStreakData(
  userId: string,
  targetDurationMin = 45
): Promise<StreakData> {
  // Get all completed sessions ordered by date
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

  if (sessions.length === 0) {
    return emptyStreakData();
  }

  // Compute check-in streak (consecutive weekdays)
  const { current: checkinStreak, longest: longestCheckinStreak } =
    computeCheckinStreak(sessions);

  // Compute on-time streak
  const onTimeStreak = computeOnTimeStreak(sessions, targetDurationMin);

  // Personal bests
  const outboundSessions = sessions.filter((s) => s.direction === "outbound");
  const returnSessions = sessions.filter((s) => s.direction === "return");

  const fastestOutbound =
    outboundSessions.length > 0
      ? Math.min(...outboundSessions.map((s) => s.totalDurationMin!))
      : null;
  const fastestReturn =
    returnSessions.length > 0
      ? Math.min(...returnSessions.map((s) => s.totalDurationMin!))
      : null;

  // This week summary
  const thisWeek = computeWeeklySummary(sessions);

  // This month summary
  const thisMonth = computeMonthlySummary(sessions);

  return {
    checkinStreak,
    longestCheckinStreak,
    onTimeStreak,
    fastestOutbound:
      fastestOutbound !== null
        ? Math.round(fastestOutbound * 10) / 10
        : null,
    fastestReturn:
      fastestReturn !== null ? Math.round(fastestReturn * 10) / 10 : null,
    thisWeek,
    thisMonth,
    totalCommutes: sessions.length,
  };
}

function emptyStreakData(): StreakData {
  return {
    checkinStreak: 0,
    longestCheckinStreak: 0,
    onTimeStreak: 0,
    fastestOutbound: null,
    fastestReturn: null,
    thisWeek: {
      commutes: 0,
      avgDuration: null,
      checkinDays: 0,
      weekdaysElapsed: 0,
    },
    thisMonth: {
      commutes: 0,
      avgDuration: null,
      onTimePct: null,
      bestDay: null,
    },
    totalCommutes: 0,
  };
}

function computeCheckinStreak(
  sessions: (typeof commuteSessions.$inferSelect)[]
): { current: number; longest: number } {
  // Get unique dates (weekdays only) where check-ins occurred
  const checkinDates = new Set<string>();
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    const day = d.getDay();
    if (day >= 1 && day <= 5) {
      checkinDates.add(d.toISOString().split("T")[0]);
    }
  }

  // Walk backward from today counting consecutive weekdays
  const today = new Date();
  let current = 0;
  let longest = 0;
  let streak = 0;
  const d = new Date(today);

  // Check up to 365 days back
  for (let i = 0; i < 365; i++) {
    const day = d.getDay();
    if (day >= 1 && day <= 5) {
      // weekday
      const dateStr = d.toISOString().split("T")[0];
      if (checkinDates.has(dateStr)) {
        streak++;
        longest = Math.max(longest, streak);
        if (i <= 7) current = streak; // Only count recent for current
      } else {
        if (current === 0) current = streak; // Save first streak as current
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
  // Sessions are already ordered by startedAt desc
  for (const s of sessions) {
    if (s.totalDurationMin && s.totalDurationMin <= targetMin) {
      streak++;
    } else {
      break;
    }
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

  const weekSessions = sessions.filter(
    (s) => new Date(s.startedAt) >= monday
  );
  const durations = weekSessions
    .map((s) => s.totalDurationMin!)
    .filter((d) => d > 0);

  // Count unique weekdays checked in this week
  const checkinDays = new Set(
    weekSessions.map((s) => new Date(s.startedAt).toISOString().split("T")[0])
  ).size;

  // Count weekdays elapsed this week
  const today = now.getDay();
  const weekdaysElapsed = today === 0 ? 5 : today === 6 ? 5 : today;

  return {
    commutes: weekSessions.length,
    avgDuration:
      durations.length > 0
        ? Math.round(
            (durations.reduce((a, b) => a + b, 0) / durations.length) * 10
          ) / 10
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

  const monthSessions = sessions.filter(
    (s) => new Date(s.startedAt) >= firstOfMonth
  );
  const durations = monthSessions
    .map((s) => s.totalDurationMin!)
    .filter((d) => d > 0);

  if (durations.length === 0) {
    return { commutes: 0, avgDuration: null, onTimePct: null, bestDay: null };
  }

  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const median = durations.sort((a, b) => a - b)[
    Math.floor(durations.length / 2)
  ];
  const onTime = durations.filter((d) => d <= median).length;

  // Best day of week
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
    const dayAvg = durs.reduce((a, b) => a + b, 0) / durs.length;
    if (dayAvg < bestAvg) {
      bestAvg = dayAvg;
      bestDay = day;
    }
  }

  return {
    commutes: monthSessions.length,
    avgDuration: Math.round(avg * 10) / 10,
    onTimePct: Math.round((onTime / durations.length) * 100),
    bestDay,
  };
}
