"use server";

import { getTransitStatus } from "@/lib/services/transit";
import { getWeather } from "@/lib/services/weather";
import { getCalendarContext } from "@/lib/services/calendar";
import { generateRecommendation } from "@/lib/engine/recommend";
import { getSettings } from "@/lib/actions/settings";
import { getHistoricalStats } from "@/lib/actions/commute";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  recommendationSnapshots,
  transitSnapshots,
  weatherSnapshots,
} from "@/lib/db/schema";
import type { Direction } from "@/lib/db/schema";

export async function getDashboardData() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const [transit, weather, settings, outboundStats, returnStats, calendar] =
    await Promise.all([
      getTransitStatus(),
      getWeather(),
      getSettings(),
      getHistoricalStats("outbound"),
      getHistoricalStats("return"),
      getCalendarContext(session.user.id).catch(() => null),
    ]);

  const walking = {
    homeToJsq: settings?.walkHomeToJsq ?? 8,
    wtcToOffice: settings?.walkWtcToOffice ?? 10,
    officeToWtc: settings?.walkOfficeToWtc ?? 10,
    jsqToHome: settings?.walkJsqToHome ?? 8,
  };

  // If calendar says "must arrive by 9:30", adjust morning window end
  let morningWindowEnd = settings?.morningWindowEnd ?? "10:00";
  if (calendar?.mustArriveBy) {
    // Work backward: must arrive - train time - wait - walk to station
    const [h, m] = calendar.mustArriveBy.split(":").map(Number);
    const arriveByMin = h * 60 + m;
    const trainAndWait = 13 + 5; // base train + average wait
    const walkToStation = walking.homeToJsq;
    const latestDepartMin = arriveByMin - trainAndWait - walkToStation;
    const latestDepart = `${Math.floor(latestDepartMin / 60).toString().padStart(2, "0")}:${(latestDepartMin % 60).toString().padStart(2, "0")}`;

    // Only constrain if it's earlier than current window end
    if (latestDepart < morningWindowEnd) {
      morningWindowEnd = latestDepart;
    }
  }

  const morningRec = generateRecommendation({
    direction: "outbound",
    transit,
    weather,
    walking,
    historical: outboundStats,
    windowStart: settings?.morningWindowStart ?? "08:30",
    windowEnd: morningWindowEnd,
  });

  const eveningRec = generateRecommendation({
    direction: "return",
    transit,
    weather,
    walking,
    historical: returnStats,
    windowStart: settings?.eveningWindowStart ?? "19:00",
    windowEnd: settings?.eveningWindowEnd ?? "21:00",
  });

  // Persist snapshots (fire and forget)
  persistSnapshots(
    session.user.id,
    transit,
    weather,
    morningRec,
    eveningRec
  ).catch(() => {});

  return {
    transit: {
      status: transit.status,
      advisoryText: transit.advisoryText,
      headwayMin: transit.headwayMin,
      isStale: transit.isStale,
      source: transit.source,
      nextArrivals: transit.nextArrivals,
      serviceAlerts: transit.serviceAlerts.map((a) => ({
        description: a.description,
        severity: a.severity,
      })),
      isWeekendSchedule: transit.isWeekendSchedule,
      isPlannedWork: transit.isPlannedWork,
      realHeadwayMin: transit.realHeadwayMin,
    },
    weather: {
      temperature: weather.temperature,
      feelsLike: weather.feelsLike,
      precipProbability: weather.precipProbability,
      precipType: weather.precipType,
      windSpeed: weather.windSpeed,
      condition: weather.condition,
      isSevere: weather.isSevere,
      forecastHours: weather.forecastHours,
      source: weather.source,
    },
    calendar: calendar
      ? {
          connected: calendar.connected,
          firstMeetingTime: calendar.firstMeetingTime?.toISOString() ?? null,
          firstMeetingTitle: calendar.firstMeetingTitle,
          eventsToday: calendar.eventsToday,
          mustArriveBy: calendar.mustArriveBy,
        }
      : null,
    morningRec: {
      bestBand: morningRec.bestBand.label,
      fallbackBands: morningRec.fallbackBands.map((b) => b.label),
      confidence: morningRec.confidence,
      explanation: morningRec.explanation,
      estimatedMinutes: morningRec.bestBand.estimatedDoorToDoor,
    },
    eveningRec: {
      bestBand: eveningRec.bestBand.label,
      fallbackBands: eveningRec.fallbackBands.map((b) => b.label),
      confidence: eveningRec.confidence,
      explanation: eveningRec.explanation,
      estimatedMinutes: eveningRec.bestBand.estimatedDoorToDoor,
    },
    generatedAt: new Date().toISOString(),
  };
}

async function persistSnapshots(
  userId: string,
  transit: Awaited<ReturnType<typeof getTransitStatus>>,
  weather: Awaited<ReturnType<typeof getWeather>>,
  morningRec: ReturnType<typeof generateRecommendation>,
  eveningRec: ReturnType<typeof generateRecommendation>
) {
  await Promise.all([
    db.insert(transitSnapshots).values({
      route: "JSQ-WTC",
      status: transit.status,
      advisoryText: transit.advisoryText,
      headwayMin: transit.headwayMin,
      source: transit.source,
    }),
    db.insert(weatherSnapshots).values({
      temperature: weather.temperature,
      feelsLike: weather.feelsLike,
      precipProbability: weather.precipProbability,
      precipType: weather.precipType,
      windSpeed: weather.windSpeed,
      condition: weather.condition,
      isSevere: weather.isSevere,
      forecastHours: weather.forecastHours,
      source: weather.source,
    }),
    db.insert(recommendationSnapshots).values({
      userId,
      direction: "outbound" as Direction,
      bestBand: morningRec.bestBand.label,
      fallbackBands: morningRec.fallbackBands.map((b) => b.label),
      confidence: morningRec.confidence,
      explanation: morningRec.explanation,
      scoringInputs: morningRec.scoringInputs,
    }),
    db.insert(recommendationSnapshots).values({
      userId,
      direction: "return" as Direction,
      bestBand: eveningRec.bestBand.label,
      fallbackBands: eveningRec.fallbackBands.map((b) => b.label),
      confidence: eveningRec.confidence,
      explanation: eveningRec.explanation,
      scoringInputs: eveningRec.scoringInputs,
    }),
  ]);
}
