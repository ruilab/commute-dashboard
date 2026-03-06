/**
 * Weather-Delay Correlation Engine
 *
 * Analyzes stored commute sessions against weather/transit snapshots
 * to learn actual impact patterns.
 *
 * v2.5: Added temperature bucketing and wind speed analysis.
 */

import { db } from "@/lib/db";
import {
  commuteSessions,
  weatherSnapshots,
  transitSnapshots,
} from "@/lib/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";

export interface CorrelationInsight {
  type: "weather_impact" | "delay_pattern" | "time_pattern" | "temp_impact" | "wind_impact";
  title: string;
  description: string;
  magnitude: number;
  confidence: number;
  sampleSize: number;
}

export interface WeatherBucket {
  condition: string;
  avgDuration: number;
  medianDuration: number;
  count: number;
}

export interface TempBucket {
  range: string; // e.g. "< 32°F", "32–50°F"
  avgDuration: number;
  count: number;
}

export interface WindBucket {
  range: string; // e.g. "calm", "moderate", "strong"
  avgDuration: number;
  count: number;
}

export interface CorrelationReport {
  insights: CorrelationInsight[];
  weatherBuckets: WeatherBucket[];
  tempBuckets: TempBucket[];
  windBuckets: WindBucket[];
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

export async function analyzeCorrelations(
  userId: string,
  days = 60
): Promise<CorrelationReport> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

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

  const weatherData = await db
    .select()
    .from(weatherSnapshots)
    .where(gte(weatherSnapshots.fetchedAt, cutoff));

  const transitData = await db
    .select()
    .from(transitSnapshots)
    .where(gte(transitSnapshots.fetchedAt, cutoff));

  const enriched = sessions
    .map((s) => {
      const startTime = s.startedAt.getTime();
      return {
        session: s,
        weather: findNearest(weatherData, startTime, (w) => w.fetchedAt.getTime()),
        transit: findNearest(transitData, startTime, (t) => t.fetchedAt.getTime()),
      };
    })
    .filter((e) => e.session.totalDurationMin !== null);

  const weatherBuckets = computeWeatherBuckets(enriched);
  const tempBuckets = computeTempBuckets(enriched);
  const windBuckets = computeWindBuckets(enriched);
  const learnedPenalties = computeLearnedPenalties(enriched, weatherBuckets, tempBuckets, windBuckets);
  const insights = generateInsights(enriched, weatherBuckets, tempBuckets, windBuckets, learnedPenalties);

  return {
    insights,
    weatherBuckets,
    tempBuckets,
    windBuckets,
    learnedPenalties,
    dataPoints: enriched.length,
    periodDays: days,
  };
}

function emptyReport(days: number): CorrelationReport {
  return {
    insights: [],
    weatherBuckets: [],
    tempBuckets: [],
    windBuckets: [],
    learnedPenalties: { rain: 0, snow: 0, extremeTemp: 0, highWind: 0, transitDelay: 0 },
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
    if (diff < bestDiff) { best = item; bestDiff = diff; }
  }
  if (bestDiff > 2 * 60 * 60 * 1000) return null;
  return best;
}

type EnrichedSession = {
  session: typeof commuteSessions.$inferSelect;
  weather: typeof weatherSnapshots.$inferSelect | null;
  transit: typeof transitSnapshots.$inferSelect | null;
};

// ─── Condition Buckets ────────────────────────────────────────────────────

function computeWeatherBuckets(enriched: EnrichedSession[]): WeatherBucket[] {
  const buckets: Record<string, number[]> = {};
  for (const e of enriched) {
    const condition = e.weather?.condition || "unknown";
    if (!buckets[condition]) buckets[condition] = [];
    if (e.session.totalDurationMin) buckets[condition].push(e.session.totalDurationMin);
  }
  return Object.entries(buckets).map(([condition, durations]) => {
    durations.sort((a, b) => a - b);
    const mid = Math.floor(durations.length / 2);
    return {
      condition,
      avgDuration: round(durations.reduce((a, b) => a + b, 0) / durations.length),
      medianDuration: durations.length % 2 === 0
        ? round((durations[mid - 1] + durations[mid]) / 2)
        : round(durations[mid]),
      count: durations.length,
    };
  }).sort((a, b) => b.count - a.count);
}

// ─── Temperature Buckets ──────────────────────────────────────────────────

function tempBucketLabel(tempF: number): string {
  if (tempF < 32) return "< 32°F (freezing)";
  if (tempF < 50) return "32–50°F (cold)";
  if (tempF < 70) return "50–70°F (mild)";
  if (tempF < 85) return "70–85°F (warm)";
  return "≥ 85°F (hot)";
}

function computeTempBuckets(enriched: EnrichedSession[]): TempBucket[] {
  const buckets: Record<string, number[]> = {};
  for (const e of enriched) {
    if (!e.weather?.temperature || !e.session.totalDurationMin) continue;
    const label = tempBucketLabel(e.weather.temperature);
    if (!buckets[label]) buckets[label] = [];
    buckets[label].push(e.session.totalDurationMin);
  }
  return Object.entries(buckets).map(([range, durations]) => ({
    range,
    avgDuration: round(durations.reduce((a, b) => a + b, 0) / durations.length),
    count: durations.length,
  })).sort((a, b) => a.avgDuration - b.avgDuration);
}

// ─── Wind Buckets ─────────────────────────────────────────────────────────

function windBucketLabel(mph: number): string {
  if (mph < 8) return "Calm (< 8 mph)";
  if (mph < 18) return "Moderate (8–18 mph)";
  if (mph < 30) return "Strong (18–30 mph)";
  return "Very strong (≥ 30 mph)";
}

function computeWindBuckets(enriched: EnrichedSession[]): WindBucket[] {
  const buckets: Record<string, number[]> = {};
  for (const e of enriched) {
    if (!e.weather?.windSpeed || !e.session.totalDurationMin) continue;
    const label = windBucketLabel(e.weather.windSpeed);
    if (!buckets[label]) buckets[label] = [];
    buckets[label].push(e.session.totalDurationMin);
  }
  return Object.entries(buckets).map(([range, durations]) => ({
    range,
    avgDuration: round(durations.reduce((a, b) => a + b, 0) / durations.length),
    count: durations.length,
  })).sort((a, b) => a.avgDuration - b.avgDuration);
}

// ─── Learned Penalties ────────────────────────────────────────────────────

function computeLearnedPenalties(
  enriched: EnrichedSession[],
  weatherBuckets: WeatherBucket[],
  tempBuckets: TempBucket[],
  windBuckets: WindBucket[]
) {
  const clearAvg = weatherBuckets.find((b) => b.condition === "clear")?.avgDuration ?? null;
  const cloudyAvg = weatherBuckets.find((b) => b.condition === "cloudy")?.avgDuration ?? null;
  const baseline = clearAvg ?? cloudyAvg ?? 0;

  if (baseline === 0) {
    return { rain: 0, snow: 0, extremeTemp: 0, highWind: 0, transitDelay: 0 };
  }

  const rainAvg = weatherBuckets.find(
    (b) => b.condition === "rain" || b.condition === "drizzle"
  )?.avgDuration ?? baseline;
  const snowAvg = weatherBuckets.find((b) => b.condition === "snow")?.avgDuration ?? baseline;

  // Temperature penalty: compare extreme buckets to mild
  const mildAvg = tempBuckets.find((b) => b.range.includes("mild"))?.avgDuration ?? baseline;
  const freezingAvg = tempBuckets.find((b) => b.range.includes("freezing"))?.avgDuration;
  const hotAvg = tempBuckets.find((b) => b.range.includes("hot"))?.avgDuration;
  const extremeTempPenalty = Math.max(
    freezingAvg ? round(freezingAvg - mildAvg) : 0,
    hotAvg ? round(hotAvg - mildAvg) : 0,
    0
  );

  // Wind penalty: compare strong to calm
  const calmAvg = windBuckets.find((b) => b.range.includes("Calm"))?.avgDuration ?? baseline;
  const strongAvg = windBuckets.find((b) => b.range.includes("Strong"))?.avgDuration;
  const veryStrongAvg = windBuckets.find((b) => b.range.includes("Very strong"))?.avgDuration;
  const highWindPenalty = Math.max(
    strongAvg ? round(strongAvg - calmAvg) : 0,
    veryStrongAvg ? round(veryStrongAvg - calmAvg) : 0,
    0
  );

  // Transit delay penalty
  const normalTransit = enriched.filter((e) => e.transit?.status === "normal");
  const delayedTransit = enriched.filter(
    (e) => e.transit?.status === "delays" || e.transit?.status === "suspended"
  );
  const normalAvg = normalTransit.length > 0
    ? normalTransit.reduce((a, e) => a + (e.session.totalDurationMin || 0), 0) / normalTransit.length
    : baseline;
  const delayedAvg = delayedTransit.length > 0
    ? delayedTransit.reduce((a, e) => a + (e.session.totalDurationMin || 0), 0) / delayedTransit.length
    : baseline;

  return {
    rain: Math.max(0, round(rainAvg - baseline)),
    snow: Math.max(0, round(snowAvg - baseline)),
    extremeTemp: Math.max(0, extremeTempPenalty),
    highWind: Math.max(0, highWindPenalty),
    transitDelay: Math.max(0, round(delayedAvg - normalAvg)),
  };
}

// ─── Insights ─────────────────────────────────────────────────────────────

function generateInsights(
  enriched: EnrichedSession[],
  weatherBuckets: WeatherBucket[],
  tempBuckets: TempBucket[],
  windBuckets: WindBucket[],
  penalties: ReturnType<typeof computeLearnedPenalties>
): CorrelationInsight[] {
  const insights: CorrelationInsight[] = [];
  const clearBucket = weatherBuckets.find((b) => b.condition === "clear");

  // Rain
  const rainBucket = weatherBuckets.find((b) => b.condition === "rain" || b.condition === "drizzle");
  if (rainBucket && clearBucket && rainBucket.count >= 3 && Math.abs(rainBucket.avgDuration - clearBucket.avgDuration) >= 2) {
    const diff = rainBucket.avgDuration - clearBucket.avgDuration;
    insights.push({
      type: "weather_impact",
      title: `Rain adds ~${Math.round(diff)} min`,
      description: `Rainy commutes avg ${rainBucket.avgDuration} min vs ${clearBucket.avgDuration} min clear (${rainBucket.count} trips).`,
      magnitude: diff, confidence: Math.min(rainBucket.count / 10, 1), sampleSize: rainBucket.count,
    });
  }

  // Snow
  const snowBucket = weatherBuckets.find((b) => b.condition === "snow");
  if (snowBucket && clearBucket && snowBucket.count >= 2 && Math.abs(snowBucket.avgDuration - clearBucket.avgDuration) >= 3) {
    const diff = snowBucket.avgDuration - clearBucket.avgDuration;
    insights.push({
      type: "weather_impact",
      title: `Snow adds ~${Math.round(diff)} min`,
      description: `Snowy commutes avg ${snowBucket.avgDuration} min vs ${clearBucket.avgDuration} min clear.`,
      magnitude: diff, confidence: Math.min(snowBucket.count / 5, 1), sampleSize: snowBucket.count,
    });
  }

  // Temperature
  if (penalties.extremeTemp >= 2) {
    const coldBucket = tempBuckets.find((b) => b.range.includes("freezing"));
    const hotBucket = tempBuckets.find((b) => b.range.includes("hot"));
    const mildBucket = tempBuckets.find((b) => b.range.includes("mild"));
    const worstBucket = coldBucket && hotBucket
      ? (coldBucket.avgDuration > hotBucket.avgDuration ? coldBucket : hotBucket)
      : (coldBucket || hotBucket);
    if (worstBucket && mildBucket) {
      insights.push({
        type: "temp_impact",
        title: `Extreme temps add ~${Math.round(penalties.extremeTemp)} min`,
        description: `${worstBucket.range}: ${worstBucket.avgDuration} min avg vs ${mildBucket.avgDuration} min mild (${worstBucket.count} trips).`,
        magnitude: penalties.extremeTemp,
        confidence: Math.min(worstBucket.count / 5, 1),
        sampleSize: worstBucket.count,
      });
    }
  }

  // Wind
  if (penalties.highWind >= 2) {
    const strongBucket = windBuckets.find((b) => b.range.includes("Strong") || b.range.includes("Very"));
    const calmBucket = windBuckets.find((b) => b.range.includes("Calm"));
    if (strongBucket && calmBucket) {
      insights.push({
        type: "wind_impact",
        title: `Strong wind adds ~${Math.round(penalties.highWind)} min`,
        description: `${strongBucket.range}: ${strongBucket.avgDuration} min avg vs ${calmBucket.avgDuration} min calm (${strongBucket.count} trips).`,
        magnitude: penalties.highWind,
        confidence: Math.min(strongBucket.count / 5, 1),
        sampleSize: strongBucket.count,
      });
    }
  }

  // Transit delay
  if (penalties.transitDelay >= 3) {
    const delayedCount = enriched.filter(
      (e) => e.transit?.status === "delays" || e.transit?.status === "suspended"
    ).length;
    insights.push({
      type: "delay_pattern",
      title: `PATH delays add ~${Math.round(penalties.transitDelay)} min`,
      description: `Commute averages ${Math.round(penalties.transitDelay)} min longer with active delays (${delayedCount} trips).`,
      magnitude: penalties.transitDelay, confidence: Math.min(delayedCount / 5, 1), sampleSize: delayedCount,
    });
  }

  // Morning vs evening
  const outbound = enriched.filter((e) => e.session.direction === "outbound" && e.session.totalDurationMin);
  const returnTrips = enriched.filter((e) => e.session.direction === "return" && e.session.totalDurationMin);
  if (outbound.length >= 5 && returnTrips.length >= 5) {
    const outAvg = outbound.reduce((a, e) => a + (e.session.totalDurationMin || 0), 0) / outbound.length;
    const retAvg = returnTrips.reduce((a, e) => a + (e.session.totalDurationMin || 0), 0) / returnTrips.length;
    const diff = retAvg - outAvg;
    if (Math.abs(diff) >= 3) {
      const faster = diff > 0 ? "mornings" : "evenings";
      insights.push({
        type: "time_pattern",
        title: `${faster === "mornings" ? "Morning" : "Evening"} is ~${Math.round(Math.abs(diff))} min faster`,
        description: `Morning avg: ${Math.round(outAvg)} min, Evening avg: ${Math.round(retAvg)} min.`,
        magnitude: Math.abs(diff), confidence: 0.8, sampleSize: outbound.length + returnTrips.length,
      });
    }
  }

  return insights.sort((a, b) => b.magnitude - a.magnitude);
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
