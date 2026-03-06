/**
 * Weather-Delay Correlation Engine
 *
 * Analyzes stored commute sessions against weather/transit snapshots
 * to learn actual impact patterns. Produces insights like:
 * - "Rain adds ~8 min to your commute on average"
 * - "Delays after 8:30 AM are more common on rainy days"
 *
 * Uses simple statistical analysis (no ML) — means, medians,
 * and bucket comparisons.
 */

import { db } from "@/lib/db";
import {
  commuteSessions,
  weatherSnapshots,
  transitSnapshots,
} from "@/lib/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";

export interface CorrelationInsight {
  type: "weather_impact" | "delay_pattern" | "time_pattern" | "combined";
  title: string;
  description: string;
  magnitude: number; // minutes of impact
  confidence: number; // 0-1
  sampleSize: number;
}

export interface WeatherBucket {
  condition: string;
  avgDuration: number;
  medianDuration: number;
  count: number;
}

export interface CorrelationReport {
  insights: CorrelationInsight[];
  weatherBuckets: WeatherBucket[];
  learnedPenalties: {
    rain: number;
    snow: number;
    extremeTemp: number;
    highWind: number;
    transitDelay: number;
  };
  dataPoints: number;
  periodDays: number;
}

/**
 * Analyze commute-weather correlations from stored data.
 */
export async function analyzeCorrelations(
  userId: string,
  days = 60
): Promise<CorrelationReport> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  // Get completed commute sessions
  const sessions = await db
    .select()
    .from(commuteSessions)
    .where(
      and(
        eq(commuteSessions.userId, userId),
        gte(commuteSessions.startedAt, cutoff),
        sql`${commuteSessions.completedAt} IS NOT NULL`,
        sql`${commuteSessions.totalDurationMin} IS NOT NULL`
      )
    );

  if (sessions.length < 5) {
    return emptyReport(days);
  }

  // Get weather snapshots from the same period
  const weatherData = await db
    .select()
    .from(weatherSnapshots)
    .where(gte(weatherSnapshots.fetchedAt, cutoff));

  // Get transit snapshots
  const transitData = await db
    .select()
    .from(transitSnapshots)
    .where(gte(transitSnapshots.fetchedAt, cutoff));

  // Match each session to nearest weather/transit snapshot
  const enriched = sessions
    .map((s) => {
      const startTime = s.startedAt.getTime();
      const nearestWeather = findNearest(
        weatherData,
        startTime,
        (w) => w.fetchedAt.getTime()
      );
      const nearestTransit = findNearest(
        transitData,
        startTime,
        (t) => t.fetchedAt.getTime()
      );

      return {
        session: s,
        weather: nearestWeather,
        transit: nearestTransit,
      };
    })
    .filter((e) => e.session.totalDurationMin !== null);

  // Bucket by weather condition
  const weatherBuckets = computeWeatherBuckets(enriched);

  // Compute learned penalties
  const learnedPenalties = computeLearnedPenalties(enriched, weatherBuckets);

  // Generate insights
  const insights = generateInsights(enriched, weatherBuckets, learnedPenalties);

  return {
    insights,
    weatherBuckets,
    learnedPenalties,
    dataPoints: enriched.length,
    periodDays: days,
  };
}

function emptyReport(days: number): CorrelationReport {
  return {
    insights: [],
    weatherBuckets: [],
    learnedPenalties: {
      rain: 0,
      snow: 0,
      extremeTemp: 0,
      highWind: 0,
      transitDelay: 0,
    },
    dataPoints: 0,
    periodDays: days,
  };
}

function findNearest<T>(
  items: T[],
  targetTime: number,
  getTime: (item: T) => number
): T | null {
  if (items.length === 0) return null;

  let best = items[0];
  let bestDiff = Math.abs(getTime(best) - targetTime);

  for (const item of items) {
    const diff = Math.abs(getTime(item) - targetTime);
    if (diff < bestDiff) {
      best = item;
      bestDiff = diff;
    }
  }

  // Only match if within 2 hours
  if (bestDiff > 2 * 60 * 60 * 1000) return null;
  return best;
}

type EnrichedSession = {
  session: typeof commuteSessions.$inferSelect;
  weather: typeof weatherSnapshots.$inferSelect | null;
  transit: typeof transitSnapshots.$inferSelect | null;
};

function computeWeatherBuckets(
  enriched: EnrichedSession[]
): WeatherBucket[] {
  const buckets: Record<string, number[]> = {};

  for (const e of enriched) {
    const condition = e.weather?.condition || "unknown";
    if (!buckets[condition]) buckets[condition] = [];
    if (e.session.totalDurationMin) {
      buckets[condition].push(e.session.totalDurationMin);
    }
  }

  return Object.entries(buckets)
    .map(([condition, durations]) => {
      durations.sort((a, b) => a - b);
      const mid = Math.floor(durations.length / 2);
      return {
        condition,
        avgDuration:
          Math.round(
            (durations.reduce((a, b) => a + b, 0) / durations.length) * 10
          ) / 10,
        medianDuration:
          durations.length % 2 === 0
            ? Math.round(((durations[mid - 1] + durations[mid]) / 2) * 10) / 10
            : Math.round(durations[mid] * 10) / 10,
        count: durations.length,
      };
    })
    .sort((a, b) => b.count - a.count);
}

function computeLearnedPenalties(
  enriched: EnrichedSession[],
  weatherBuckets: WeatherBucket[]
) {
  const clearAvg =
    weatherBuckets.find((b) => b.condition === "clear")?.avgDuration ?? null;
  const cloudyAvg =
    weatherBuckets.find((b) => b.condition === "cloudy")?.avgDuration ?? null;
  const baseline = clearAvg ?? cloudyAvg ?? 0;

  if (baseline === 0) {
    return { rain: 0, snow: 0, extremeTemp: 0, highWind: 0, transitDelay: 0 };
  }

  const rainAvg =
    weatherBuckets.find(
      (b) => b.condition === "rain" || b.condition === "drizzle"
    )?.avgDuration ?? baseline;
  const snowAvg =
    weatherBuckets.find((b) => b.condition === "snow")?.avgDuration ?? baseline;

  // Compute transit delay penalty
  const normalTransit = enriched.filter(
    (e) => e.transit?.status === "normal"
  );
  const delayedTransit = enriched.filter(
    (e) => e.transit?.status === "delays" || e.transit?.status === "suspended"
  );

  const normalAvg =
    normalTransit.length > 0
      ? normalTransit.reduce(
          (a, e) => a + (e.session.totalDurationMin || 0),
          0
        ) / normalTransit.length
      : baseline;
  const delayedAvg =
    delayedTransit.length > 0
      ? delayedTransit.reduce(
          (a, e) => a + (e.session.totalDurationMin || 0),
          0
        ) / delayedTransit.length
      : baseline;

  return {
    rain: Math.max(0, Math.round((rainAvg - baseline) * 10) / 10),
    snow: Math.max(0, Math.round((snowAvg - baseline) * 10) / 10),
    extremeTemp: 0, // Would need temp-bucketed analysis
    highWind: 0,
    transitDelay: Math.max(
      0,
      Math.round((delayedAvg - normalAvg) * 10) / 10
    ),
  };
}

function generateInsights(
  enriched: EnrichedSession[],
  weatherBuckets: WeatherBucket[],
  penalties: ReturnType<typeof computeLearnedPenalties>
): CorrelationInsight[] {
  const insights: CorrelationInsight[] = [];
  const clearBucket = weatherBuckets.find((b) => b.condition === "clear");

  // Rain impact insight
  const rainBucket = weatherBuckets.find(
    (b) => b.condition === "rain" || b.condition === "drizzle"
  );
  if (rainBucket && clearBucket && rainBucket.count >= 3) {
    const diff = rainBucket.avgDuration - clearBucket.avgDuration;
    if (Math.abs(diff) >= 2) {
      insights.push({
        type: "weather_impact",
        title: `Rain adds ~${Math.round(diff)} min`,
        description: `Your commute averages ${rainBucket.avgDuration} min on rainy days vs ${clearBucket.avgDuration} min on clear days (${rainBucket.count} rainy trips).`,
        magnitude: diff,
        confidence: Math.min(rainBucket.count / 10, 1),
        sampleSize: rainBucket.count,
      });
    }
  }

  // Snow impact insight
  const snowBucket = weatherBuckets.find((b) => b.condition === "snow");
  if (snowBucket && clearBucket && snowBucket.count >= 2) {
    const diff = snowBucket.avgDuration - clearBucket.avgDuration;
    if (Math.abs(diff) >= 3) {
      insights.push({
        type: "weather_impact",
        title: `Snow adds ~${Math.round(diff)} min`,
        description: `Snowy commutes average ${snowBucket.avgDuration} min vs ${clearBucket.avgDuration} min on clear days.`,
        magnitude: diff,
        confidence: Math.min(snowBucket.count / 5, 1),
        sampleSize: snowBucket.count,
      });
    }
  }

  // Transit delay impact
  if (penalties.transitDelay >= 3) {
    const delayedCount = enriched.filter(
      (e) => e.transit?.status === "delays" || e.transit?.status === "suspended"
    ).length;
    insights.push({
      type: "delay_pattern",
      title: `PATH delays add ~${Math.round(penalties.transitDelay)} min`,
      description: `When PATH reports delays, your commute averages ${Math.round(penalties.transitDelay)} min longer (${delayedCount} affected trips).`,
      magnitude: penalties.transitDelay,
      confidence: Math.min(delayedCount / 5, 1),
      sampleSize: delayedCount,
    });
  }

  // Time pattern insight: compare morning vs evening
  const outbound = enriched.filter(
    (e) => e.session.direction === "outbound" && e.session.totalDurationMin
  );
  const returnTrips = enriched.filter(
    (e) => e.session.direction === "return" && e.session.totalDurationMin
  );

  if (outbound.length >= 5 && returnTrips.length >= 5) {
    const outAvg =
      outbound.reduce((a, e) => a + (e.session.totalDurationMin || 0), 0) /
      outbound.length;
    const retAvg =
      returnTrips.reduce(
        (a, e) => a + (e.session.totalDurationMin || 0),
        0
      ) / returnTrips.length;
    const diff = retAvg - outAvg;

    if (Math.abs(diff) >= 3) {
      const faster = diff > 0 ? "mornings" : "evenings";
      insights.push({
        type: "time_pattern",
        title: `${faster === "mornings" ? "Morning" : "Evening"} commute is ~${Math.round(Math.abs(diff))} min faster`,
        description: `Morning avg: ${Math.round(outAvg)} min, Evening avg: ${Math.round(retAvg)} min.`,
        magnitude: Math.abs(diff),
        confidence: 0.8,
        sampleSize: outbound.length + returnTrips.length,
      });
    }
  }

  return insights.sort((a, b) => b.magnitude - a.magnitude);
}
